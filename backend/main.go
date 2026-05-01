package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

// loadDotEnv reads ../.env (project root) and sets missing environment variables.
func loadDotEnv() {
	data, err := os.ReadFile("../.env")
	if err != nil {
		data, err = os.ReadFile(".env")
		if err != nil {
			return
		}
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])
		if os.Getenv(key) == "" {
			os.Setenv(key, val)
		}
	}
}

// ── iTunes proxy ──────────────────────────────────────────────────────────────

func itunesHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	if r.Method == "OPTIONS" {
		w.WriteHeader(200)
		return
	}

	term := r.URL.Query().Get("term")
	if term == "" {
		jsonError(w, 400, "term parameter required")
		return
	}
	limit := r.URL.Query().Get("limit")
	if limit == "" {
		limit = "20"
	}

	apiURL := fmt.Sprintf(
		"https://itunes.apple.com/search?term=%s&media=music&entity=song&limit=%s",
		url.QueryEscape(term), limit,
	)
	resp, err := http.Get(apiURL)
	if err != nil {
		jsonError(w, 502, "failed to reach iTunes")
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	w.Write(body)
}

// ── Chat handler ──────────────────────────────────────────────────────────────

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

const modelVision = "meta-llama/llama-4-scout-17b-16e-instruct"

func groqEndpoint() string {
	base := os.Getenv("GROQ_BASE_URL")
	if base == "" {
		base = "https://api.groq.com/openai/v1"
	}
	return base + "/chat/completions"
}

func groqTextModel() string {
	if m := os.Getenv("GROQ_MODEL"); m != "" {
		return m
	}
	return "llama-3.1-8b-instant"
}

type groqMsg struct {
	Role    string      `json:"role"`
	Content any `json:"content"`
}

type groqRequest struct {
	Model       string    `json:"model"`
	Messages    []groqMsg `json:"messages"`
	MaxTokens   int       `json:"max_tokens"`
	Temperature float64   `json:"temperature"`
}

type groqResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

func callGroq(apiKey, model string, msgs []groqMsg) (string, error) {
	payload, _ := json.Marshal(groqRequest{Model: model, Messages: msgs, MaxTokens: 512, Temperature: 0.5})
	req, _ := http.NewRequest("POST", groqEndpoint(), bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	if res.StatusCode != 200 {
		snippet := string(body)
		if len(snippet) > 200 {
			snippet = snippet[:200]
		}
		return "", fmt.Errorf("groq %d: %s", res.StatusCode, snippet)
	}
	var gr groqResponse
	if json.Unmarshal(body, &gr) != nil || len(gr.Choices) == 0 {
		return "", fmt.Errorf("unexpected response")
	}
	return gr.Choices[0].Message.Content, nil
}

type auddResult struct {
	Title       string `json:"title"`
	Artist      string `json:"artist"`
	Album       string `json:"album"`
	ReleaseDate string `json:"release_date"`
}

type auddApiResponse struct {
	Status string      `json:"status"`
	Result *auddResult `json:"result"`
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
	fw, _ := mw.CreateFormFile("file", "audio")
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
	var ar auddApiResponse
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

func chatHandler(w http.ResponseWriter, r *http.Request) {
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
		jsonError(w, 400, "invalid request")
		return
	}
	if strings.TrimSpace(req.Message) == "" && len(req.Attachments) == 0 {
		jsonError(w, 400, "message or attachment required")
		return
	}

	apiKey := strings.TrimSpace(os.Getenv("GROQ_API_KEY"))
	if apiKey == "" {
		jsonError(w, 503, "chatbot not configured")
		return
	}

	history := req.History
	if len(history) > 8 {
		history = history[len(history)-8:]
	}
	msgs := []groqMsg{{Role: "system", Content: sysPrompt}}
	for _, h := range history {
		msgs = append(msgs, groqMsg{Role: h.Role, Content: h.Content})
	}

	var audioResults []string
	var imageBlocks []map[string]any
	hasImages := false

	for _, att := range req.Attachments {
		switch {
		case strings.HasPrefix(att.Type, "image/"):
			hasImages = true
			imageBlocks = append(imageBlocks, map[string]any{
				"type": "image_url",
				"image_url": map[string]string{
					"url": "data:" + att.Type + ";base64," + att.Base64,
				},
			})
		case strings.HasPrefix(att.Type, "audio/"):
			auddKey := os.Getenv("AUDD_API_KEY")
			if auddKey != "" {
				audioResults = append(audioResults, fmt.Sprintf("%s\n%s", att.Name, recognizeSong(att.Base64, auddKey)))
			} else {
				audioResults = append(audioResults, fmt.Sprintf("%s\nAudio recognition is not available.", att.Name))
			}
		default:
			if decoded, err := base64.StdEncoding.DecodeString(att.Base64); err == nil {
				text := string(decoded)
				if len(text) > 2000 {
					text = text[:2000] + "...(truncated)"
				}
				req.Message += fmt.Sprintf("\n\n[Attached file: %s]\n%s", att.Name, text)
			}
		}
	}

	if len(audioResults) > 0 && !hasImages && strings.TrimSpace(req.Message) == "" {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(chatResponse{Reply: strings.Join(audioResults, "\n\n")})
		return
	}

	userText := req.Message
	if len(audioResults) > 0 {
		userText += "\n\nAudio recognition results:\n" + strings.Join(audioResults, "\n\n")
	}

	model := groqTextModel()
	if hasImages {
		model = modelVision
		content := append(imageBlocks, map[string]any{"type": "text", "text": userText})
		msgs = append(msgs, groqMsg{Role: "user", Content: content})
	} else {
		msgs = append(msgs, groqMsg{Role: "user", Content: userText})
	}

	replyText, err := callGroq(apiKey, model, msgs)
	if err != nil {
		jsonError(w, 502, "AI service unreachable: "+err.Error())
		return
	}
	resp := chatResponse{Reply: replyText}
	lines := strings.Split(strings.TrimRight(replyText, "\n"), "\n")
	for i := len(lines) - 1; i >= 0; i-- {
		line := strings.TrimSpace(lines[i])
		if strings.HasPrefix(line, "NAVIGATE:") {
			var nav navHint
			if json.Unmarshal([]byte(strings.TrimPrefix(line, "NAVIGATE:")), &nav) == nil {
				resp.Navigate = &nav
				resp.Reply = strings.TrimSpace(strings.Join(lines[:i], "\n"))
			}
			break
		}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func jsonError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	fmt.Fprintf(w, `{"error":%q}`, msg)
}

// ── Entry point ───────────────────────────────────────────────────────────────

func main() {
	loadDotEnv()
	mux := http.NewServeMux()
	statusHandler := func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"status":"ok"}`)
	}

	mux.HandleFunc("/api/status", statusHandler)
	mux.HandleFunc("/status", statusHandler)
	mux.HandleFunc("/api/itunes", itunesHandler)
	mux.HandleFunc("/itunes", itunesHandler)
	mux.HandleFunc("/api/chat", chatHandler)
	mux.HandleFunc("/chat", chatHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	addr := ":" + port
	log.Printf("Backend running on http://localhost%s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}
