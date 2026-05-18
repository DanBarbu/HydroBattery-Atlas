// Package api exposes the BFT HTTP surface.
//
//   GET  /healthz
//   GET  /v1/friendly-assets                 (operator+)
//   GET  /v1/friendly-assets/stale?seconds=N (operator+) — NO_COMMS detection
//   GET  /v1/friendly-assets/{id}            (operator+)
//   POST /v1/friendly-assets/report          (operator+) — ingest a report
//
// The report endpoint accepts a format hint via the `X-Will-Bft-Format`
// header (cot_friendly | nffi | will_native; default will_native) and the
// raw report body. ADR-010: situational awareness only, no targeting.
package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/will-platform/bft/internal/normalize"
	"github.com/will-platform/bft/internal/store"
)

func New(s *store.Store) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "component": "bft"})
	})

	mux.HandleFunc("/v1/friendly-assets/report", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if err := require(r, "operator"); err != nil {
			forbid(w, err)
			return
		}
		body, err := io.ReadAll(io.LimitReader(r.Body, normalize.MaxMessageBytes+1))
		if err != nil {
			badRequest(w, err)
			return
		}
		format := strings.ToLower(r.Header.Get("X-Will-Bft-Format"))
		var rep normalize.Report
		switch format {
		case "cot_friendly":
			rep, err = normalize.FromCoTFriendly(body)
		case "nffi":
			rep, err = normalize.FromNFFI(body)
		case "", "will_native":
			rep, err = normalize.FromWILLNative(body)
		default:
			badRequest(w, fmt.Errorf("unknown format %q", format))
			return
		}
		if err != nil {
			// ErrNotFriendly is a 422 (well-formed but not our concern).
			if errors.Is(err, normalize.ErrNotFriendly) {
				writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
				return
			}
			badRequest(w, err)
			return
		}
		asset := s.Ingest(tenant(r), rep)
		writeJSON(w, http.StatusCreated, asset)
	})

	mux.HandleFunc("/v1/friendly-assets/stale", func(w http.ResponseWriter, r *http.Request) {
		if err := require(r, "operator"); err != nil {
			forbid(w, err)
			return
		}
		secs := 120
		if v := r.URL.Query().Get("seconds"); v != "" {
			if n, e := strconv.Atoi(v); e == nil && n > 0 {
				secs = n
			}
		}
		writeJSON(w, http.StatusOK, s.Stale(tenant(r), time.Duration(secs)*time.Second, time.Now().UTC()))
	})

	mux.HandleFunc("/v1/friendly-assets/", func(w http.ResponseWriter, r *http.Request) {
		if err := require(r, "operator"); err != nil {
			forbid(w, err)
			return
		}
		id := strings.TrimPrefix(r.URL.Path, "/v1/friendly-assets/")
		if id == "" || strings.Contains(id, "/") {
			http.NotFound(w, r)
			return
		}
		a, ok := s.Get(tenant(r), id)
		if !ok {
			http.NotFound(w, r)
			return
		}
		writeJSON(w, http.StatusOK, a)
	})

	mux.HandleFunc("/v1/friendly-assets", func(w http.ResponseWriter, r *http.Request) {
		if err := require(r, "operator"); err != nil {
			forbid(w, err)
			return
		}
		writeJSON(w, http.StatusOK, s.List(tenant(r)))
	})

	return mux
}

func tenant(r *http.Request) string {
	t := r.Header.Get("X-Will-Tenant")
	if t == "" {
		return "00000000-0000-0000-0000-000000000001"
	}
	return t
}

func require(r *http.Request, minRole string) error {
	role := r.Header.Get("X-Will-Role")
	if role == "" {
		role = "operator"
	}
	rank := map[string]int{"viewer": 1, "operator": 2, "auditor": 2, "admin": 3, "cross_tenant_auditor": 3}
	need, ok1 := rank[minRole]
	have, ok2 := rank[role]
	if !ok1 || !ok2 || have < need {
		return fmt.Errorf("rbac: %q insufficient (need %q)", role, minRole)
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
func badRequest(w http.ResponseWriter, err error) {
	writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
}
func forbid(w http.ResponseWriter, err error) {
	writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
}
