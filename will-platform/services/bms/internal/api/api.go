// Package api exposes the BMS HTTP surface.
//
// Routes (all tenant-scoped via X-Will-Tenant; RBAC role via X-Will-Role —
// Sprint 4 convention; OIDC replacement Sprint 6, NPKI Sprint 10):
//
//   GET    /healthz
//   GET    /v1/effectors
//   POST   /v1/effectors                 (admin) — register a new effector
//   GET    /v1/threats                   (operator+) — sorted by score desc
//   POST   /v1/threats/score             (operator+) — score an ad-hoc track
//   GET    /v1/engagements               (operator+)
//   POST   /v1/engagements/propose       (operator+) — pair best effector
//   POST   /v1/engagements/:id/approve   (admin) — operator authority
//   POST   /v1/engagements/:id/abort     (admin)
//   POST   /v1/engagements/:id/complete  (admin) — effector reports completion
//
// WILL is a coordinator. /approve transitions PROPOSED → EXECUTING. Only the
// effector reports actual completion via /complete. ADR-008.
package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/will-platform/bms/internal/pairing"
	"github.com/will-platform/bms/internal/scoring"
)

type EngagementStatus string

const (
	EngagementProposed  EngagementStatus = "PROPOSED"
	EngagementApproved  EngagementStatus = "APPROVED"
	EngagementExecuting EngagementStatus = "EXECUTING"
	EngagementCompleted EngagementStatus = "COMPLETED"
	EngagementAborted   EngagementStatus = "ABORTED"
	EngagementRejected  EngagementStatus = "REJECTED"
)

type Effector struct {
	ID              string  `json:"id"`
	TenantID        string  `json:"tenant_id"`
	PluginID        string  `json:"plugin_id"`
	Kind            string  `json:"kind"`
	DisplayName     string  `json:"display_name"`
	Lat             float64 `json:"lat"`
	Lon             float64 `json:"lon"`
	MinRangeM       float64 `json:"min_range_m"`
	MaxRangeM       float64 `json:"max_range_m"`
	MinAltitudeM    float64 `json:"min_altitude_m"`
	MaxAltitudeM    float64 `json:"max_altitude_m"`
	MaxTargetSpeed  float64 `json:"max_target_speed_mps"`
	RoundsRemaining int     `json:"rounds_remaining"`
	Status          string  `json:"status"`
}

type Threat struct {
	ID            string                 `json:"id"`
	TenantID      string                 `json:"tenant_id"`
	TrackID       string                 `json:"track_id"`
	ThreatClass   scoring.ThreatClass    `json:"threat_class"`
	Affiliation   string                 `json:"affiliation"`
	PriorityScore float64                `json:"priority_score"`
	Rationale     map[string]any         `json:"rationale"`
	Lat           float64                `json:"observed_lat"`
	Lon           float64                `json:"observed_lon"`
	AltitudeM     float64                `json:"observed_altitude_m"`
	SpeedMps      float64                `json:"observed_speed_mps"`
	HeadingDeg    float64                `json:"observed_heading_deg"`
	ObservedAt    time.Time              `json:"observed_at"`
}

type Engagement struct {
	ID                 string           `json:"id"`
	TenantID           string           `json:"tenant_id"`
	ThreatID           string           `json:"threat_id"`
	EffectorID         string           `json:"effector_id"`
	Status             EngagementStatus `json:"status"`
	ProbabilityOfKill  float64          `json:"probability_of_kill"`
	TimeToInterceptS   float64          `json:"time_to_intercept_s"`
	ProposedAt         time.Time        `json:"proposed_at"`
	ApprovedAt         *time.Time       `json:"approved_at,omitempty"`
	CompletedAt        *time.Time       `json:"completed_at,omitempty"`
	Notes              string           `json:"notes,omitempty"`
}

// Store is the abstract persistence interface; concrete implementation lives
// next to the cmd entrypoint (pgx-backed).
type Store interface {
	ListEffectors(ctx context.Context, tenantID string) ([]Effector, error)
	GetEffector(ctx context.Context, tenantID, id string) (Effector, error)
	CreateEffector(ctx context.Context, e Effector) (Effector, error)
	ListThreats(ctx context.Context, tenantID string) ([]Threat, error)
	UpsertThreat(ctx context.Context, t Threat) (Threat, error)
	ListEngagements(ctx context.Context, tenantID string) ([]Engagement, error)
	GetEngagement(ctx context.Context, tenantID, id string) (Engagement, error)
	CreateEngagement(ctx context.Context, e Engagement) (Engagement, error)
	UpdateEngagementStatus(ctx context.Context, tenantID, id string, from, to EngagementStatus, notes string) (Engagement, error)
}

