// Package track builds will.track.v0 payloads for the Skynex C-UAS feed.
//
// Skynex is a sensor source: it detects RAM/UAS threats with its 3-D acquisition
// radar and Skymaster fire control. WILL ingests those tracks for the common
// operating picture and fusion; WILL never issues engagement orders back —
// the no-tasking discipline (ADR-018) is enforced by absence: this package
// only exports Build, not Engage/Task.
package track

import (
	"encoding/json"
	"fmt"
	"time"
)

const Schema = "will.track.v0"

type Geometry struct {
	Type        string    `json:"type"`
	Coordinates []float64 `json:"coordinates"` // [lon, lat]
}

type Track struct {
	Schema         string         `json:"schema"`
	TrackID        string         `json:"track_id"`
	TenantID       string         `json:"tenant_id"`
	Source         string         `json:"source"`
	Geometry       Geometry       `json:"geometry"`
	AltitudeM      float64        `json:"altitude_m"`
	HeadingDeg     float64        `json:"heading_deg"`
	SpeedMps       float64        `json:"speed_mps"`
	Classification string         `json:"classification"`
	APP6DSIDC      string         `json:"app6d_sidc"`
	ObservedAt     string         `json:"observed_at"`
	Metadata       map[string]any `json:"metadata"`
}

// Detection is the sensor-domain view a Skynex feed presents: a hostile UAS or
// RAM threat with kinematics and a confidence score.
type Detection struct {
	ID         string
	Lat, Lon   float64
	AltitudeM  float64
	HeadingDeg float64
	SpeedMps   float64
	// Class is the Skynex classification: "UAS", "RAM", "ROCKET", "MORTAR".
	Class      string
	Confidence float64
	ObservedAt time.Time
}

// Build renders a detection as a will.track.v0 track. The marking comes from
// the gateway's CLASSIFICATION env (default NESECRET); APP-6D is derived
// hostile-air-present for UAS/RAM threats.
func Build(d Detection, tenantID, classification, sourcePrefix string) Track {
	return Track{
		Schema:         Schema,
		TrackID:        d.ID,
		TenantID:       tenantID,
		Source:         sourcePrefix + "/" + d.ID,
		Geometry:       Geometry{Type: "Point", Coordinates: []float64{d.Lon, d.Lat}},
		AltitudeM:      d.AltitudeM,
		HeadingDeg:     d.HeadingDeg,
		SpeedMps:       d.SpeedMps,
		Classification: classification,
		APP6DSIDC:      hostileAirSIDC(d.Class),
		ObservedAt:     orNow(d.ObservedAt).UTC().Format(time.RFC3339Nano),
		Metadata: map[string]any{
			"plugin":     "skynex-cuas",
			"version":    "0.1.0",
			"direction":  "ingress",
			"threat":     true,
			"cuas":       true,
			"class":      d.Class,
			"confidence": d.Confidence,
		},
	}
}

func (t Track) JSON() ([]byte, error) { return json.Marshal(t) }

// hostileAirSIDC returns an APP-6D code for a hostile air target. The
// fourth character keys the specific air class (unmanned vs RAM); the full
// mapping is owned by the APP-6D library and will be refined when that ships.
func hostileAirSIDC(class string) string {
	switch class {
	case "UAS":
		return "SHAPMFQ----------" // hostile · air · unmanned · fixed-wing (placeholder)
	case "RAM", "ROCKET", "MORTAR":
		return "SHAPWMR----------" // hostile · air · weapon · rocket (placeholder)
	default:
		return fmt.Sprintf("SHAP-----------")
	}
}

func orNow(t time.Time) time.Time {
	if t.IsZero() {
		return time.Now()
	}
	return t
}
