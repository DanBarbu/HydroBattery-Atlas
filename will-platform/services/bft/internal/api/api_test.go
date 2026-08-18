package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/will-platform/bft/internal/store"
)

func h() http.Handler { return New(store.New()) }

func do(t *testing.T, hh http.Handler, method, path, format, body, role string) *httptest.ResponseRecorder {
	t.Helper()
	r := httptest.NewRequest(method, path, bytes.NewReader([]byte(body)))
	if format != "" {
		r.Header.Set("X-Will-Bft-Format", format)
	}
	if role != "" {
		r.Header.Set("X-Will-Role", role)
	}
	r.Header.Set("X-Will-Tenant", "t1")
	w := httptest.NewRecorder()
	hh.ServeHTTP(w, r)
	return w
}

func TestHealthz(t *testing.T) {
	if w := do(t, h(), http.MethodGet, "/healthz", "", "", ""); w.Code != 200 {
		t.Fatalf("status=%d", w.Code)
	}
}

func TestIngestWILLNativeThenList(t *testing.T) {
	hh := h()
	w := do(t, hh, http.MethodPost, "/v1/friendly-assets/report", "will_native",
		`{"external_id":"LYNX-21","callsign":"VANATOR-21","platform_type":"lynx_kf41","branch":"land","lat":45.873,"lon":24.778}`,
		"operator")
	if w.Code != http.StatusCreated {
		t.Fatalf("report status=%d body=%s", w.Code, w.Body.String())
	}
	w = do(t, hh, http.MethodGet, "/v1/friendly-assets", "", "", "operator")
	var list []store.Asset
	_ = json.Unmarshal(w.Body.Bytes(), &list)
	if len(list) != 1 || list[0].Callsign != "VANATOR-21" {
		t.Fatalf("unexpected list: %+v", list)
	}
}

func TestIngestCoTFriendly(t *testing.T) {
	hh := h()
	cot := `<event uid="ABRAMS-7" type="a-f-G-U-C-A" time="2026-05-18T09:00:00Z"><point lat="45.87" lon="24.77"/><detail><contact callsign="TUNARI-7"/><track course="180" speed="8"/></detail></event>`
	w := do(t, hh, http.MethodPost, "/v1/friendly-assets/report", "cot_friendly", cot, "operator")
	if w.Code != http.StatusCreated {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
}

func TestHostileCoTRejected422(t *testing.T) {
	hh := h()
	cot := `<event uid="X" type="a-h-A-M-F" time="2026-05-18T09:00:00Z"><point lat="45.9" lon="24.8"/></event>`
	w := do(t, hh, http.MethodPost, "/v1/friendly-assets/report", "cot_friendly", cot, "operator")
	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422 for hostile CoT, got %d", w.Code)
	}
}

func TestReportRequiresOperator(t *testing.T) {
	w := do(t, h(), http.MethodPost, "/v1/friendly-assets/report", "will_native",
		`{"external_id":"x","callsign":"y","lat":1,"lon":1}`, "viewer")
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for viewer, got %d", w.Code)
	}
}

func TestStaleEndpoint(t *testing.T) {
	hh := h()
	do(t, hh, http.MethodPost, "/v1/friendly-assets/report", "will_native",
		`{"external_id":"FRESH","callsign":"FRESH","lat":1,"lon":1}`, "operator")
	w := do(t, hh, http.MethodGet, "/v1/friendly-assets/stale?seconds=1", "", "", "operator")
	if w.Code != 200 {
		t.Fatalf("stale status=%d", w.Code)
	}
	var stale []store.Asset
	_ = json.Unmarshal(w.Body.Bytes(), &stale)
	if len(stale) != 0 {
		t.Fatalf("a just-reported asset must not be stale, got %+v", stale)
	}
}

func TestUnknownFormatRejected(t *testing.T) {
	w := do(t, h(), http.MethodPost, "/v1/friendly-assets/report", "klingon",
		`{}`, "operator")
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for unknown format, got %d", w.Code)
	}
}
