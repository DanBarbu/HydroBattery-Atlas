// Package jc3iedm decodes a WILL minimal profile of JC3IEDM object/track
// records as a MIP / JC3IEDM replication gateway would emit them
// (structured JSON, not wire-level MIP binary — that is a declared
// additive follow-up, ADR-014). Defensive: size-capped, range-checked,
// hostile input never panics.
package jc3iedm

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

const MaxMessageBytes = 64 * 1024

var (
	ErrEmpty     = errors.New("jc3iedm: empty record")
	ErrTooLarge  = errors.New("jc3iedm: record exceeds max size")
	ErrMalformed = errors.New("jc3iedm: malformed record")
	ErrRange     = errors.New("jc3iedm: coordinate out of range")
)

// ObjectItem is the minimal-profile subset we consume: identity, hostility,
// dimension, a LOCATION, REPORTING-DATA and a SECURITY-CLASSIFICATION.
type ObjectItem struct {
	ObjectItemID   string `json:"object_item_id"`
	Category       string `json:"category"`     // UNIT|EQUIPMENT|FEATURE
	Name           string `json:"name"`
	Hostility      string `json:"hostility"`    // FR|HO|NE|UK|SU|AF
	Dimension      string `json:"dimension"`    // LAND|AIR|SEA_SURFACE|SUBSURFACE|SPACE
	Echelon        string `json:"echelon"`
	Location       Loc    `json:"location"`
	ReportingOrg   string `json:"reporting_org"`
	ReportedAt     string `json:"reported_at"`  // RFC3339
	Classification string `json:"classification"` // NU|RS|CO|SE (NATO) — mapped below
}

type Loc struct {
	LatDeg     float64 `json:"lat_deg"`
	LonDeg     float64 `json:"lon_deg"`
	ElevationM float64 `json:"elevation_m"`
}

// Track is the normalised output (aligns with the will.track.v0 fields the
// rest of WILL consumes).
type Track struct {
	ExternalID     string
	Callsign       string
	Hostility      string
	Dimension      string
	Echelon        string
	Lat            float64
	Lon            float64
	AltitudeM      float64
	Classification string
	ObservedAt     time.Time
	Metadata       map[string]any
}

// classMap converts JC3IEDM/NATO security codes to STANAG 4774 / RO
// markings (ADR-005). Never downgrades: an unrecognised code is treated
// as the most restrictive of the known set we map.
func classMap(code string) string {
	switch strings.ToUpper(strings.TrimSpace(code)) {
	case "NU", "UNCLAS", "":
		return "NESECRET"
	case "RS", "RESTRICTED":
		return "SECRET_DE_SERVICIU"
	case "CO", "CONFIDENTIAL":
		return "SECRET"
	case "SE", "SECRET":
		return "STRICT_SECRET"
	default:
		return "STRICT_SECRET"
	}
}

func Decode(buf []byte) (Track, error) {
	if len(buf) == 0 {
		return Track{}, ErrEmpty
	}
	if len(buf) > MaxMessageBytes {
		return Track{}, ErrTooLarge
	}
	var o ObjectItem
	if err := json.Unmarshal(buf, &o); err != nil {
		return Track{}, fmt.Errorf("%w: %v", ErrMalformed, err)
	}
	if o.ObjectItemID == "" {
		return Track{}, fmt.Errorf("%w: missing object_item_id", ErrMalformed)
	}
	if o.Location.LatDeg < -90 || o.Location.LatDeg > 90 ||
		o.Location.LonDeg < -180 || o.Location.LonDeg > 180 {
		return Track{}, ErrRange
	}
	obs := time.Now().UTC()
	if o.ReportedAt != "" {
		if t, err := time.Parse(time.RFC3339, o.ReportedAt); err == nil {
			obs = t.UTC()
		}
	}
	host := strings.ToUpper(o.Hostility)
	if host == "" {
		host = "UK"
	}
	dim := strings.ToUpper(o.Dimension)
	if dim == "" {
		dim = "LAND"
	}
	return Track{
		ExternalID:     o.ObjectItemID,
		Callsign:       firstNonEmpty(o.Name, o.ObjectItemID),
		Hostility:      host,
		Dimension:      dim,
		Echelon:        o.Echelon,
		Lat:            o.Location.LatDeg,
		Lon:            o.Location.LonDeg,
		AltitudeM:      o.Location.ElevationM,
		Classification: classMap(o.Classification),
		ObservedAt:     obs,
		Metadata: map[string]any{
			"jc3iedm_category": firstNonEmpty(o.Category, "UNIT"),
			"reporting_org":    o.ReportingOrg,
			"source":           "bc2a/jc3iedm",
		},
	}, nil
}

func firstNonEmpty(a, b string) string {
	if strings.TrimSpace(a) != "" {
		return a
	}
	return b
}
