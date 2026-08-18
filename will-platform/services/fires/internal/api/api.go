// Package api exposes the fires HTTP surface. ADR-012.
//
// READ-ONLY w.r.t. fires. The only mutating routes are *ingest from the
// authoritative fires C2* (AFATDS-class). There is deliberately NO route
// to create/modify/cancel a fire mission, task a unit, or compute a
// solution, and `deconfliction/check` is advisory only.
//
//   GET  /healthz
//   GET  /v1/fscm                         (operator+)
//   POST /v1/fscm/ingest                  (operator+)  ingest a measure from fires C2
//   GET  /v1/fscm/active?at=RFC3339       (operator+)
//   GET  /v1/fire-missions                (operator+)  STATUS only
//   POST /v1/fire-missions/ingest-status  (operator+)  ingest STATUS from fires C2
//   GET  /v1/deconfliction/check?lon=&lat=&alt=&at=  (operator+)  ADVISORY only
package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/will-platform/fires/internal/store"
)

func New(s *store.Store) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{
			"status": "ok", "component": "fires",
			"mode": "read-only-awareness", "adr": "ADR-012",
		})
	})

	mux.HandleFunc("/v1/fscm", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if err := require(r, "operator"); err != nil {
			forbid(w, err)
			return
		}
		writeJSON(w, http.StatusOK, s.ListFSCM(tenant(r)))
	})

	mux.HandleFunc("/v1/fscm/ingest", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if err := require(r, "operator"); err != nil {
			forbid(w, err)
			return
		}
		var m store.FSCM
		if err := json.NewDecoder(r.Body).Decode(&m); err != nil {
			badRequest(w, err)
			return
		}
		if m.ExternalID == "" || m.MeasureType == "" || m.Name == "" {
			badRequest(w, fmt.Errorf("external_id, measure_type and name are required"))
			return
		}
		writeJSON(w, http.StatusCreated, s.IngestFSCM(tenant(r), m))
	})

	mux.HandleFunc("/v1/fscm/active", func(w http.ResponseWriter, r *http.Request) {
		if err := require(r, "operator"); err != nil {
			forbid(w, err)
			return
		}
		at := time.Now().UTC()
		if v := r.URL.Query().Get("at"); v != "" {
			if t, e := time.Parse(time.RFC3339, v); e == nil {
				at = t
			}
		}
		writeJSON(w, http.StatusOK, s.ActiveFSCM(tenant(r), at))
	})

	mux.HandleFunc("/v1/fire-missions", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if err := require(r, "operator"); err != nil {
			forbid(w, err)
			return
		}
		writeJSON(w, http.StatusOK, s.ListFireMissions(tenant(r)))
	})

	mux.HandleFunc("/v1/fire-missions/ingest-status", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if err := require(r, "operator"); err != nil {
			forbid(w, err)
			return
		}
		var f store.FireMissionStatus
		if err := json.NewDecoder(r.Body).Decode(&f); err != nil {
			badRequest(w, err)
			return
		}
		if f.ExternalID == "" || f.Status == "" {
			badRequest(w, fmt.Errorf("external_id and status are required"))
			return
		}
		// Defensive: this endpoint records STATUS only. We never act on the
		// target coordinates beyond display/deconfliction awareness.
		writeJSON(w, http.StatusCreated, s.IngestFireMissionStatus(tenant(r), f))
	})

	mux.HandleFunc("/v1/deconfliction/check", func(w http.ResponseWriter, r *http.Request) {
		if err := require(r, "operator"); err != nil {
			forbid(w, err)
			return
		}
		lon, err1 := strconv.ParseFloat(r.URL.Query().Get("lon"), 64)
		lat, err2 := strconv.ParseFloat(r.URL.Query().Get("lat"), 64)
		if err1 != nil || err2 != nil {
			badRequest(w, fmt.Errorf("lon and lat query params are required floats"))
			return
		}
		alt := 0.0
		if v := r.URL.Query().Get("alt"); v != "" {
			alt, _ = strconv.ParseFloat(v, 64)
		}
		at := time.Now().UTC()
		if v := r.URL.Query().Get("at"); v != "" {
			if t, e := time.Parse(time.RFC3339, v); e == nil {
				at = t
			}
		}
		flags := deconflictCheck(s, tenant(r), lon, lat, alt, at)
		writeJSON(w, http.StatusOK, map[string]any{
			"advisory_only": true,
			"note":          "ADR-012: advisory awareness only — this does not block, gate, approve, or task anything.",
			"flags":         flags,
		})
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
