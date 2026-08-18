// Package api exposes the trainer HTTP surface. ADR-013.
//
// EXERCISE-isolated: there is deliberately NO route that posts a threat,
// track, engagement, or any entity into the live BMS/BFT/fires/ownship
// services. The trainer orchestrates which scenario is active and scores
// reported outcomes. api_test.go::TestNoLiveInjectionRoutes asserts this.
//
//   GET  /healthz
//   GET  /v1/scenarios                       (operator+)  full catalogue
//   GET  /v1/curriculum?trainee=             (operator+)  unlocked/locked gating
//   GET  /v1/runs                            (operator+)
//   POST /v1/runs                            (operator+)  start a run (PLANNED)
//   GET  /v1/runs/{id}                       (operator+)
//   POST /v1/runs/{id}/control               (operator+)  EXCON: start|pause|resume|abort
//   POST /v1/runs/{id}/complete              (admin)      record assessment -> score
//   GET  /v1/leaderboard                     (operator+)
package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/will-platform/trainer/internal/catalog"
	"github.com/will-platform/trainer/internal/scoring"
	"github.com/will-platform/trainer/internal/store"
)

func New(s *store.Store) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{
			"status": "ok", "component": "trainer",
			"mode": "exercise-isolated", "adr": "ADR-013",
		})
	})

	mux.HandleFunc("/v1/scenarios", func(w http.ResponseWriter, r *http.Request) {
		if err := require(r, "operator"); err != nil {
			forbid(w, err)
			return
		}
		writeJSON(w, http.StatusOK, catalog.Library)
	})

	mux.HandleFunc("/v1/curriculum", func(w http.ResponseWriter, r *http.Request) {
		if err := require(r, "operator"); err != nil {
			forbid(w, err)
			return
		}
		trainee := r.URL.Query().Get("trainee")
		if trainee == "" {
			badRequest(w, fmt.Errorf("trainee query param required"))
			return
		}
		completed := s.CompletedSlugs(tenant(r), trainee)
		writeJSON(w, http.StatusOK, map[string]any{
			"trainee":   trainee,
			"completed": completed,
			"unlocked":  catalog.Unlocked(completed),
			"locked":    catalog.Locked(completed),
		})
	})

	mux.HandleFunc("/v1/runs", func(w http.ResponseWriter, r *http.Request) {
		if err := require(r, "operator"); err != nil {
			forbid(w, err)
			return
		}
		switch r.Method {
		case http.MethodGet:
			writeJSON(w, http.StatusOK, s.List(tenant(r)))
		case http.MethodPost:
			var in struct {
				ScenarioSlug string `json:"scenario_slug"`
				Trainee      string `json:"trainee"`
			}
			if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
				badRequest(w, err)
				return
			}
			sc, ok := catalog.BySlug(in.ScenarioSlug)
			if !ok {
				badRequest(w, fmt.Errorf("unknown scenario %q", in.ScenarioSlug))
				return
			}
			if in.Trainee == "" {
				badRequest(w, fmt.Errorf("trainee required"))
				return
			}
			// Enforce prerequisite gating server-side too.
			unlocked := false
			for _, u := range catalog.Unlocked(s.CompletedSlugs(tenant(r), in.Trainee)) {
				if u.Slug == sc.Slug {
					unlocked = true
					break
				}
			}
			if !unlocked {
				writeJSON(w, http.StatusConflict, map[string]string{
					"error": "scenario locked: prerequisites not met for this trainee",
				})
				return
			}
			writeJSON(w, http.StatusCreated, s.Create(tenant(r), sc.Slug, in.Trainee))
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	mux.HandleFunc("/v1/runs/", func(w http.ResponseWriter, r *http.Request) {
		if err := require(r, "operator"); err != nil {
			forbid(w, err)
			return
		}
		path := strings.TrimPrefix(r.URL.Path, "/v1/runs/")
		parts := strings.Split(path, "/")
		id := parts[0]
		if id == "" {
			http.NotFound(w, r)
			return
		}

		if len(parts) == 1 && r.Method == http.MethodGet {
			run, ok := s.Get(tenant(r), id)
			if !ok {
				http.NotFound(w, r)
				return
			}
			writeJSON(w, http.StatusOK, run)
			return
		}

		if len(parts) == 2 && parts[1] == "control" && r.Method == http.MethodPost {
			var in struct {
				Action string `json:"action"`
			}
			if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
				badRequest(w, err)
				return
			}
			run, err := s.Transition(tenant(r), id, in.Action)
			if err != nil {
				writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, run)
			return
		}

		if len(parts) == 2 && parts[1] == "complete" && r.Method == http.MethodPost {
			if err := require(r, "admin"); err != nil {
				forbid(w, err)
				return
			}
			run, ok := s.Get(tenant(r), id)
			if !ok {
				http.NotFound(w, r)
				return
			}
			sc, ok := catalog.BySlug(run.ScenarioSlug)
			if !ok {
				badRequest(w, fmt.Errorf("scenario %q missing from catalogue", run.ScenarioSlug))
				return
			}
			var in struct {
				Outcomes []scoring.Outcome `json:"outcomes"`
			}
			if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
				badRequest(w, err)
				return
			}
			res := scoring.Assess(sc, in.Outcomes)
			out, err := s.Complete(tenant(r), id, res)
			if err != nil {
				writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"run": out, "result": res})
			return
		}
		http.NotFound(w, r)
	})

	mux.HandleFunc("/v1/leaderboard", func(w http.ResponseWriter, r *http.Request) {
		if err := require(r, "operator"); err != nil {
			forbid(w, err)
			return
		}
		writeJSON(w, http.StatusOK, s.Leaderboard(tenant(r)))
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
