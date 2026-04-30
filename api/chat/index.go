package handler

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strings"
	"time"
)

const sysPrompt = `You are KeroBot, the friendly assistant for KeroMovie — a movie discovery and community platform. Keep replies concise and helpful.

PAGES ON KEROMOVIE:
- Home (/): Landing page with app overview and sign-up call-to-action
- Explore (/explore): Browse movies by genre (Trending Now, Action, Comedy, Horror, Romance, Sci-Fi, Thriller), search for any movie by title, tap a movie card to view its full synopsis, rating, runtime, genres, and bookmark it
- Dashboard (/browse): Personal space — featured movies carousel, cast panel (search actors/cast by movie title), soundtrack player (plays 30-second iTunes preview tracks from movie soundtracks), and bookmarks panel
- Forum (/forums): Community movie reviews — post a review with a 1–10 star rating and comment, read all community reviews, filter reviews by movie, delete your own posts
- Login (/login): Sign in, create a new account, reset forgotten password, or recover forgotten username

FEATURES:
- Search any movie by title on Explore
- View full movie details: synopsis, TMDB rating, runtime, genres, and backdrop
- Bookmark movies to save them for later
- Cast panel on Dashboard: type a movie title to see its actors and browse their filmography
- Soundtrack player: auto-loads iTunes preview tracks for the featured movie; users can search for soundtracks by movie title
- Community Forum: post reviews with star ratings, read others' reviews, filter by movie
- Profile settings on Dashboard: update username, email address, or password

Only answer questions about KeroMovie and its features. If asked about something unrelated, politely say you can only help with KeroMovie.

When the user asks to navigate to a page or you recommend they visit one, include this exact line at the very end of your reply (nothing after it):
NAVIGATE:{"path":"/path","label":"Page Name"}
Only include this line when navigation is clearly relevant.`

type historyMsg struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type attachment struct {
	Name   string `json:"name"`
	Type   string `json:"type"`
	Base64 string `json:"base64"`
}

type chatRequest struct {
	Message     string       `json:"message"`
	History     []historyMsg `json:"history"`
	Attachments []attachment `json:"attachments"`
}

type navHint struct {
	Path  string `json:"path"`
	Label string `json:"label"`
}

type chatResponse struct {
	Reply    string   `json:"reply"`
	Navigate *navHint `json:"navigate,omitempty"`
}

type anthropicMsg struct {
	Role    string      `json:"role"`
	Content interface{} `json:"content"`
}

type anthropicRequest struct {
	Model     string         `json:"model"`
	MaxTokens int            `json:"max_tokens"`
	System    string         `json:"system"`
	Messages  []anthropicMsg `json:"messages"`
}

type anthropicResponse struct {
	Content []struct {
		Text string `json:"text"`
	} `json:"content"`
}

type auddResult struct {
	Title       string `json:"title"`
	Artist      string `json:"artist"`
	Album       string `json:"album"`
	ReleaseDate string `json:"release_date"`
}

