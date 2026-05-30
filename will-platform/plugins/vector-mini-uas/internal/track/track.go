// Package track builds will.track.v0 payloads for Quantum Systems Vector and
// Scorpion Class I Mini UAS. Vector is a friendly ISR asset, so this plugin
// emits PLATFORM PLI (friendly air), not threat detections.
//
// Coordinator discipline (ADR-018): no flight tasking from WILL. Only
// Build is exported; the plugin has no Engage/Task/Command surface and no
// outbound socket to the Vector ground station.
package track

import (
	"encoding/json"
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

// Telemetry is the per-tick view a Vector ground station / MAVLink stream
// presents: position + attitude + mission state + payload state.
type Telemetry struct {
	UnitID      string
	Variant     string // "Vector" | "Scorpion"
	Lat, Lon    float64
	AltitudeM   float64
	HeadingDeg  float64
	SpeedMps    float64
	BatteryPct  float64 // 0-100
	MissionMode string  // "AUTO" | "LOITER" | "RTL" | "MANUAL"
	VideoURL    string  // advisory; may be empty when no payload stream
	ObservedAt  time.Time
}

// Build renders telemetry as a friendly UAS PLI track.
func Build(t Telemetry, tenantID, classification, sourcePrefix string) Track {
	return Track{
		Schema:         Schema,
		TrackID:        t.UnitID,
		TenantID:       tenantID,
		Source:         sourcePrefix + "/" + t.UnitID,
		Geometry:       Geometry{Type: "Point", Coordinates: []float64{t.Lon, t.Lat}},
		AltitudeM:      t.AltitudeM,
		HeadingDeg:     t.HeadingDeg,
		SpeedMps:       t.SpeedMps,
		Classification: classification,
		APP6DSIDC:      friendlyUASSIDC(t.Variant),
		ObservedAt:     orNow(t.ObservedAt).UTC().Format(time.RFC3339Nano),
		Metadata: map[string]any{
			"plugin":       "vector-mini-uas",
			"version":      "0.1.0",
			"direction":    "ingress",
			"platform":     true,
			"unmanned":     true,
			"isr":          true,
			"variant":      t.Variant,
			"mission_mode": t.MissionMode,
			"battery_pct":  t.BatteryPct,
			"video_url":    t.VideoURL,
		},
	}
}

func (t Track) JSON() ([]byte, error) { return json.Marshal(t) }

// friendlyUASSIDC: friendly · air · present · unmanned. Placeholder pending
// the APP-6D library; the variant is recorded in metadata.
func friendlyUASSIDC(variant string) string {
	switch variant {
	case "Scorpion":
		return "SFAPMFU----------" // friendly · air · unmanned · munition variant
	default: // Vector
		return "SFAPMFQ----------" // friendly · air · unmanned · fixed-wing
	}
}

func orNow(t time.Time) time.Time {
	if t.IsZero() {
		return time.Now()
	}
	return t
}