func New(store Store, defendedAssets []scoring.DefendedAsset) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "component": "bms"})
	})

	mux.HandleFunc("/v1/effectors", func(w http.ResponseWriter, r *http.Request) {
		tenantID := tenant(r)
		switch r.Method {
		case http.MethodGet:
			if err := require(r, "operator"); err != nil {
				forbid(w, err)
				return
			}
			out, err := store.ListEffectors(r.Context(), tenantID)
			if err != nil {
				serverError(w, err)
				return
			}
			writeJSON(w, http.StatusOK, out)
		case http.MethodPost:
			if err := require(r, "admin"); err != nil {
				forbid(w, err)
				return
			}
			var in Effector
			if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
				badRequest(w, err)
				return
			}
			in.TenantID = tenantID
			if in.Status == "" {
				in.Status = "READY"
			}
			created, err := store.CreateEffector(r.Context(), in)
			if err != nil {
				badRequest(w, err)
				return
			}
			writeJSON(w, http.StatusCreated, created)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	mux.HandleFunc("/v1/threats", func(w http.ResponseWriter, r *http.Request) {
		if err := require(r, "operator"); err != nil {
			forbid(w, err)
			return
		}
		out, err := store.ListThreats(r.Context(), tenant(r))
		if err != nil {
			serverError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, out)
	})

	mux.HandleFunc("/v1/threats/score", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if err := require(r, "operator"); err != nil {
			forbid(w, err)
			return
		}
		var in struct {
			TrackID     string              `json:"track_id"`
			ThreatClass scoring.ThreatClass `json:"threat_class"`
			Affiliation string              `json:"affiliation"`
			Lat         float64             `json:"lat"`
			Lon         float64             `json:"lon"`
			AltitudeM   float64             `json:"altitude_m"`
			SpeedMps    float64             `json:"speed_mps"`
			HeadingDeg  float64             `json:"heading_deg"`
		}
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			badRequest(w, err)
			return
		}
		res := scoring.Score(scoring.Track{
			Affiliation: in.Affiliation, Lat: in.Lat, Lon: in.Lon,
			SpeedMps: in.SpeedMps, HeadingDeg: in.HeadingDeg, Class: in.ThreatClass,
		}, defendedAssets, scoring.DefaultWeights())

		t, err := store.UpsertThreat(r.Context(), Threat{
			TenantID: tenant(r), TrackID: in.TrackID, ThreatClass: in.ThreatClass,
			Affiliation: in.Affiliation,
			PriorityScore: res.Score, Rationale: mapAny(res.Components),
			Lat: in.Lat, Lon: in.Lon, AltitudeM: in.AltitudeM,
			SpeedMps: in.SpeedMps, HeadingDeg: in.HeadingDeg,
			ObservedAt: time.Now().UTC(),
		})
		if err != nil {
			serverError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, t)
	})

	mux.HandleFunc("/v1/engagements", func(w http.ResponseWriter, r *http.Request) {
		if err := require(r, "operator"); err != nil {
			forbid(w, err)
			return
		}
		out, err := store.ListEngagements(r.Context(), tenant(r))
		if err != nil {
			serverError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, out)
	})

	mux.HandleFunc("/v1/engagements/propose", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if err := require(r, "operator"); err != nil {
			forbid(w, err)
			return
		}
		var in struct {
			ThreatID string `json:"threat_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			badRequest(w, err)
			return
		}
		tenantID := tenant(r)
		threats, err := store.ListThreats(r.Context(), tenantID)
		if err != nil {
			serverError(w, err)
			return
		}
		var threat *Threat
		for i := range threats {
			if threats[i].ID == in.ThreatID {
				threat = &threats[i]
				break
			}
		}
		if threat == nil {
			http.NotFound(w, r)
			return
		}
		effectors, err := store.ListEffectors(r.Context(), tenantID)
		if err != nil {
			serverError(w, err)
			return
		}
		candidates := make([]pairing.Effector, 0, len(effectors))
		for _, e := range effectors {
			candidates = append(candidates, pairing.Effector{
				ID: e.ID, Kind: pairing.EffectorKind(e.Kind), Status: e.Status,
				Lat: e.Lat, Lon: e.Lon,
				MinRangeM: e.MinRangeM, MaxRangeM: e.MaxRangeM,
				MinAltitudeM: e.MinAltitudeM, MaxAltitudeM: e.MaxAltitudeM,
				MaxTargetSpeedMps: e.MaxTargetSpeed, RoundsRemaining: e.RoundsRemaining,
			})
		}
		match, ok := pairing.Best(pairing.Target{
			Lat: threat.Lat, Lon: threat.Lon, AltitudeM: threat.AltitudeM,
			SpeedMps: threat.SpeedMps, ThreatClass: string(threat.ThreatClass),
		}, candidates)
		if !ok {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "no compatible effector available"})
			return
		}
		eng := Engagement{
			TenantID: tenantID, ThreatID: threat.ID, EffectorID: match.Effector.ID,
			Status:             EngagementProposed,
			ProbabilityOfKill:  estimatePK(*threat, match),
			TimeToInterceptS:   match.SlantRangeM / 500.0, // rough; effector refines on Accept
			ProposedAt:         time.Now().UTC(),
		}
		created, err := store.CreateEngagement(r.Context(), eng)
		if err != nil {
			serverError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, created)
	})

	mux.HandleFunc("/v1/engagements/", func(w http.ResponseWriter, r *http.Request) {
		// /v1/engagements/{id}/{action}
		path := strings.TrimPrefix(r.URL.Path, "/v1/engagements/")
		parts := strings.Split(path, "/")
		if len(parts) != 2 || r.Method != http.MethodPost {
			http.NotFound(w, r)
			return
		}
		id, action := parts[0], parts[1]
		var (
			from, to EngagementStatus
			role     string
		)
		switch action {
		case "approve":
			from, to, role = EngagementProposed, EngagementExecuting, "admin"
		case "abort":
			from, to, role = EngagementExecuting, EngagementAborted, "admin"
		case "complete":
			from, to, role = EngagementExecuting, EngagementCompleted, "admin"
		default:
			http.NotFound(w, r)
			return
		}
		if err := require(r, role); err != nil {
			forbid(w, err)
			return
		}
		var body struct {
			Notes string `json:"notes,omitempty"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		out, err := store.UpdateEngagementStatus(r.Context(), tenant(r), id, from, to, body.Notes)
		if errors.Is(err, ErrInvalidTransition) {
			http.Error(w, err.Error(), http.StatusConflict)
			return
		}
		if errors.Is(err, ErrNotFound) {
			http.NotFound(w, r)
			return
		}
		if err != nil {
			serverError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, out)
	})

	return mux
}