type auddResponse struct {
	Status string      `json:"status"`
	Result *auddResult `json:"result"`
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func recognizeSong(b64Audio, apiToken string) string {
	audioData, err := base64.StdEncoding.DecodeString(b64Audio)
	if err != nil {
		return "Could not decode the audio file."
	}

	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	mw.WriteField("api_token", apiToken)
	mw.WriteField("return", "apple_music,spotify")
	fw, err := mw.CreateFormFile("file", "audio")
	if err != nil {
		return "Internal error processing audio."
	}
	fw.Write(audioData)
	mw.Close()

	req, _ := http.NewRequest("POST", "https://api.audd.io/", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())

	client := &http.Client{Timeout: 30 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return "Could not reach the audio recognition service."
	}
	defer res.Body.Close()

	body, _ := io.ReadAll(res.Body)
	var ar auddResponse
	if json.Unmarshal(body, &ar) != nil || ar.Status != "success" || ar.Result == nil {
		return "Could not identify the song. Please try a clearer audio clip."
	}

	year := "Unknown"
	if len(ar.Result.ReleaseDate) >= 4 {
		year = ar.Result.ReleaseDate[:4]
	}

	return fmt.Sprintf("Song identified!\n• Title: %s\n• Artist: %s\n• Album: %s\n• Year: %s",
		ar.Result.Title, ar.Result.Artist, ar.Result.Album, year)
}

func Handler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(200)
		return
	}
	if r.Method != "POST" {
		http.Error(w, "method not allowed", 405)
		return
	}

	var req chatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}
	if strings.TrimSpace(req.Message) == "" && len(req.Attachments) == 0 {
		writeJSON(w, 400, map[string]string{"error": "message or attachment required"})
		return
	}

	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	if apiKey == "" {
		writeJSON(w, 503, map[string]string{"error": "chatbot not configured"})
		return
	}

	// Build history messages
	history := req.History
	if len(history) > 8 {
		history = history[len(history)-8:]
	}
	var msgs []anthropicMsg
	for _, h := range history {
		msgs = append(msgs, anthropicMsg{Role: h.Role, Content: h.Content})
	}

	// Process attachments
	var audioResults []string
	var contentBlocks []map[string]interface{}

	for _, att := range req.Attachments {
		switch {
		case strings.HasPrefix(att.Type, "image/"):
			mediaType := att.Type
			allowed := map[string]bool{"image/jpeg": true, "image/png": true, "image/gif": true, "image/webp": true}
			if !allowed[mediaType] {
				mediaType = "image/jpeg"
			}
			contentBlocks = append(contentBlocks, map[string]interface{}{
				"type": "image",
				"source": map[string]string{
					"type":       "base64",
					"media_type": mediaType,
					"data":       att.Base64,
				},
			})

		case strings.HasPrefix(att.Type, "audio/"):
			auddKey := os.Getenv("AUDD_API_KEY")
			if auddKey != "" {
				result := recognizeSong(att.Base64, auddKey)
				audioResults = append(audioResults, fmt.Sprintf("%s\n%s", att.Name, result))
			} else {
				audioResults = append(audioResults, fmt.Sprintf("%s\nAudio recognition is not available.", att.Name))
			}

		default:
			decoded, err := base64.StdEncoding.DecodeString(att.Base64)
			if err == nil {
				text := string(decoded)
				if len(text) > 2000 {
					text = text[:2000] + "...(truncated)"
				}
				contentBlocks = append(contentBlocks, map[string]interface{}{
					"type": "text",
					"text": fmt.Sprintf("[Attached file: %s]\n%s", att.Name, text),
				})
			}
		}
	}

	// If only audio (no images/text attachments and no text message), return recognition directly
	if len(audioResults) > 0 && len(contentBlocks) == 0 && strings.TrimSpace(req.Message) == "" {
		resp := chatResponse{Reply: strings.Join(audioResults, "\n\n")}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
		return
	}

	// Build the user content
	userText := req.Message
	if len(audioResults) > 0 {
		if userText != "" {
			userText += "\n\n"
		}
		userText += "Audio recognition results:\n" + strings.Join(audioResults, "\n\n")
	}

	if len(contentBlocks) > 0 {
		if userText != "" {
			contentBlocks = append(contentBlocks, map[string]interface{}{
				"type": "text",
				"text": userText,
			})
		} else if len(contentBlocks) > 0 {
			contentBlocks = append(contentBlocks, map[string]interface{}{
				"type": "text",
				"text": "What do you see in this? Please describe it and relate it to KeroMovie if possible.",
			})
		}
		msgs = append(msgs, anthropicMsg{Role: "user", Content: contentBlocks})
	} else {
		msgs = append(msgs, anthropicMsg{Role: "user", Content: userText})
	}

	payload, _ := json.Marshal(anthropicRequest{
		Model:     "claude-haiku-4-5-20251001",
		MaxTokens: 512,
		System:    sysPrompt,
		Messages:  msgs,
	})

	httpReq, _ := http.NewRequest("POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(payload))
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", apiKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")

	res, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		writeJSON(w, 502, map[string]string{"error": "AI service unreachable"})
		return
	}
	defer res.Body.Close()

	body, _ := io.ReadAll(res.Body)
	var ar anthropicResponse
	if json.Unmarshal(body, &ar) != nil || len(ar.Content) == 0 {
		writeJSON(w, 502, map[string]string{"error": "unexpected AI response"})
		return
	}

	replyText := ar.Content[0].Text
	resp := chatResponse{Reply: replyText}

	lines := strings.Split(strings.TrimRight(replyText, "\n"), "\n")
	for i := len(lines) - 1; i >= 0; i-- {
		line := strings.TrimSpace(lines[i])
		if strings.HasPrefix(line, "NAVIGATE:") {
			jsonStr := strings.TrimPrefix(line, "NAVIGATE:")
			var nav navHint
			if json.Unmarshal([]byte(jsonStr), &nav) == nil {
				resp.Navigate = &nav
				resp.Reply = strings.TrimSpace(strings.Join(lines[:i], "\n"))
			}
			break
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
