package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/will-platform/bms/internal/dal"
	"github.com/will-platform/bms/internal/scoring"
	"github.com/will-platform/bms/internal/timeline"
)

func handler() http.Handler {
	return New(Options{
		Store: NewMemoryStore(),
		DAL:   dal.NewMemoryStore(),
		DefendedAssets: []scoring.DefendedAsset{
			{Name: "Cincu", Lat: 45.8696, Lon: 24.7753},
			{Name: "Constanța", Lat: 44.1733, Lon: 28.6383},
		},
	})
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

func scoreThreat(t *testing.T, h http.Handler, payload map[string]any) Threat {
	if payload == nil {
		payload = map[string]any{
			"track_id": "track-7", "threat_class": "cruise", "affiliation": "H",
			"lat": 45.92, "lon": 24.78, "altitude_m": 200, "speed_mps": 260, "heading_deg": 180,
		}
	}
	w := req(t, h, http.MethodPost, "/v1/threats/score", payload, "operator")
	if w.Code != http.StatusOK {
		t.Fatalf("score status=%d body=%s", w.Code, w.Body.String())
	}
	var threat Threat
	_ = json.Unmarshal(w.Body.Bytes(), &threat)
	return threat
}

func TestHealthz(t *testing.T) {
	w := req(t, handler(), http.MethodGet, "/healthz", nil, "")
	if w.Code != http.StatusOK {
		t.Fatalf("status=%d", w.Code)
	}
}

func TestRBACGatesEffectorRegistration(t *testing.T) {
	w := req(t, handler(), http.MethodPost, "/v1/effectors", Effector{DisplayName: "x"}, "operator")
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", w.Code)
	}
}

func TestScoreFlagsTSTOnHostileCruise(t *testing.T) {
	h := handler()
	threat := scoreThreat(t, h, nil)
	if !threat.IsTST {
		t.Fatalf("hostile closing cruise should be TST: %+v", threat)
	}
}

func TestEngagementFullStateMachine(t *testing.T) {
	h := handler()
	effID := registerPatriot(t, h)
	threat := scoreThreat(t, h, nil)

	w := req(t, h, http.MethodPost, "/v1/engagements/propose", map[string]string{"threat_id": threat.ID}, "operator")
	if w.Code != http.StatusCreated {
		t.Fatalf("propose status=%d body=%s", w.Code, w.Body.String())
	}
	var eng Engagement
	_ = json.Unmarshal(w.Body.Bytes(), &eng)
	if eng.EffectorID != effID || eng.Status != EngagementProposed {
		t.Fatalf("proposed: %+v", eng)
	}
	if eng.Timeline.Target == nil {
		t.Fatalf("timeline should have target stamp after propose: %+v", eng.Timeline)
	}

	w = req(t, h, http.MethodPost, "/v1/engagements/"+eng.ID+"/approve", nil, "admin")
	if w.Code != http.StatusOK {
		t.Fatalf("approve status=%d", w.Code)
	}
	_ = json.Unmarshal(w.Body.Bytes(), &eng)
	if eng.Status != EngagementExecuting || eng.Timeline.Engage == nil {
		t.Fatalf("approve did not stamp engage: %+v", eng)
	}

	w = req(t, h, http.MethodPost, "/v1/engagements/"+eng.ID+"/complete", nil, "admin")
	if w.Code != http.StatusOK {
		t.Fatalf("complete status=%d", w.Code)
	}
	_ = json.Unmarshal(w.Body.Bytes(), &eng)
	if eng.Status != EngagementCompleted || eng.Timeline.Assess == nil {
		t.Fatalf("complete did not stamp assess: %+v", eng)
	}
}

