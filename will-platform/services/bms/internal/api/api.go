// Package api exposes the BMS HTTP surface.
//
// Routes:
//   GET    /healthz
//
//   GET    /v1/effectors
//   POST   /v1/effectors                 (admin)
//   GET    /v1/threats                   (operator+)
//   POST   /v1/threats/score             (operator+)
//   GET    /v1/engagements               (operator+)
//   POST   /v1/engagements/propose       (operator+)
//   POST   /v1/engagements/:id/approve   (admin)
//   POST   /v1/engagements/:id/abort     (admin)
//   POST   /v1/engagements/:id/complete  (admin)
//   GET    /v1/engagements/:id/timeline  (operator+) — F2T2EA stamps
//   GET    /v1/engagements/:id/aar       (auditor+)  — after-action review
//   POST   /v1/engagements/tst-approve   (admin) — TST fast-lane propose+approve
//
//   GET/POST /v1/defended-assets         (operator GET, admin POST)
//   GET/POST /v1/engagement-zones        (operator GET, admin POST)
//
// WILL is a coordinator. /approve transitions PROPOSED → EXECUTING. Only the
// effector reports actual completion via /complete. ADR-008.
package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/will-platform/bms/internal/dal"
	"github.com/will-platform/bms/internal/pairing"
	"github.com/will-platform/bms/internal/prediction"
	"github.com/will-platform/bms/internal/scoring"
	"github.com/will-platform/bms/internal/timeline"
	"github.com/will-platform/bms/internal/tst"
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

type PNTStatus string

const (
	PNTNominal           PNTStatus = "NOMINAL"
	PNTDegraded          PNTStatus = "DEGRADED"
	PNTDenied            PNTStatus = "DENIED"
	PNTSpoofedSuspected  PNTStatus = "SPOOFED_SUSPECTED"
)

type Effector struct {
	ID              string    `json:"id"`
	TenantID        string    `json:"tenant_id"`
	PluginID        string    `json:"plugin_id"`
	Kind            string    `json:"kind"`
	DisplayName     string    `json:"display_name"`
	Lat             float64   `json:"lat"`
	Lon             float64   `json:"lon"`
	MinRangeM       float64   `json:"min_range_m"`
	MaxRangeM       float64   `json:"max_range_m"`
	MinAltitudeM    float64   `json:"min_altitude_m"`
	MaxAltitudeM    float64   `json:"max_altitude_m"`
	MaxTargetSpeed  float64   `json:"max_target_speed_mps"`
	RoundsRemaining int       `json:"rounds_remaining"`
	Status          string    `json:"status"`
	PNTStatus       PNTStatus `json:"pnt_status,omitempty"`
	RFEnvironment   string    `json:"rf_environment,omitempty"`
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
	PNTStatus     PNTStatus              `json:"pnt_status,omitempty"`
	IsTST         bool                   `json:"is_tst"`
	ObservedAt    time.Time              `json:"observed_at"`
}

type Engagement struct {
	ID                 string             `json:"id"`
	TenantID           string             `json:"tenant_id"`
	ThreatID           string             `json:"threat_id"`
	EffectorID         string             `json:"effector_id"`
	Status             EngagementStatus   `json:"status"`
	ProbabilityOfKill  float64            `json:"probability_of_kill"`
	TimeToInterceptS   float64            `json:"time_to_intercept_s"`
	IsTST              bool               `json:"is_tst"`
	Timeline           timeline.Stamps    `json:"timeline"`
	ProposedAt         time.Time          `json:"proposed_at"`
	ApprovedAt         *time.Time         `json:"approved_at,omitempty"`
	CompletedAt        *time.Time         `json:"completed_at,omitempty"`
	Notes              string             `json:"notes,omitempty"`
}

// ---------- Store ----------

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

// DALStore is the optional DAL/EZ adapter; nil means DAL features are disabled.
type DALStore interface {
	ListAssets(ctx context.Context, tenantID string) ([]dal.DefendedAsset, error)
	UpsertAsset(ctx context.Context, a dal.DefendedAsset) (dal.DefendedAsset, error)
	ListZones(ctx context.Context, tenantID string) ([]dal.EngagementZone, error)
	UpsertZone(ctx context.Context, z dal.EngagementZone) (dal.EngagementZone, error)
}

// ---------- Construction ----------

type Options struct {
	Store           Store
	DAL             DALStore
	DefendedAssets  []scoring.DefendedAsset // legacy: used when DAL is nil
}

