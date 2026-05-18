package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/will-platform/ownship/internal/store"
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

func seedCorvette(t *testing.T, hh http.Handler) store.Platform {
	w := do(t, hh, http.MethodPost, "/v1/platforms/state",
		`{"external_id":"CORVETTE-1","name":"F-Vanatorul","hull_class":"mmpv_90_corvette","lat":44.10,"lon":29.10,"heading_deg":90,"speed_mps":8,"status":"UNDERWAY","emcon_state":"FULL"}`,
		"operator")
	if w.Code != http.StatusCreated {
		t.Fatalf("state status=%d body=%s", w.Code, w.Body.String())
	}
	var p store.Platform
	_ = json.Unmarshal(w.Body.Bytes(), &p)
	return p
}

func TestHealthz(t *testing.T) {
	if w := do(t, h(), http.MethodGet, "/healthz", "", ""); w.Code != 200 {
		t.Fatalf("status=%d", w.Code)
	}
}

func TestStateThenList(t *testing.T) {
	hh := h()
	seedCorvette(t, hh)
	w := do(t, hh, http.MethodGet, "/v1/platforms", "", "operator")
	var list []store.Platform
	_ = json.Unmarshal(w.Body.Bytes(), &list)
	if len(list) != 1 || list[0].Name != "F-Vanatorul" {
		t.Fatalf("unexpected list: %+v", list)
	}
}

func TestStateRejectsBadCoords(t *testing.T) {
	w := do(t, h(), http.MethodPost, "/v1/platforms/state",
		`{"external_id":"x","name":"y","lat":999,"lon":0}`, "operator")
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestStateRequiresOperator(t *testing.T) {
	w := do(t, h(), http.MethodPost, "/v1/platforms/state",
		`{"external_id":"x","name":"y","lat":1,"lon":1}`, "viewer")
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", w.Code)
	}
}

func TestCommsPutAndDegraded(t *testing.T) {
	hh := h()
	p := seedCorvette(t, hh)
	w := do(t, hh, http.MethodPut, "/v1/platforms/"+p.ID+"/comms",
		`[{"channel":"voip","status":"UP"},{"channel":"satcom","status":"DOWN"}]`, "operator")
	if w.Code != http.StatusOK {
		t.Fatalf("comms put status=%d body=%s", w.Code, w.Body.String())
	}
	w = do(t, hh, http.MethodGet, "/v1/platforms/comms-degraded", "", "operator")
	var deg []store.Platform
	_ = json.Unmarshal(w.Body.Bytes(), &deg)
	if len(deg) != 1 {
		t.Fatalf("expected 1 comms-degraded platform, got %d", len(deg))
	}
}

func TestPayloadDeclarationRequiresAdmin(t *testing.T) {
	hh := h()
	p := seedCorvette(t, hh)
	body := `[{"name":"NSM launcher","kind":"effector","payload_type":"nsm","status":"READY"}]`
	if w := do(t, hh, http.MethodPut, "/v1/platforms/"+p.ID+"/payloads", body, "operator"); w.Code != http.StatusForbidden {
		t.Fatalf("operator must not declare payloads, got %d", w.Code)
	}
	if w := do(t, hh, http.MethodPut, "/v1/platforms/"+p.ID+"/payloads", body, "admin"); w.Code != http.StatusOK {
		t.Fatalf("admin payload declaration failed: %d", w.Code)
	}
}

func TestGetUnknownPlatform404(t *testing.T) {
	if w := do(t, h(), http.MethodGet, "/v1/platforms/nope", "", "operator"); w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}
