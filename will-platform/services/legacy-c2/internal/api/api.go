// Package api exposes the Legacy C2 Bridge HTTP surface. ADR-014.
//
// Northbound (ingest, Phase 1): BC2A/ICIS treated as a sensor source.
//   POST /v1/ingest/jc3iedm     (operator+)  JC3IEDM object/track record
//   POST /v1/ingest/adatp3      (operator+)  AdatP-3 track-report message
//   GET  /v1/tracks             (operator+)  WILL-normalised legacy tracks
//
// Southbound (backwards-compat, advisory): WILL renders the fused picture
// to MIL-STD-2525D + AdatP-3 for the customer ICIS gateway to inject into
// BC2A loops. WILL never writes BC2A's DB and never commands BC2A.
//   POST /v1/southbound/render  (operator+)  render one track -> 2525D+AdatP-3
//   GET  /v1/southbound/feed    (operator+)  rolling rendered feed
//
//   GET  /healthz   declares mode: legacy-c2-bridge
//
// api_test.go::TestNoLegacyWriteOrCommandRoutes asserts no DB-write or
// command route exists.
package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/will-platform/legacy-c2/internal/adatp3"
	"github.com/will-platform/legacy-c2/internal/app6"
	"github.com/will-platform/legacy-c2/internal/jc3iedm"
	"github.com/will-platform/legacy-c2/internal/store"
)

func New(s *store.Store) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{
			"status": "ok", "component": "legacy-c2",
			"mode":  "legacy-c2-bridge",
			"north": "ingest-normalize (BC2A as sensor source)",
			"south": "advisory render (no DB write, no command)",
			"adr":   "ADR-014",
		})
	})

	mux.HandleFunc("/v1/ingest/jc3iedm", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if err := require(r, "operator"); err != nil {
			forbid(w, err)
			return
		}
		body, _ := io.ReadAll(io.LimitReader(r.Body, jc3iedm.MaxMessageBytes+1))
		dec, err := jc3iedm.Decode(body)
		if err != nil {
			badRequest(w, err)
			return
		}
		tr := s.UpsertTrack(store.Track{
			TenantID: tenant(r), ExternalID: dec.ExternalID, SourceFormat: "jc3iedm",
			Callsign: dec.Callsign, Hostility: dec.Hostility, Dimension: dec.Dimension,
			Echelon: dec.Echelon, Lat: dec.Lat, Lon: dec.Lon, AltitudeM: dec.AltitudeM,
			APP6SIDC: app6.SIDC(dec.Hostility, dec.Dimension),
			Classification: dec.Classification, ObservedAt: dec.ObservedAt,
			Metadata: dec.Metadata,
		})
		writeJSON(w, http.StatusCreated, tr)
	})

	mux.HandleFunc("/v1/ingest/adatp3", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if err := require(r, "operator"); err != nil {
			forbid(w, err)
			return
		}
		body, _ := io.ReadAll(io.LimitReader(r.Body, adatp3.MaxMessageBytes+1))
		m, err := adatp3.Parse(body)
		if err != nil {
			badRequest(w, err)
			return
		}
		tr := s.UpsertTrack(store.Track{
			TenantID: tenant(r), ExternalID: m.TrackNo, SourceFormat: "adatp3",
			Callsign: m.Callsign, Hostility: m.Hostility, Dimension: m.Dimension,
			Lat: m.Lat, Lon: m.Lon, AltitudeM: m.AltitudeM,
			APP6SIDC: app6.SIDC(m.Hostility, m.Dimension),
			Classification: classFromAdatp3(m.Classification), ObservedAt: m.TimePos,
			Metadata: map[string]any{"source": "bc2a/adatp3"},
		})
		writeJSON(w, http.StatusCreated, tr)
	})

	mux.HandleFunc("/v1/tracks", func(w http.ResponseWriter, r *http.Request) {
		if err := require(r, "operator"); err != nil {
			forbid(w, err)
			return
		}
		writeJSON(w, http.StatusOK, s.ListTracks(tenant(r)))
	})

	mux.HandleFunc("/v1/southbound/render", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if err := require(r, "operator"); err != nil {
			forbid(w, err)
			return
		}
		var in struct {
			ExternalID     string  `json:"external_id"`
			Callsign       string  `json:"callsign"`
			Hostility      string  `json:"hostility"`
			Dimension      string  `json:"dimension"`
			Lat            float64 `json:"lat"`
			Lon            float64 `json:"lon"`
			AltitudeM      float64 `json:"altitude_m"`
			Classification string  `json:"classification"`
		}
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			badRequest(w, err)
			return
		}
		if in.ExternalID == "" {
			badRequest(w, fmt.Errorf("external_id required"))
			return
		}
		sidc := app6.SIDC(in.Hostility, in.Dimension)
		text := adatp3.Render(adatp3.TrackReport{
			TrackNo: in.ExternalID, Callsign: in.Callsign,
			Lat: in.Lat, Lon: in.Lon, AltitudeM: in.AltitudeM,
			Hostility: in.Hostility, Dimension: in.Dimension,
			Classification: adatp3ClassCode(in.Classification),
			TimePos:        time.Now().UTC(),
		})
		m := s.AppendSouthbound(store.Southbound{
			TenantID: tenant(r), TrackExternalID: in.ExternalID,
			APP6SIDC: sidc, AdatP3: text,
			Classification: orDefault(in.Classification, "NESECRET"),
		})
		writeJSON(w, http.StatusCreated, map[string]any{
			"advisory":      true,
			"note":          "ADR-014: render for backwards-compat; the customer ICIS gateway injects, not WILL.",
			"app6_sidc":     sidc,
			"adatp3":        text,
			"southbound_id": m.ID,
		})
	})

	mux.HandleFunc("/v1/southbound/feed", func(w http.ResponseWriter, r *http.Request) {
		if err := require(r, "operator"); err != nil {
			forbid(w, err)
			return
		}
		writeJSON(w, http.StatusOK, s.ListSouthbound(tenant(r)))
	})

	return mux
}

// classFromAdatp3 maps an AdatP-3 CLASS code to STANAG 4774 / RO marking
// (never downgrades; ADR-005).
func classFromAdatp3(code string) string {
	switch code {
	case "RS":
		return "SECRET_DE_SERVICIU"
	case "CO":
		return "SECRET"
	case "SE":
		return "STRICT_SECRET"
	case "NU", "":
		return "NESECRET"
	default:
		return "STRICT_SECRET"
	}
}

// adatp3ClassCode is the inverse for the southbound render.
func adatp3ClassCode(c string) string {
	switch c {
	case "SECRET_DE_SERVICIU":
		return "RS"
	case "SECRET":
		return "CO"
	case "STRICT_SECRET", "STRICT_SECRET_DE_IMPORTANTA_DEOSEBITA":
		return "SE"
	default:
		return "NU"
	}
}

func orDefault(s, d string) string {
	if s == "" {
		return d
	}
	return s
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