func New(opts Options) http.Handler {
	if opts.Store == nil {
		opts.Store = NewMemoryStore()
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "component": "bms"})
	})

	mountEffectorRoutes(mux, opts)
	mountThreatRoutes(mux, opts)
	mountEngagementRoutes(mux, opts)
	mountDALRoutes(mux, opts)
	mountPredictionRoutes(mux, opts)

	return mux
}

// ---------- prediction routes ----------

const (
	predictHorizonDefault = 120 * time.Second
	predictStepDefault    = 10 * time.Second
)

func mountPredictionRoutes(mux *http.ServeMux, opts Options) {
	mux.HandleFunc("/v1/predictions/tracks", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if err := require(r, "operator"); err != nil {
			forbid(w, err)
			return
		}
		threats, err := opts.Store.ListThreats(r.Context(), tenant(r))
		if err != nil {
			serverError(w, err)
			return
		}
		out := make([]map[string]any, 0, len(threats))
		for _, t := range threats {
			tr := prediction.Track{
				ID: t.ID, Lat: t.Lat, Lon: t.Lon, AltitudeM: t.AltitudeM,
				HeadingDeg: t.HeadingDeg, SpeedMps: t.SpeedMps,
				ObservedAt: t.ObservedAt, PositionSigmaM: 30,
			}
			wps := prediction.Propagate(tr, 12, predictStepDefault)
			out = append(out, map[string]any{
				"track_id": t.ID,
				"threat_class": t.ThreatClass,
				"affiliation": t.Affiliation,
				"priority_score": t.PriorityScore,
				"is_tst": t.IsTST,
				"waypoints": wps,
			})
		}
		writeJSON(w, http.StatusOK, out)
	})

	mux.HandleFunc("/v1/predictions/engagement-windows", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if err := require(r, "operator"); err != nil {
			forbid(w, err)
			return
		}
		tenantID := tenant(r)
		threats, err := opts.Store.ListThreats(r.Context(), tenantID)
		if err != nil {
			serverError(w, err)
			return
		}
		effectors, err := opts.Store.ListEffectors(r.Context(), tenantID)
		if err != nil {
			serverError(w, err)
			return
		}
		windows := make([]prediction.Window, 0, len(threats)*len(effectors))
		for _, t := range threats {
			tr := prediction.Track{
				ID: t.ID, Lat: t.Lat, Lon: t.Lon, AltitudeM: t.AltitudeM,
				HeadingDeg: t.HeadingDeg, SpeedMps: t.SpeedMps,
				ObservedAt: t.ObservedAt, PositionSigmaM: 30,
			}
			wps := prediction.Propagate(tr, 12, predictStepDefault)
			for _, e := range effectors {
				eff := prediction.Effector{
					ID: e.ID, Lat: e.Lat, Lon: e.Lon,
					MinRangeM: e.MinRangeM, MaxRangeM: e.MaxRangeM,
					MinAltitudeM: e.MinAltitudeM, MaxAltitudeM: e.MaxAltitudeM,
					MaxTargetSpeedMps: e.MaxTargetSpeed,
					RoundsRemaining: e.RoundsRemaining, Status: e.Status,
				}
				windows = append(windows, prediction.EngagementWindow(tr, eff, wps))
			}
		}
		writeJSON(w, http.StatusOK, windows)
	})

	mux.HandleFunc("/v1/predictions/coa", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if err := require(r, "operator"); err != nil {
			forbid(w, err)
			return
		}
		tenantID := tenant(r)
		threats, err := opts.Store.ListThreats(r.Context(), tenantID)
		if err != nil {
			serverError(w, err)
			return
		}
		effectors, err := opts.Store.ListEffectors(r.Context(), tenantID)
		if err != nil {
			serverError(w, err)
			return
		}
		// Re-apply kind compatibility here (the prediction package keeps the
		// rule table next to its solver but does not consume effector kind).
		liteThreats := make([]prediction.ThreatLite, 0, len(threats))
		for _, t := range threats {
			liteThreats = append(liteThreats, prediction.ThreatLite{
				ID: t.ID, PriorityScore: t.PriorityScore, ThreatClass: string(t.ThreatClass),
				Lat: t.Lat, Lon: t.Lon, AltitudeM: t.AltitudeM, SpeedMps: t.SpeedMps,
			})
		}
		liteEffectorsByThreatClass := func(cls string) []prediction.Effector {
			out := make([]prediction.Effector, 0, len(effectors))
			for _, e := range effectors {
				if !pairing.KindCompatible(pairing.EffectorKind(e.Kind), cls) {
					continue
				}
				out = append(out, prediction.Effector{
					ID: e.ID, Lat: e.Lat, Lon: e.Lon,
					MinRangeM: e.MinRangeM, MaxRangeM: e.MaxRangeM,
					MinAltitudeM: e.MinAltitudeM, MaxAltitudeM: e.MaxAltitudeM,
					MaxTargetSpeedMps: e.MaxTargetSpeed,
					RoundsRemaining: e.RoundsRemaining, Status: e.Status,
				})
			}
			return out
		}
		// Simple two-pass approach: per-threat-class compatible solver,
		// then merge in priority order. Documented heuristic.
		seenT := map[string]bool{}
		var steps []prediction.COAStep
		// Sort threats highest priority first (already handled inside COA but
		// we want a stable cross-class ordering).
		for i := range liteThreats {
			t := liteThreats[i]
			if seenT[t.ID] {
				continue
			}
			compat := liteEffectorsByThreatClass(t.ThreatClass)
			if len(compat) == 0 {
				steps = append(steps, prediction.COAStep{
					ThreatID: t.ID, EffectorID: "", ProbabilityOfKill: 0,
					Rationale: "no kind-compatible effectors for class " + t.ThreatClass,
				})
				seenT[t.ID] = true
				continue
			}
			perClass := prediction.COA(prediction.COAInput{
				Threats: []prediction.ThreatLite{t}, Effectors: compat,
			})
			steps = append(steps, perClass...)
			seenT[t.ID] = true
		}
		writeJSON(w, http.StatusOK, steps)
	})
}

