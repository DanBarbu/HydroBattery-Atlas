package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/will-platform/trainer/internal/store"
)

func h() http.Handler { return New(store.New()) }

func do(t *testing.T, hh http.Handler, method, path, body, role string) *httptest.ResponseRecorder {
	t.Helper()
	r := httptest.NewRequest(method, path, bytes.NewReader([]byte(body)))
	if role != "" {
		r.Header.Set("X-Will-Role", role)
	}
	r.Header.Set("X-Will-Tenant", "t1")
	w := httptest.NewRecorder()
	hh.ServeHTTP(w, r)
	return w
}

func startRun(t *testing.T, hh http.Handler, slug string) string {
	w := do(t, hh, http.MethodPost, "/v1/runs",
		`{"scenario_slug":"`+slug+`","trainee":"op-1"}`, "operator")
	if w.Code != http.StatusCreated {
		t.Fatalf("create run %s: status=%d body=%s", slug, w.Code, w.Body.String())
	}
	var run store.Run
	_ = json.Unmarshal(w.Body.Bytes(), &run)
	return run.ID
}

func TestHealthzDeclaresExerciseIsolated(t *testing.T) {
	w := do(t, h(), http.MethodGet, "/healthz", "", "")
	if w.Code != 200 || !strings.Contains(w.Body.String(), "exercise-isolated") {
		t.Fatalf("healthz must declare exercise-isolated, got %s", w.Body.String())
	}
}

func TestCatalogueAndCurriculumGating(t *testing.T) {
	hh := h()
	w := do(t, hh, http.MethodGet, "/v1/curriculum?trainee=op-1", "", "operator")
	if w.Code != 200 {
		t.Fatalf("curriculum status=%d", w.Code)
	}
	var c struct {
		Unlocked []map[string]any `json:"unlocked"`
		Locked   []map[string]any `json:"locked"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &c)
	if len(c.Unlocked) == 0 || len(c.Locked) == 0 {
		t.Fatalf("expected a mix of locked/unlocked initially, got u=%d l=%d", len(c.Unlocked), len(c.Locked))
	}
}

func TestLockedScenarioRefusedServerSide(t *testing.T) {
	hh := h()
	// black-sea-swarm has prerequisites; a fresh trainee must be refused.
	w := do(t, hh, http.MethodPost, "/v1/runs",
		`{"scenario_slug":"black-sea-swarm","trainee":"op-1"}`, "operator")
	if w.Code != http.StatusConflict {
		t.Fatalf("locked scenario must 409, got %d", w.Code)
	}
}

func TestFullRunFlowAndProgression(t *testing.T) {
	hh := h()
	id := startRun(t, hh, "first-light")
	if w := do(t, hh, http.MethodPost, "/v1/runs/"+id+"/control", `{"action":"start"}`, "operator"); w.Code != 200 {
		t.Fatalf("start: %d %s", w.Code, w.Body.String())
	}
	body := `{"outcomes":[{"objective_id":"classify","achieved":1.0},{"objective_id":"layers","passed":true},{"objective_id":"banner","passed":true}]}`
	w := do(t, hh, http.MethodPost, "/v1/runs/"+id+"/complete", body, "admin")
	if w.Code != 200 {
		t.Fatalf("complete: %d %s", w.Code, w.Body.String())
	}
	var resp struct {
		Result struct {
			Grade        string `json:"grade"`
			BadgeAwarded string `json:"badge_awarded"`
		} `json:"result"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Result.Grade != "DISTINCTION" || resp.Result.BadgeAwarded == "" {
		t.Fatalf("perfect first-light should be DISTINCTION + badge, got %+v", resp.Result)
	}
	// Progression: cincu-gmti-drill should now be createable for op-1.
	if w := do(t, hh, http.MethodPost, "/v1/runs", `{"scenario_slug":"cincu-gmti-drill","trainee":"op-1"}`, "operator"); w.Code != http.StatusCreated {
		t.Fatalf("completing first-light should unlock cincu-gmti-drill, got %d", w.Code)
	}
	// Leaderboard reflects the completed run.
	lw := do(t, hh, http.MethodGet, "/v1/leaderboard", "", "operator")
	if !strings.Contains(lw.Body.String(), "first-light") {
		t.Fatalf("leaderboard should list the completed run, got %s", lw.Body.String())
	}
}

func TestCompleteRequiresAdmin(t *testing.T) {
	hh := h()
	id := startRun(t, hh, "first-light")
	_ = do(t, hh, http.MethodPost, "/v1/runs/"+id+"/control", `{"action":"start"}`, "operator")
	if w := do(t, hh, http.MethodPost, "/v1/runs/"+id+"/complete", `{"outcomes":[]}`, "operator"); w.Code != http.StatusForbidden {
		t.Fatalf("operator must not score a run, got %d", w.Code)
	}
}

// ADR-013 boundary assertion: there is NO route that injects into live ops.
func TestNoLiveInjectionRoutes(t *testing.T) {
	hh := h()
	for _, p := range []string{
		"/v1/threats/score",
		"/v1/engagements/propose",
		"/v1/effectors",
		"/v1/friendly-assets/report",
		"/v1/platforms/state",
		"/v1/fscm/ingest",
		"/v1/runs/inject-threat",
	} {
		w := do(t, hh, http.MethodPost, p, `{}`, "admin")
		if w.Code == http.StatusOK || w.Code == http.StatusCreated {
			t.Fatalf("trainer must not expose live-injection route %s (got %d)", p, w.Code)
		}
	}
}
