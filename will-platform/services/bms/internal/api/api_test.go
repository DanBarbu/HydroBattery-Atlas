package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/will-platform/bms/internal/scoring"
)

func handler() http.Handler {
	return New(NewMemoryStore(), []scoring.DefendedAsset{{Name: "Cincu", Lat: 45.8696, Lon: 24.7753}})
}

func req(t *testing.T, h http.Handler, method, path string, body any, role string) *httptest.ResponseRecorder {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	r := httptest.NewRequest(method, path, &buf)
	r.Header.Set("X-Will-Role", role)
	r.Header.Set("X-Will-Tenant", "tenant-x")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func registerPatriot(t *testing.T, h http.Handler) string {
	w := req(t, h, http.MethodPost, "/v1/effectors", Effector{
		PluginID: "sam-battery-mock", Kind: "sam_area", DisplayName: "Patriot Bn 1",
		Lat: 45.87, Lon: 24.78,
		MinRangeM: 3000, MaxRangeM: 80_000, MinAltitudeM: 50, MaxAltitudeM: 25_000,
		MaxTargetSpeed: 2400, RoundsRemaining: 8, Status: "READY",
	}, "admin")
	if w.Code != http.StatusCreated {
		t.Fatalf("register effector status=%d body=%s", w.Code, w.Body.String())
	}
	var e Effector
	_ = json.Unmarshal(w.Body.Bytes(), &e)
	return e.ID
}

func scoreThreat(t *testing.T, h http.Handler) string {
	w := req(t, h, http.MethodPost, "/v1/threats/score", map[string]any{
		"track_id": "track-7", "threat_class": "cruise", "affiliation": "H",
		"lat": 45.92, "lon": 24.78, "altitude_m": 200, "speed_mps": 260, "heading_deg": 180,
	}, "operator")
	if w.Code != http.StatusOK {
		t.Fatalf("score status=%d body=%s", w.Code, w.Body.String())
	}
	var threat Threat
	_ = json.Unmarshal(w.Body.Bytes(), &threat)
	return threat.ID
}

func TestHealthz(t *testing.T) {
	w := req(t, handler(), http.MethodGet, "/healthz", nil, "")
	if w.Code != http.StatusOK {
		t.Fatalf("status=%d", w.Code)
	}
}

func TestRBACGatesEffectorRegistration(t *testing.T) {
	h := handler()
	w := req(t, h, http.MethodPost, "/v1/effectors", Effector{DisplayName: "x"}, "operator")
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for operator on effector POST, got %d", w.Code)
	}
}

func TestScoreThreatPersistsAndSorts(t *testing.T) {
	h := handler()
	scoreThreat(t, h)
	w := req(t, h, http.MethodGet, "/v1/threats", nil, "operator")
	if w.Code != http.StatusOK {
		t.Fatalf("list threats status=%d", w.Code)
	}
	var threats []Threat
	_ = json.Unmarshal(w.Body.Bytes(), &threats)
	if len(threats) != 1 || threats[0].PriorityScore <= 0 {
		t.Fatalf("unexpected threats: %+v", threats)
	}
}

func TestEngagementFullStateMachine(t *testing.T) {
	h := handler()
	effID := registerPatriot(t, h)
	threatID := scoreThreat(t, h)

	w := req(t, h, http.MethodPost, "/v1/engagements/propose", map[string]string{"threat_id": threatID}, "operator")
	if w.Code != http.StatusCreated {
		t.Fatalf("propose status=%d body=%s", w.Code, w.Body.String())
	}
	var eng Engagement
	_ = json.Unmarshal(w.Body.Bytes(), &eng)
	if eng.EffectorID != effID || eng.Status != EngagementProposed {
		t.Fatalf("unexpected proposed engagement: %+v", eng)
	}

	// Approve.
	w = req(t, h, http.MethodPost, "/v1/engagements/"+eng.ID+"/approve", nil, "admin")
	if w.Code != http.StatusOK {
		t.Fatalf("approve status=%d body=%s", w.Code, w.Body.String())
	}
	_ = json.Unmarshal(w.Body.Bytes(), &eng)
	if eng.Status != EngagementExecuting || eng.ApprovedAt == nil {
		t.Fatalf("approve did not transition properly: %+v", eng)
	}

	// Complete (effector report).
	w = req(t, h, http.MethodPost, "/v1/engagements/"+eng.ID+"/complete", nil, "admin")
	if w.Code != http.StatusOK {
		t.Fatalf("complete status=%d", w.Code)
	}
	_ = json.Unmarshal(w.Body.Bytes(), &eng)
	if eng.Status != EngagementCompleted || eng.CompletedAt == nil {
		t.Fatalf("complete did not finalise: %+v", eng)
	}
}

func TestRejectInvalidTransition(t *testing.T) {
	h := handler()
	registerPatriot(t, h)
	threatID := scoreThreat(t, h)
	w := req(t, h, http.MethodPost, "/v1/engagements/propose", map[string]string{"threat_id": threatID}, "operator")
	var eng Engagement
	_ = json.Unmarshal(w.Body.Bytes(), &eng)
	// Skip approve, go straight to complete — must fail.
	w = req(t, h, http.MethodPost, "/v1/engagements/"+eng.ID+"/complete", nil, "admin")
	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409 on invalid transition, got %d", w.Code)
	}
}

func TestProposeRejectsWhenNoEffectorCompatible(t *testing.T) {
	h := handler()
	// Register only a C-UAS; threat is a cruise missile.
	w := req(t, h, http.MethodPost, "/v1/effectors", Effector{
		PluginID: "x", Kind: "c_uas", DisplayName: "C-UAS-A",
		Lat: 45.87, Lon: 24.78,
		MinRangeM: 50, MaxRangeM: 2500, MinAltitudeM: 0, MaxAltitudeM: 600,
		MaxTargetSpeed: 60, RoundsRemaining: 100, Status: "READY",
	}, "admin")
	if w.Code != http.StatusCreated {
		t.Fatalf("register status=%d", w.Code)
	}
	threatID := scoreThreat(t, h)
	w = req(t, h, http.MethodPost, "/v1/engagements/propose", map[string]string{"threat_id": threatID}, "operator")
	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409 with no compatible effector, got %d", w.Code)
	}
}