var (
	ErrInvalidTransition = errors.New("bms: invalid engagement state transition")
	ErrNotFound          = errors.New("bms: not found")
)

func estimatePK(t Threat, m pairing.Match) float64 {
	// Publicly-documented placeholder: higher PK when target is inside the
	// sweet spot of the engagement envelope (around the middle of the range).
	rangeMid := (m.Effector.MinRangeM + m.Effector.MaxRangeM) / 2
	dist := absFloat(m.SlantRangeM - rangeMid)
	span := (m.Effector.MaxRangeM - m.Effector.MinRangeM) / 2
	if span <= 0 {
		return 0.5
	}
	closeness := 1 - dist/span
	if closeness < 0 {
		closeness = 0
	}
	base := 0.5 + 0.4*closeness
	// Slower targets are easier. Saturate.
	if t.SpeedMps <= 0 {
		return clamp01(base)
	}
	speedPenalty := t.SpeedMps / m.Effector.MaxTargetSpeedMps
	if speedPenalty > 1 {
		speedPenalty = 1
	}
	return clamp01(base * (1 - 0.2*speedPenalty))
}

func absFloat(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}

func clamp01(x float64) float64 {
	if x < 0 {
		return 0
	}
	if x > 1 {
		return 1
	}
	return x
}

// ---------- middleware helpers ----------

func tenant(r *http.Request) string {
	t := r.Header.Get("X-Will-Tenant")
	if t == "" {
		t = "00000000-0000-0000-0000-000000000001"
	}
	return t
}

