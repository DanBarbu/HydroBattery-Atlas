// Package api exposes the METOC HTTP surface. ADR-015.
//
// ADVISORY ONLY. METOC ingests weather observations/forecasts and ocean/wind
// flow fields, and answers two decision-support questions: "is this asset
// GO/CAUTION/NO_GO in these conditions?" and "where will this parcel drift?".
// There is deliberately NO route that tasks an asset, launches a sortie,
// commands an effector, or writes back to any sensor. The Lagrangian drift
// forecast predicts where something WILL go; it never directs anything.
//
//	GET  /healthz
//	POST /v1/obs/ingest                 (operator+)  structured observation
//	POST /v1/obs/metar                  (operator+)  raw METAR line -> observation
//	GET  /v1/obs                        (operator+)
//	POST /v1/forecast/ingest            (operator+)  from a weather provider
//	GET  /v1/forecast                   (operator+)
//	POST /v1/flowfield/ingest           (operator+)  ocean/wind flow sample
//	GET  /v1/flowfield                  (operator+)
//	GET  /v1/impact                     (operator+)  GO/CAUTION/NO_GO matrix
//	POST /v1/lagrangian/drift           (operator+)  parcel-drift forecast
package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/will-platform/metoc/internal/impact"
	"github.com/will-platform/metoc/internal/lagrangian"
	"github.com/will-platform/metoc/internal/metar"
	"github.com/will-platform/metoc/internal/store"
)

func New(s *store.Store) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{
			"status": "ok", "component": "metoc",
			"mode": "metoc-advisory", "adr": "ADR-015",
		})
	})

	mux.HandleFunc("/v1/obs/ingest", func(w http.ResponseWriter, r *http.Request) {
		if !mustPost(w, r) || !mustRole(w, r, "operator") {
			return
		}
		var o store.Observation
		if err := json.NewDecoder(r.Body).Decode(&o); err != nil {
			badRequest(w, err)
			return
		}
		if o.Station == "" {
			badRequest(w, fmt.Errorf("station is required"))
			return
		}
		writeJSON(w, http.StatusCreated, s.IngestObservation(tenant(r), o))
	})

	mux.HandleFunc("/v1/obs/metar", func(w http.ResponseWriter, r *http.Request) {
		if !mustPost(w, r) || !mustRole(w, r, "operator") {
			return
		}
		raw, err := io.ReadAll(io.LimitReader(r.Body, metar.MaxMessageBytes+1))
		if err != nil {
			badRequest(w, err)
			return
		}
		m, err := metar.Parse(raw, time.Now().UTC())
		if err != nil {
			badRequest(w, err)
			return
		}
		o := store.Observation{
			Station: m.Station, ObservedAt: m.ObservedAt,
			WindDirDeg: m.WindDirDeg, WindSpeedMps: m.WindSpeedMps, GustMps: m.GustMps,
			VisibilityM: m.VisibilityM, CeilingM: m.CeilingM,
			TempC: m.TempC, DewC: m.DewC, Source: "metar",
		}
		writeJSON(w, http.StatusCreated, s.IngestObservation(tenant(r), o))
	})

	mux.HandleFunc("/v1/obs", func(w http.ResponseWriter, r *http.Request) {
		if !mustGet(w, r) || !mustRole(w, r, "operator") {
			return
		}
		writeJSON(w, http.StatusOK, s.ListObservations(tenant(r)))
	})

	mux.HandleFunc("/v1/forecast/ingest", func(w http.ResponseWriter, r *http.Request) {
		if !mustPost(w, r) || !mustRole(w, r, "operator") {
			return
		}
		var f store.Forecast
		if err := json.NewDecoder(r.Body).Decode(&f); err != nil {
			badRequest(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, s.IngestForecast(tenant(r), f))
	})

	mux.HandleFunc("/v1/forecast", func(w http.ResponseWriter, r *http.Request) {
		if !mustGet(w, r) || !mustRole(w, r, "operator") {
			return
		}
		writeJSON(w, http.StatusOK, s.ListForecasts(tenant(r)))
	})

	mux.HandleFunc("/v1/flowfield/ingest", func(w http.ResponseWriter, r *http.Request) {
		if !mustPost(w, r) || !mustRole(w, r, "operator") {
			return
		}
		var fs store.FlowSample
		if err := json.NewDecoder(r.Body).Decode(&fs); err != nil {
			badRequest(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, s.IngestFlow(tenant(r), fs))
	})

	mux.HandleFunc("/v1/flowfield", func(w http.ResponseWriter, r *http.Request) {
		if !mustGet(w, r) || !mustRole(w, r, "operator") {
			return
		}
		writeJSON(w, http.StatusOK, s.ListFlow(tenant(r)))
	})

	// Impact matrix. Uses the latest observation for `station` (or the most
	// recent overall), or explicit query overrides. Advisory GO/CAUTION/NO_GO.
	mux.HandleFunc("/v1/impact", func(w http.ResponseWriter, r *http.Request) {
		if !mustGet(w, r) || !mustRole(w, r, "operator") {
			return
		}
		c := impact.Conditions{Precip: "none"}
		station := r.URL.Query().Get("station")
		if o, ok := s.LatestObservation(tenant(r), station); ok {
			c = impact.Conditions{
				CeilingM: o.CeilingM, VisibilityM: o.VisibilityM,
				WindSpeedMps: o.WindSpeedMps, GustMps: o.GustMps,
				TempC: o.TempC, Precip: orDefault(o.Precip, "none"),
				SeaState: o.SeaState, WaveHeightM: o.WaveHeightM,
			}
		}
		applyFloatQuery(r, "ceiling_m", &c.CeilingM)
		applyFloatQuery(r, "visibility_m", &c.VisibilityM)
		applyFloatQuery(r, "wind_mps", &c.WindSpeedMps)
		applyFloatQuery(r, "gust_mps", &c.GustMps)
		applyFloatQuery(r, "temp_c", &c.TempC)
		applyFloatQuery(r, "wave_m", &c.WaveHeightM)
		if v := r.URL.Query().Get("precip"); v != "" {
			c.Precip = v
		}
		if v := r.URL.Query().Get("sea_state"); v != "" {
			if n, err := strconv.Atoi(v); err == nil {
				c.SeaState = n
			}
		}
		results := make([]impact.Result, 0, len(impact.AllAssetKinds))
		for _, k := range impact.AllAssetKinds {
			results = append(results, impact.Assess(c, k))
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"advisory_only": true,
			"note":          "ADR-015: advisory operational impact only — this does not task, launch, or command anything.",
			"conditions":    c,
			"results":       results,
		})
	})

	// Lagrangian parcel-drift forecast. Predicts where a drifting object/sensor
	// WILL go; it never directs an asset there.
	mux.HandleFunc("/v1/lagrangian/drift", func(w http.ResponseWriter, r *http.Request) {
		if !mustPost(w, r) || !mustRole(w, r, "operator") {
			return
		}
		var p lagrangian.DriftParams
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			badRequest(w, err)
			return
		}
		wp, err := lagrangian.Advect(s.Field(tenant(r)), p)
		if err != nil {
			badRequest(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"advisory_only": true,
			"note":          "ADR-015: drift prediction only — describes where a parcel will drift, does not task anything.",
			"params":        p,
			"waypoints":     wp,
		})
	})

	return mux
}