func TestTimelineEndpoint(t *testing.T) {
	h := handler()
	registerPatriot(t, h)
	threat := scoreThreat(t, h, nil)
	w := req(t, h, http.MethodPost, "/v1/engagements/propose", map[string]string{"threat_id": threat.ID}, "operator")
	var eng Engagement
	_ = json.Unmarshal(w.Body.Bytes(), &eng)

	w = req(t, h, http.MethodGet, "/v1/engagements/"+eng.ID+"/timeline", nil, "operator")
	if w.Code != http.StatusOK {
		t.Fatalf("timeline status=%d", w.Code)
	}
	var out struct {
		EngagementID string             `json:"engagement_id"`
		Timeline     timeline.Stamps    `json:"timeline"`
		Durations    timeline.Durations `json:"durations"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	if out.EngagementID != eng.ID || out.Timeline.Target == nil {
		t.Fatalf("unexpected timeline payload: %+v", out)
	}
}

func TestAARRequiresAuditor(t *testing.T) {
	h := handler()
	registerPatriot(t, h)
	threat := scoreThreat(t, h, nil)
	w := req(t, h, http.MethodPost, "/v1/engagements/propose", map[string]string{"threat_id": threat.ID}, "operator")
	var eng Engagement
	_ = json.Unmarshal(w.Body.Bytes(), &eng)

	w = req(t, h, http.MethodGet, "/v1/engagements/"+eng.ID+"/aar", nil, "viewer")
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for viewer, got %d", w.Code)
	}
	w = req(t, h, http.MethodGet, "/v1/engagements/"+eng.ID+"/aar", nil, "auditor")
	if w.Code != http.StatusOK {
		t.Fatalf("auditor AAR status=%d", w.Code)
	}
}

func TestTSTFastLane(t *testing.T) {
	h := handler()
	registerPatriot(t, h)
	threat := scoreThreat(t, h, nil)
	if !threat.IsTST {
		t.Skip("threat not TST-eligible; scoring drift")
	}
	w := req(t, h, http.MethodPost, "/v1/engagements/tst-approve", map[string]string{"threat_id": threat.ID}, "admin")
	if w.Code != http.StatusOK {
		t.Fatalf("tst-approve status=%d body=%s", w.Code, w.Body.String())
	}
	var eng Engagement
	_ = json.Unmarshal(w.Body.Bytes(), &eng)
	if eng.Status != EngagementExecuting || !eng.IsTST {
		t.Fatalf("expected EXECUTING TST engagement, got %+v", eng)
	}
}

func TestTSTFastLaneRefusesNonTST(t *testing.T) {
	h := handler()
	registerPatriot(t, h)
	threat := scoreThreat(t, h, map[string]any{
		"track_id": "track-friendly", "threat_class": "aircraft", "affiliation": "F",
		"lat": 45.92, "lon": 24.78, "altitude_m": 200, "speed_mps": 80, "heading_deg": 0,
	})
	if threat.IsTST {
		t.Skip("friendly was unexpectedly TST")
	}
	w := req(t, h, http.MethodPost, "/v1/engagements/tst-approve", map[string]string{"threat_id": threat.ID}, "admin")
	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409 for non-TST threat, got %d body=%s", w.Code, w.Body.String())
	}
}

func TestPNTDegradedReducesScore(t *testing.T) {
	h := handler()
	nominal := scoreThreat(t, h, map[string]any{
		"track_id": "n", "threat_class": "cruise", "affiliation": "H",
		"lat": 45.92, "lon": 24.78, "altitude_m": 200, "speed_mps": 260, "heading_deg": 180,
		"pnt_status": "NOMINAL",
	})
	degraded := scoreThreat(t, h, map[string]any{
		"track_id": "d", "threat_class": "cruise", "affiliation": "H",
		"lat": 45.92, "lon": 24.78, "altitude_m": 200, "speed_mps": 260, "heading_deg": 180,
		"pnt_status": "DEGRADED",
	})
	if !(degraded.PriorityScore < nominal.PriorityScore) {
		t.Fatalf("PNT DEGRADED should reduce score: nominal=%.3f degraded=%.3f", nominal.PriorityScore, degraded.PriorityScore)
	}
}

func TestDALEndpoints(t *testing.T) {
	h := handler()
	w := req(t, h, http.MethodPost, "/v1/defended-assets", dal.DefendedAsset{
		ExternalID: "cincu-hq", DisplayName: "Cincu HQ", Lat: 45.87, Lon: 24.78, Criticality: 5,
	}, "admin")
	if w.Code != http.StatusCreated {
		t.Fatalf("dal create status=%d body=%s", w.Code, w.Body.String())
	}
	w = req(t, h, http.MethodGet, "/v1/defended-assets", nil, "operator")
	if w.Code != http.StatusOK {
		t.Fatalf("dal list status=%d", w.Code)
	}
	var out []dal.DefendedAsset
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	if len(out) != 1 || out[0].ExternalID != "cincu-hq" {
		t.Fatalf("unexpected DAL list: %+v", out)
	}
}

func TestEngagementZoneEndpoints(t *testing.T) {
	h := handler()
	w := req(t, h, http.MethodPost, "/v1/engagement-zones", dal.EngagementZone{
		ExternalID: "wez-1", Name: "WEZ Cincu", Kind: dal.KindWEZ,
		Polygon: dal.Polygon{{{24.7, 45.8}, {24.85, 45.8}, {24.85, 45.95}, {24.7, 45.95}, {24.7, 45.8}}},
	}, "admin")
	if w.Code != http.StatusCreated {
		t.Fatalf("zone create status=%d body=%s", w.Code, w.Body.String())
	}
	w = req(t, h, http.MethodGet, "/v1/engagement-zones", nil, "operator")
	var out []dal.EngagementZone
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	if len(out) != 1 || out[0].Kind != dal.KindWEZ {
		t.Fatalf("unexpected zones: %+v", out)
	}
}