// require enforces the Sprint 4 RBAC role catalogue using X-Will-Role.
// minRole = "operator" means viewer is rejected. "admin" rejects operator too.
func require(r *http.Request, minRole string) error {
	role := r.Header.Get("X-Will-Role")
	if role == "" {
		role = "admin" // dev convenience; lock down at gateway in prod
	}
	rank := map[string]int{"viewer": 1, "operator": 2, "auditor": 2, "admin": 3, "cross_tenant_auditor": 3}
	need, ok1 := rank[minRole]
	have, ok2 := rank[role]
	if !ok1 || !ok2 || have < need {
		return fmt.Errorf("rbac: %q role insufficient (need %q)", role, minRole)
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func badRequest(w http.ResponseWriter, err error)  { writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()}) }
func serverError(w http.ResponseWriter, err error) { writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()}) }
func forbid(w http.ResponseWriter, err error)      { writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()}) }

func mapAny(in map[string]float64) map[string]any {
	out := map[string]any{}
	for k, v := range in {
		out[k] = v
	}
	return out
}

// ---------- in-memory store for tests and the demo run ----------

// MemoryStore is a goroutine-safe Store. The production deployment swaps this
// for a pgx-backed implementation in cmd/bms/main.go.
type MemoryStore struct {
	mu          sync.Mutex
	effectors   map[string][]Effector
	threats     map[string][]Threat
	engagements map[string][]Engagement
	idCounter   int
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		effectors: map[string][]Effector{}, threats: map[string][]Threat{}, engagements: map[string][]Engagement{},
	}
}

func (s *MemoryStore) nextID(prefix string) string {
	s.idCounter++
	return fmt.Sprintf("%s-%d", prefix, s.idCounter)
}

func (s *MemoryStore) ListEffectors(_ context.Context, tenantID string) ([]Effector, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]Effector{}, s.effectors[tenantID]...), nil
}
func (s *MemoryStore) GetEffector(_ context.Context, tenantID, id string) (Effector, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, e := range s.effectors[tenantID] {
		if e.ID == id {
			return e, nil
		}
	}
	return Effector{}, ErrNotFound
}
func (s *MemoryStore) CreateEffector(_ context.Context, e Effector) (Effector, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if e.ID == "" {
		e.ID = s.nextID("eff")
	}
	s.effectors[e.TenantID] = append(s.effectors[e.TenantID], e)
	return e, nil
}
func (s *MemoryStore) ListThreats(_ context.Context, tenantID string) ([]Threat, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]Threat{}, s.threats[tenantID]...), nil
}
func (s *MemoryStore) UpsertThreat(_ context.Context, t Threat) (Threat, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	existing := s.threats[t.TenantID]
	for i := range existing {
		if existing[i].TrackID == t.TrackID {
			t.ID = existing[i].ID
			existing[i] = t
			s.threats[t.TenantID] = existing
			return t, nil
		}
	}
	t.ID = s.nextID("thr")
	s.threats[t.TenantID] = append(existing, t)
	return t, nil
}
func (s *MemoryStore) ListEngagements(_ context.Context, tenantID string) ([]Engagement, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]Engagement{}, s.engagements[tenantID]...), nil
}
func (s *MemoryStore) GetEngagement(_ context.Context, tenantID, id string) (Engagement, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, e := range s.engagements[tenantID] {
		if e.ID == id {
			return e, nil
		}
	}
	return Engagement{}, ErrNotFound
}
func (s *MemoryStore) CreateEngagement(_ context.Context, e Engagement) (Engagement, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if e.ID == "" {
		e.ID = s.nextID("eng")
	}
	s.engagements[e.TenantID] = append(s.engagements[e.TenantID], e)
	return e, nil
}
func (s *MemoryStore) UpdateEngagementStatus(_ context.Context, tenantID, id string, from, to EngagementStatus, notes string) (Engagement, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	list := s.engagements[tenantID]
	for i := range list {
		if list[i].ID != id {
			continue
		}
		if list[i].Status != from {
			return Engagement{}, ErrInvalidTransition
		}
		list[i].Status = to
		if notes != "" {
			list[i].Notes = notes
		}
		now := time.Now().UTC()
		switch to {
		case EngagementExecuting:
			list[i].ApprovedAt = &now
		case EngagementCompleted, EngagementAborted, EngagementRejected:
			list[i].CompletedAt = &now
		}
		s.engagements[tenantID] = list
		return list[i], nil
	}
	return Engagement{}, ErrNotFound
}
