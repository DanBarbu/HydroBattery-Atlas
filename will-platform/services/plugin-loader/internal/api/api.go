// Package api exposes a small HTTP surface for the frontend Plugin Info panel
// (Sprint 1, S1-08) and for healthchecks.
package api

import (
	"encoding/json"
	"net/http"

	"github.com/will-platform/plugin-loader/internal/registry"
)

func New(reg *registry.Registry) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{
			"status":    "ok",
			"component": "plugin-loader",
		})
	})

	mux.HandleFunc("/v1/plugins", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		writeJSON(w, http.StatusOK, reg.List())
	})

	return mux
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
