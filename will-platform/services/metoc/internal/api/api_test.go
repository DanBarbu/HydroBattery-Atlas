package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/will-platform/metoc/internal/store"
)

func srv() http.Handler { return New(store.New()) }

func do(t *testing.T, h http.Handler, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("X-Will-Role", "operator")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestHealthzMode(t *testing.T) {
	rec := do(t, srv(), http.MethodGet, "/healthz", "")
	var m map[string]string
	_ = json.Unmarshal(rec.Body.Bytes(), &m)
	if m["mode"] != "metoc-advisory" {
		t.Fatalf("want metoc-advisory, got %q", m["mode"])
	}
}

func TestIngestMetarThenImpact(t *testing.T) {
	h := srv()
	// Fog / low ceiling METAR for Cincu (LRCV).
	raw := "LRCV 221200Z 18003KT 0800 BKN001 02/02 Q1013"
	if rec := do(t, h, http.MethodPost, "/v1/obs/metar", raw); rec.Code != http.StatusCreated {
		t.Fatalf("metar ingest: %d %s", rec.Code, rec.Body.String())
	}
	rec := do(t, h, http.MethodGet, "/v1/impact?station=LRCV", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("impact: %d", rec.Code)
	}
	var resp struct {
		AdvisoryOnly bool `json:"advisory_only"`
		Results      []struct {
			AssetKind string `json:"asset_kind"`
			Status    string `json:"status"`
		} `json:"results"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	if !resp.AdvisoryOnly {
		t.Fatal("impact must be flagged advisory_only")
	}
	got := map[string]string{}
	for _, r := range resp.Results {
		got[r.AssetKind] = r.Status
	}
	if got["air_intercept"] != "NO_GO" {
		t.Errorf("air_intercept should be NO_GO in fog, got %s", got["air_intercept"])
	}
	if got["sam_area"] != "GO" {
		t.Errorf("all-weather sam_area should be GO, got %s", got["sam_area"])
	}
}

func TestLagrangianDrift(t *testing.T) {
	rec := do(t, srv(), http.MethodPost, "/v1/lagrangian/drift",
		`{"lat":44.0,"lon":29.5,"duration_s":3600,"step_s":600}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("drift: %d %s", rec.Code, rec.Body.String())
	}
	var resp struct {
		AdvisoryOnly bool `json:"advisory_only"`
		Waypoints    []struct {
			TOffsetS float64 `json:"t_offset_s"`
		} `json:"waypoints"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	if !resp.AdvisoryOnly {
		t.Fatal("drift must be flagged advisory_only")
	}
	if len(resp.Waypoints) < 2 {
		t.Fatalf("want a trajectory, got %d waypoints", len(resp.Waypoints))
	}
}

func TestRBACViewerCannotIngest(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/v1/obs/ingest", strings.NewReader(`{"station":"LRCV"}`))
	req.Header.Set("X-Will-Role", "viewer")
	rec := httptest.NewRecorder()
	srv().ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("viewer ingest should be 403, got %d", rec.Code)
	}
}

// TestNoTaskingRoutes asserts the METOC boundary (ADR-015): there is no route
// that tasks an asset, launches, commands an effector, or writes to a sensor.
// Every mutating route is an *ingest* (data in) or an advisory read; nothing
// here actions anything in the real world.
func TestNoTaskingRoutes(t *testing.T) {
	h := srv()
	forbidden := []struct{ method, path string }{
		{http.MethodPost, "/v1/task"},
		{http.MethodPost, "/v1/launch"},
		{http.MethodPost, "/v1/command"},
		{http.MethodPost, "/v1/effector/fire"},
		{http.MethodPost, "/v1/sortie"},
		{http.MethodPost, "/v1/lagrangian/dispatch"},
		{http.MethodPost, "/v1/obs/command"},
	}
	for _, f := range forbidden {
		rec := do(t, h, f.method, f.path, "{}")
		if rec.Code != http.StatusNotFound {
			t.Errorf("tasking-style route %s %s must not exist (got %d)", f.method, f.path, rec.Code)
		}
	}
}