func tenant(r *http.Request) string {
	t := r.Header.Get("X-Will-Tenant")
	if t == "" {
		return "00000000-0000-0000-0000-000000000001"
	}
	return t
}

func require(r *http.Request, minRole string) error {
	role := r.Header.Get("X-Will-Role")
	if role == "" {
		role = "operator"
	}
	rank := map[string]int{"viewer": 1, "operator": 2, "auditor": 2, "admin": 3, "cross_tenant_auditor": 3}
	need, ok1 := rank[minRole]
	have, ok2 := rank[role]
	if !ok1 || !ok2 || have < need {
		return fmt.Errorf("rbac: %q insufficient (need %q)", role, minRole)
	}
	return nil
}

func mustRole(w http.ResponseWriter, r *http.Request, minRole string) bool {
	if err := require(r, minRole); err != nil {
		forbid(w, err)
		return false
	}
	return true
}

func mustPost(w http.ResponseWriter, r *http.Request) bool {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return false
	}
	return true
}

func mustGet(w http.ResponseWriter, r *http.Request) bool {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return false
	}
	return true
}

func applyFloatQuery(r *http.Request, key string, dst *float64) {
	if v := r.URL.Query().Get(key); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			*dst = f
		}
	}
}

func orDefault(v, def string) string {
	if v == "" {
		return def
	}
	return v
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
func badRequest(w http.ResponseWriter, err error) {
	writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
}
func forbid(w http.ResponseWriter, err error) {
	writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
}
