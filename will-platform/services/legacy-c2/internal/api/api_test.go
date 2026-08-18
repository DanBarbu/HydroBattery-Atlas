package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/will-platform/legacy-c2/internal/store"
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

func TestHealthzDeclaresBridge(t *testing.T) {
	w := do(t, h(), http.MethodGet, "/healthz", "", "")
	if w.Code != 200 || !strings.Contains(w.Body.String(), "legacy-c2-bridge") {
		t.Fatalf("healthz must declare bridge mode, got %s", w.Body.String())
	}
}

func TestIngestJC3IEDMNormalisesAndPreservesClassification(t *testing.T) {
	hh := h()
	body := `{"object_item_id":"OI-21","name":"Cp 2 Vanatori","hostility":"FR","dimension":"LAND","location":{"lat_deg":45.873,"lon_deg":24.778,"elevation_m":480},"classification":"RS"}`
	w := do(t, hh, http.MethodPost, "/v1/ingest/jc3iedm", body, "operator")
	if w.Code != http.StatusCreated {
		t.Fatalf("ingest status=%d body=%s", w.Code, w.Body.String())
	}
	var tr store.Track
	_ = json.Unmarshal(w.Body.Bytes(), &tr)
	if tr.APP6SIDC != "SFGP-----------" {
		t.Fatalf("expected friendly-ground SIDC, got %q", tr.APP6SIDC)
	}
	if tr.Classification != "SECRET_DE_SERVICIU" {
		t.Fatalf("RS must map to SECRET_DE_SERVICIU, got %q", tr.Classification)
	}
	lw := do(t, hh, http.MethodGet, "/v1/tracks", "", "operator")
	if !strings.Contains(lw.Body.String(), "OI-21") {
		t.Fatalf("normalised track should be listed, got %s", lw.Body.String())
	}
}

func TestIngestAdatP3(t *testing.T) {
	hh := h()
	msg := "MSGID/TRACKREP/WILL//\nTRACKNO/TN-1//\nAMPN/ALFA//\nPOSIT/45.87/24.78/480//\nIDENT/HO/AIR//\nCLASS/CO//"
	w := do(t, hh, http.MethodPost, "/v1/ingest/adatp3", msg, "operator")
	if w.Code != http.StatusCreated {
		t.Fatalf("adatp3 ingest status=%d body=%s", w.Code, w.Body.String())
	}
	var tr store.Track
	_ = json.Unmarshal(w.Body.Bytes(), &tr)
	if tr.APP6SIDC != "SHAP-----------" || tr.Classification != "SECRET" {
		t.Fatalf("hostile-air CO expected, got sidc=%q class=%q", tr.APP6SIDC, tr.Classification)
	}
}

func TestSouthboundRenderIsAdvisoryAndLogged(t *testing.T) {
	hh := h()
	body := `{"external_id":"TN-9","callsign":"X","hostility":"HO","dimension":"AIR","lat":45.9,"lon":24.8,"classification":"SECRET"}`
	w := do(t, hh, http.MethodPost, "/v1/southbound/render", body, "operator")
	if w.Code != http.StatusCreated {
		t.Fatalf("render status=%d body=%s", w.Code, w.Body.String())
	}
	var resp struct {
		Advisory bool   `json:"advisory"`
		SIDC     string `json:"app6_sidc"`
		AdatP3   string `json:"adatp3"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if !resp.Advisory || resp.SIDC != "SHAP-----------" || !strings.Contains(resp.AdatP3, "MSGID/TRACKREP") {
		t.Fatalf("unexpected southbound render: %+v", resp)
	}
	fw := do(t, hh, http.MethodGet, "/v1/southbound/feed", "", "operator")
	if !strings.Contains(fw.Body.String(), "TN-9") {
		t.Fatalf("southbound feed should list the render, got %s", fw.Body.String())
	}
}

func TestIngestRequiresOperator(t *testing.T) {
	w := do(t, h(), http.MethodPost, "/v1/ingest/jc3iedm",
		`{"object_item_id":"X","location":{"lat_deg":1,"lon_deg":1}}`, "viewer")
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for viewer, got %d", w.Code)
	}
}

// ADR-014 boundary: no route writes BC2A's DB or commands BC2A.
func TestNoLegacyWriteOrCommandRoutes(t *testing.T) {
	hh := h()
	for _, p := range []string{
		"/v1/bc2a/write",
		"/v1/bc2a/command",
		"/v1/bc2a/db",
		"/v1/southbound/inject",   // WILL renders; the ICIS gateway injects
		"/v1/jc3iedm/write",
	} {
		w := do(t, hh, http.MethodPost, p, `{}`, "admin")
		if w.Code == http.StatusOK || w.Code == http.StatusCreated {
			t.Fatalf("prohibited legacy route %s must not succeed (got %d)", p, w.Code)
		}
	}
}
