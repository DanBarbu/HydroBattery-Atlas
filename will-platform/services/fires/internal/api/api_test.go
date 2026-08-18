package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/will-platform/fires/internal/store"
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

func TestHealthzDeclaresReadOnly(t *testing.T) {
	w := do(t, h(), http.MethodGet, "/healthz", "", "")
	if w.Code != 200 || !strings.Contains(w.Body.String(), "read-only-awareness") {
		t.Fatalf("healthz must declare read-only-awareness mode, got %s", w.Body.String())
	}
}

func TestIngestFSCMThenListAndActive(t *testing.T) {
	hh := h()
	body := `{"external_id":"aca-1","measure_type":"ACA","name":"Cincu ACA","polygon":[[24.6,45.8],[24.95,45.8],[24.95,45.95],[24.6,45.95],[24.6,45.8]],"min_alt_m":300,"max_alt_m":3000}`
	if w := do(t, hh, http.MethodPost, "/v1/fscm/ingest", body, "operator"); w.Code != http.StatusCreated {
		t.Fatalf("ingest status=%d body=%s", w.Code, w.Body.String())
	}
	w := do(t, hh, http.MethodGet, "/v1/fscm", "", "operator")
	var list []store.FSCM
	_ = json.Unmarshal(w.Body.Bytes(), &list)
	if len(list) != 1 || list[0].MeasureType != "ACA" {
		t.Fatalf("unexpected fscm list: %+v", list)
	}
}

func TestFireMissionStatusIsStatusOnly(t *testing.T) {
	hh := h()
	body := `{"external_id":"fm-1","status":"IN_PROGRESS","firing_unit":"HIMARS Bn","aca_ref":"aca-1"}`
	if w := do(t, hh, http.MethodPost, "/v1/fire-missions/ingest-status", body, "operator"); w.Code != http.StatusCreated {
		t.Fatalf("ingest-status=%d body=%s", w.Code, w.Body.String())
	}
	w := do(t, hh, http.MethodGet, "/v1/fire-missions", "", "operator")
	var fms []store.FireMissionStatus
	_ = json.Unmarshal(w.Body.Bytes(), &fms)
	if len(fms) != 1 || fms[0].Status != "IN_PROGRESS" {
		t.Fatalf("unexpected fms: %+v", fms)
	}
}

func TestDeconflictionIsAdvisoryOnly(t *testing.T) {
	hh := h()
	_ = do(t, hh, http.MethodPost, "/v1/fscm/ingest",
		`{"external_id":"nfa-1","measure_type":"NFA","name":"Cincu HQ NFA","polygon":[[24.75,45.85],[24.80,45.85],[24.80,45.90],[24.75,45.90],[24.75,45.85]]}`,
		"operator")
	w := do(t, hh, http.MethodGet, "/v1/deconfliction/check?lon=24.77&lat=45.87&alt=0", "", "operator")
	if w.Code != 200 {
		t.Fatalf("status=%d", w.Code)
	}
	var resp struct {
		AdvisoryOnly bool             `json:"advisory_only"`
		Flags        []map[string]any `json:"flags"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if !resp.AdvisoryOnly {
		t.Fatal("response must declare advisory_only=true")
	}
	if len(resp.Flags) != 1 {
		t.Fatalf("expected one advisory flag inside the NFA, got %+v", resp.Flags)
	}
}

func TestNoFireMissionAuthoringRoute(t *testing.T) {
	// ADR-012 boundary assertion: there is no endpoint to create/task a
	// fire mission. Any such path must 404 (no handler), never 200/201.
	hh := h()
	for _, p := range []string{
		"/v1/fire-missions/create",
		"/v1/fire-missions",            // POST not allowed (GET only)
		"/v1/fire-missions/fm-1/task",
		"/v1/effectors",               // fires must not expose an effector surface
		"/v1/engagements/propose",
	} {
		w := do(t, hh, http.MethodPost, p, `{}`, "admin")
		if w.Code == http.StatusOK || w.Code == http.StatusCreated {
			t.Fatalf("prohibited route %s must not succeed, got %d", p, w.Code)
		}
	}
}

func TestIngestRequiresOperator(t *testing.T) {
	w := do(t, h(), http.MethodPost, "/v1/fscm/ingest",
		`{"external_id":"x","measure_type":"NFA","name":"x"}`, "viewer")
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for viewer, got %d", w.Code)
	}
}