// ---------- mount helpers ----------

func mountEffectorRoutes(mux *http.ServeMux, opts Options) {
	mux.HandleFunc("/v1/effectors", func(w http.ResponseWriter, r *http.Request) {
		tenantID := tenant(r)
		switch r.Method {
		case http.MethodGet:
			if err := require(r, "operator"); err != nil {
				forbid(w, err)
				return
			}
			out, err := opts.Store.ListEffectors(r.Context(), tenantID)
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
			if in.PNTStatus == "" {
				in.PNTStatus = PNTNominal
			}
			created, err := opts.Store.CreateEffector(r.Context(), in)
			if err != nil {
				badRequest(w, err)
				return
			}
			writeJSON(w, http.StatusCreated, created)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})
}

func mountThreatRoutes(mux *http.ServeMux, opts Options) {
	mux.HandleFunc("/v1/threats", func(w http.ResponseWriter, r *http.Request) {
		if err := require(r, "operator"); err != nil {
			forbid(w, err)
			return
		}
		out, err := opts.Store.ListThreats(r.Context(), tenant(r))
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
			PNTStatus   PNTStatus           `json:"pnt_status"`
		}
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			badRequest(w, err)
			return
		}
		assets := resolveAssets(r.Context(), opts, tenant(r))
		res := scoring.Score(scoring.Track{
			Affiliation: in.Affiliation, Lat: in.Lat, Lon: in.Lon,
			SpeedMps: in.SpeedMps, HeadingDeg: in.HeadingDeg, Class: in.ThreatClass,
		}, assets, scoring.DefaultWeights())

		// Confidence haircut under degraded PNT.
		if in.PNTStatus == PNTDegraded {
			res.Score *= 0.92
		}
		if in.PNTStatus == PNTSpoofedSuspected || in.PNTStatus == PNTDenied {
			res.Score *= 0.8
		}

		nearestM := nearestAssetM(in.Lat, in.Lon, assets)
		isTST := tst.IsTST(tst.Input{
			PriorityScore: res.Score, ThreatClass: string(in.ThreatClass),
			SpeedMps: in.SpeedMps, DistanceToAssetM: nearestM,
		})

		now := time.Now().UTC()
		t, err := opts.Store.UpsertThreat(r.Context(), Threat{
			TenantID: tenant(r), TrackID: in.TrackID, ThreatClass: in.ThreatClass,
			Affiliation: in.Affiliation,
			PriorityScore: res.Score, Rationale: mapAny(res.Components),
			Lat: in.Lat, Lon: in.Lon, AltitudeM: in.AltitudeM,
			SpeedMps: in.SpeedMps, HeadingDeg: in.HeadingDeg,
			PNTStatus:   pntOrDefault(in.PNTStatus),
			IsTST:       isTST,
			ObservedAt:  now,
		})
		if err != nil {
			serverError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, t)
	})
}

