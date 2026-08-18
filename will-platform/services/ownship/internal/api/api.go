// Package api exposes the own-ship HTTP surface.
//
//   GET  /healthz
//   GET  /v1/platforms                       (operator+)
//   POST /v1/platforms/state                 (operator+) — own-ship report
//   GET  /v1/platforms/comms-degraded        (operator+) — EMCON/offline picture
//   GET  /v1/platforms/{id}                  (operator+)
//   GET  /v1/platforms/{id}/comms            (operator+)
//   PUT  /v1/platforms/{id}/comms            (operator+) — Rafael SEA-COM health
//   GET  /v1/platforms/{id}/payloads         (operator+)
//   PUT  /v1/platforms/{id}/payloads         (admin)     — declare mounts
//
// ADR-011: WILL integrates the vessel as a mobile node. The vessel's own
// combat-management system remains authoritative for the vessel's fight —
// this service neither tasks payloads nor runs the ship's engagements.
package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/will-platform/ownship/internal/store"
)

func New(s *store.Store) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "component": "ownship"})
	})

	mux.HandleFunc("/v1/platforms/state", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if err := require(r, "operator"); err != nil {
			forbid(w, err)
			return
		}
		var rep store.StateReport
		if err := json.NewDecoder(r.Body).Decode(&rep); err != nil {
			badRequest(w, err)
			return
		}
		if rep.ExternalID == "" || rep.Name == "" {
			badRequest(w, fmt.Errorf("external_id and name are required"))
			return
		}
		if rep.Lat < -90 || rep.Lat > 90 || rep.Lon < -180 || rep.Lon > 180 {
			badRequest(w, fmt.Errorf("coordinate out of range"))
			return
		}
		writeJSON(w, http.StatusCreated, s.UpsertState(tenant(r), rep))
	})

	mux.HandleFunc("/v1/platforms/comms-degraded", func(w http.ResponseWriter, r *http.Request) {
		if err := require(r, "operator"); err != nil {
			forbid(w, err)
			return
		}
		writeJSON(w, http.StatusOK, s.CommsDegraded(tenant(r)))
	})

	mux.HandleFunc("/v1/platforms/", func(w http.ResponseWriter, r *http.Request) {
		if err := require(r, "operator"); err != nil {
			forbid(w, err)
			return
		}
		path := strings.TrimPrefix(r.URL.Path, "/v1/platforms/")
		parts := strings.Split(path, "/")
		pid := parts[0]
		if pid == "" {
			http.NotFound(w, r)
			return
		}

		if len(parts) == 2 && parts[1] == "comms" {
			switch r.Method {
			case http.MethodGet:
				p, ok := s.Get(tenant(r), pid)
				if !ok {
					http.NotFound(w, r)
					return
				}
				writeJSON(w, http.StatusOK, p.Comms)
			case http.MethodPut:
				var links []store.CommsLink
				if err := json.NewDecoder(r.Body).Decode(&links); err != nil {
					badRequest(w, err)
					return
				}
				p, ok := s.SetComms(tenant(r), pid, links)
				if !ok {
					http.NotFound(w, r)
					return
				}
				writeJSON(w, http.StatusOK, p)
			default:
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			}
			return
		}

		if len(parts) == 2 && parts[1] == "payloads" {
			switch r.Method {
			case http.MethodGet:
				p, ok := s.Get(tenant(r), pid)
				if !ok {
					http.NotFound(w, r)
					return
				}
				writeJSON(w, http.StatusOK, p.Payloads)
			case http.MethodPut:
				if err := require(r, "admin"); err != nil {
					forbid(w, err)
					return
				}
				var payloads []store.Payload
				if err := json.NewDecoder(r.Body).Decode(&payloads); err != nil {
					badRequest(w, err)
					return
				}
				p, ok := s.SetPayloads(tenant(r), pid, payloads)
				if !ok {
					http.NotFound(w, r)
					return
				}
				writeJSON(w, http.StatusOK, p)
			default:
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			}
			return
		}

		if len(parts) == 1 && r.Method == http.MethodGet {
			p, ok := s.Get(tenant(r), pid)
			if !ok {
				http.NotFound(w, r)
				return
			}
			writeJSON(w, http.StatusOK, p)
			return
		}
		http.NotFound(w, r)
	})

	mux.HandleFunc("/v1/platforms", func(w http.ResponseWriter, r *http.Request) {
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
