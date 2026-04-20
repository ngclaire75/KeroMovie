package main

import (
  "fmt"
  "log"
  "net/http"
)

func main() {
  mux := http.NewServeMux()

  mux.HandleFunc("/api/status", func(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    fmt.Fprint(w, `{"status":"ok","message":"Go backend is running"}`)
  })

  mux.HandleFunc("/api/hello", func(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    fmt.Fprint(w, `{"greeting":"Hello from Go backend"}`)
  })

  addr := ":8080"
  log.Printf("Backend running on http://localhost%s", addr)
  log.Fatal(http.ListenAndServe(addr, mux))
}
