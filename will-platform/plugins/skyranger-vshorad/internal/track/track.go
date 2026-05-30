// Package track builds will.track.v0 payloads for the Skyranger 35 feed.
//
// The plugin emits two track families:
//   - Detection: hostile UAS/RAM tracks from the Skyranger's radar (Build)
//   - PlatformPLI: the Skyranger mount's own friendly position (BuildPlatform)
//
// Coordinator discipline (ADR-018): no Engage/Task surface. Only Build and
// BuildPlatform are exported here; the binary has no outbound socket to the
// mount.
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

// Detection is a hostile track produced by the Skyranger's radar.
type Detection struct {
	ID         string
	Lat, Lon   float64
	AltitudeM  float64
	HeadingDeg float64
	SpeedMps   float64
	Class      string // "UAS" | "RAM" | "ROCKET" | "HELO" | ...
	Confidence float64
	ObservedAt time.Time
}

// PlatformPLI is the Skyranger mount's own platform position report.
type PlatformPLI struct {
	UnitID     string
	Lat, Lon   float64
	HeadingDeg float64
	SpeedMps   float64
	Ammo       int    // rounds remaining (advisory)
	Missiles   int    // VSHORAD missiles remaining (advisory)
	Mode       string // "READY" | "MOVING" | "MASKED"
	ObservedAt time.Time
}

// Build renders a hostile detection as a will.track.v0 track.
func Build(d Detection, tenantID, classification, sourcePrefix string) Track {
	return Track{
		Schema:         Schema,
		TrackID:        d.ID,
		TenantID:       tenantID,
		Source:         sourcePrefix + "/det/" + d.ID,
		Geometry:       Geometry{Type: "Point", Coordinates: []float64{d.Lon, d.Lat}},
		AltitudeM:      d.AltitudeM,
		HeadingDeg:     d.HeadingDeg,
		SpeedMps:       d.SpeedMps,
		Classification: classification,
		APP6DSIDC:      hostileAirSIDC(d.Class),
		ObservedAt:     orNow(d.ObservedAt).UTC().Format(time.RFC3339Nano),
		Metadata: map[string]any{
			"plugin":     "skyranger-vshorad",
			"version":    "0.1.0",
			"direction":  "ingress",
			"threat":     true,
			"cuas":       true,
			"vshorad":    true,
			"class":      d.Class,
			"confidence": d.Confidence,
		},
	}
}

// BuildPlatform renders the mount's own position as a friendly PLI track.
func BuildPlatform(p PlatformPLI, tenantID, classification, sourcePrefix string) Track {
	return Track{
		Schema:         Schema,
		TrackID:        p.UnitID,
		TenantID:       tenantID,
		Source:         sourcePrefix + "/pli/" + p.UnitID,
		Geometry:       Geometry{Type: "Point", Coordinates: []float64{p.Lon, p.Lat}},
		HeadingDeg:     p.HeadingDeg,
		SpeedMps:       p.SpeedMps,
		Classification: classification,
		APP6DSIDC:      "SFGPEWA----------", // friendly · ground · equipment · weapon · AD (placeholder)
		ObservedAt:     orNow(p.ObservedAt).UTC().Format(time.RFC3339Nano),
		Metadata: map[string]any{
			"plugin":    "skyranger-vshorad",
			"version":   "0.1.0",
			"direction": "ingress",
			"platform":  true,
			"vshorad":   true,
			"mode":      p.Mode,
			"rounds":    p.Ammo,
			"missiles":  p.Missiles,
		},
	}
}

func (t Track) JSON() ([]byte, error) { return json.Marshal(t) }

func hostileAirSIDC(class string) string {
	switch class {
	case "UAS":
		return "SHAPMFQ----------"
	case "RAM", "ROCKET", "MORTAR":
		return "SHAPWMR----------"
	case "HELO":
		return "SHAPMH-----------"
	default:
		return "SHAP-------------"
	}
}

func orNow(t time.Time) time.Time {
	if t.IsZero() {
		return time.Now()
	}
	return t
}
