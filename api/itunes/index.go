package handler

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
)

func Handler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")

	if r.Method == "OPTIONS" {
		w.WriteHeader(200)
		return
	}

	term := r.URL.Query().Get("term")
	if term == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(400)
		w.Write([]byte(`{"error":"term parameter required"}`))
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
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(502)
		w.Write([]byte(`{"error":"failed to reach iTunes"}`))
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(502)
		w.Write([]byte(`{"error":"failed to read iTunes response"}`))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	w.Write(body)
}