func mountEngagementRoutes(mux *http.ServeMux, opts Options) {
	mux.HandleFunc("/v1/engagements", func(w http.ResponseWriter, r *http.Request) {
		if err := require(r, "operator"); err != nil {
			forbid(w, err)
			return
		}
		out, err := opts.Store.ListEngagements(r.Context(), tenant(r))
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
		eng, err := proposeEngagement(r.Context(), opts, tenant(r), in.ThreatID)
		if err != nil {
			writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusCreated, eng)
	})

	mux.HandleFunc("/v1/engagements/tst-approve", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if err := require(r, "admin"); err != nil {
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
		eng, err := proposeEngagement(r.Context(), opts, tenant(r), in.ThreatID)
		if err != nil {
			writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error()})
			return
		}
		if !eng.IsTST {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "threat is not TST-eligible"})
			return
		}
		out, err := opts.Store.UpdateEngagementStatus(r.Context(), tenant(r), eng.ID, EngagementProposed, EngagementExecuting, "TST fast-lane approval")
		if err != nil {
			serverError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, out)
	})

	mux.HandleFunc("/v1/engagements/", func(w http.ResponseWriter, r *http.Request) {
		// /v1/engagements/{id}/{action|timeline|aar}
		path := strings.TrimPrefix(r.URL.Path, "/v1/engagements/")
		parts := strings.Split(path, "/")
		if len(parts) != 2 {
			http.NotFound(w, r)
			return
		}
		id, action := parts[0], parts[1]

		// GET /v1/engagements/:id/timeline
		if action == "timeline" && r.Method == http.MethodGet {
			if err := require(r, "operator"); err != nil {
				forbid(w, err)
				return
			}
			eng, err := opts.Store.GetEngagement(r.Context(), tenant(r), id)
			if errors.Is(err, ErrNotFound) {
				http.NotFound(w, r)
				return
			}
			if err != nil {
				serverError(w, err)
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{
				"engagement_id": eng.ID,
				"timeline":      eng.Timeline,
				"durations":     timeline.Compute(eng.Timeline),
			})
			return
		}

		// GET /v1/engagements/:id/aar
		if action == "aar" && r.Method == http.MethodGet {
			if err := require(r, "auditor"); err != nil {
				forbid(w, err)
				return
			}
			eng, err := opts.Store.GetEngagement(r.Context(), tenant(r), id)
			if errors.Is(err, ErrNotFound) {
				http.NotFound(w, r)
				return
			}
			if err != nil {
				serverError(w, err)
				return
			}
			// Look up threat rationale.
			rationale := map[string]any{}
			if list, _ := opts.Store.ListThreats(r.Context(), tenant(r)); list != nil {
				for _, t := range list {
					if t.ID == eng.ThreatID {
						rationale = t.Rationale
						break
					}
				}
			}
			writeJSON(w, http.StatusOK, timeline.AAR{
				EngagementID:     eng.ID,
				ThreatID:         eng.ThreatID,
				EffectorID:       eng.EffectorID,
				FinalStatus:      string(eng.Status),
				IsTST:            eng.IsTST,
				Timeline:         eng.Timeline,
				Durations:        timeline.Compute(eng.Timeline),
				ProbabilityOfKill: eng.ProbabilityOfKill,
				TimeToInterceptS:  eng.TimeToInterceptS,
				Rationale:        rationale,
				Notes:            eng.Notes,
				GeneratedAt:      time.Now().UTC(),
			})
			return
		}

		if r.Method != http.MethodPost {
			http.NotFound(w, r)
			return
		}

		var from, to EngagementStatus
		role := ""
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
		out, err := opts.Store.UpdateEngagementStatus(r.Context(), tenant(r), id, from, to, body.Notes)
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
}

func mountDALRoutes(mux *http.ServeMux, opts Options) {
	if opts.DAL == nil {
		return
	}
	mux.HandleFunc("/v1/defended-assets", func(w http.ResponseWriter, r *http.Request) {
		tenantID := tenant(r)
		switch r.Method {
		case http.MethodGet:
			if err := require(r, "operator"); err != nil {
				forbid(w, err)
				return
			}
			out, err := opts.DAL.ListAssets(r.Context(), tenantID)
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
			var in dal.DefendedAsset
			if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
				badRequest(w, err)
				return
			}
			in.TenantID = tenantID
			created, err := opts.DAL.UpsertAsset(r.Context(), in)
			if err != nil {
				badRequest(w, err)
				return
			}
			writeJSON(w, http.StatusCreated, created)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	mux.HandleFunc("/v1/engagement-zones", func(w http.ResponseWriter, r *http.Request) {
		tenantID := tenant(r)
		switch r.Method {
		case http.MethodGet:
			if err := require(r, "operator"); err != nil {
				forbid(w, err)
				return
			}
			out, err := opts.DAL.ListZones(r.Context(), tenantID)
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
			var in dal.EngagementZone
			if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
				badRequest(w, err)
				return
			}
			in.TenantID = tenantID
			created, err := opts.DAL.UpsertZone(r.Context(), in)
			if err != nil {
				badRequest(w, err)
				return
			}
			writeJSON(w, http.StatusCreated, created)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})
}

// ---------- engagement lifecycle helper ----------

func proposeEngagement(ctx context.Context, opts Options, tenantID, threatID string) (Engagement, error) {
	threats, err := opts.Store.ListThreats(ctx, tenantID)
	if err != nil {
		return Engagement{}, err
	}
	var threat *Threat
	for i := range threats {
		if threats[i].ID == threatID {
			threat = &threats[i]
			break
		}
	}
	if threat == nil {
		return Engagement{}, ErrNotFound
	}
	effectors, err := opts.Store.ListEffectors(ctx, tenantID)
	if err != nil {
		return Engagement{}, err
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
		return Engagement{}, errors.New("no compatible effector available")
	}
	now := time.Now().UTC()
	stamps := timeline.Stamps{}
	stamps = timeline.Set(stamps, "find", threat.ObservedAt)
	stamps = timeline.Set(stamps, "fix", threat.ObservedAt)
	stamps = timeline.Set(stamps, "track", threat.ObservedAt)
	stamps = timeline.Set(stamps, "target", now)
	eng := Engagement{
		TenantID: tenantID, ThreatID: threat.ID, EffectorID: match.Effector.ID,
		Status:             EngagementProposed,
		ProbabilityOfKill:  estimatePK(*threat, match),
		TimeToInterceptS:   match.SlantRangeM / 500.0,
		IsTST:              threat.IsTST,
		Timeline:           stamps,
		ProposedAt:         now,
	}
	return opts.Store.CreateEngagement(ctx, eng)
}

// ---------- helpers ----------

var (
	ErrInvalidTransition = errors.New("bms: invalid engagement state transition")
	ErrNotFound          = errors.New("bms: not found")
)

func resolveAssets(ctx context.Context, opts Options, tenantID string) []scoring.DefendedAsset {
	if opts.DAL == nil {
		return opts.DefendedAssets
	}
	out := append([]scoring.DefendedAsset{}, opts.DefendedAssets...)
	if assets, err := opts.DAL.ListAssets(ctx, tenantID); err == nil {
		for _, a := range assets {
			out = append(out, scoring.DefendedAsset{Name: a.DisplayName, Lat: a.Lat, Lon: a.Lon})
		}
	}
	return out
}

func nearestAssetM(lat, lon float64, assets []scoring.DefendedAsset) float64 {
	best := math.MaxFloat64
	for _, a := range assets {
		d := haversineM(lat, lon, a.Lat, a.Lon)
		if d < best {
			best = d
		}
	}
	if best == math.MaxFloat64 {
		return 0
	}
	return best
}

func haversineM(lat1, lon1, lat2, lon2 float64) float64 {
	const r = 6_371_000.0
	dLat := (lat2 - lat1) * math.Pi / 180
	dLon := (lon2 - lon1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return r * c
}

func pntOrDefault(p PNTStatus) PNTStatus {
	if p == "" {
		return PNTNominal
	}
	return p
}

func estimatePK(t Threat, m pairing.Match) float64 {
	rangeMid := (m.Effector.MinRangeM + m.Effector.MaxRangeM) / 2
	dist := math.Abs(m.SlantRangeM - rangeMid)
	span := (m.Effector.MaxRangeM - m.Effector.MinRangeM) / 2
	if span <= 0 {
		return 0.5
	}
	closeness := 1 - dist/span
	if closeness < 0 {
		closeness = 0
	}
	base := 0.5 + 0.4*closeness
	if t.SpeedMps <= 0 {
		return clamp01(base)
	}
	speedPenalty := t.SpeedMps / m.Effector.MaxTargetSpeedMps
	if speedPenalty > 1 {
		speedPenalty = 1
	}
	return clamp01(base * (1 - 0.2*speedPenalty))
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

// ---------- request helpers ----------

func tenant(r *http.Request) string {
	t := r.Header.Get("X-Will-Tenant")
	if t == "" {
		t = "00000000-0000-0000-0000-000000000001"
	}
	return t
}

func require(r *http.Request, minRole string) error {
	role := r.Header.Get("X-Will-Role")
	if role == "" {
		role = "admin"
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

// ---------- in-memory store ----------

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
			list[i].Timeline = timeline.Set(list[i].Timeline, "engage", now)
		case EngagementCompleted, EngagementAborted, EngagementRejected:
			list[i].CompletedAt = &now
			list[i].Timeline = timeline.Set(list[i].Timeline, "assess", now)
		}
		s.engagements[tenantID] = list
		return list[i], nil
	}
	return Engagement{}, ErrNotFound
}
