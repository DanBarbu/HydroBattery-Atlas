// Package forward turns a decoded CoT event into the v0 track payload that
// Sprint 0's WebSocket bridge consumes. The Sprint 1 contract upgrade
// (will.sensor.v1.Track) lands once the gRPC stubs are generated; until then,
// the JSON shape is identical so existing dashboards keep working unchanged.
package forward

import (
	"encoding/json"
	"time"

	"github.com/will-platform/plugins/atak-mil/internal/cot"
)

type Track struct {
	Schema         string             `json:"schema"`
	TrackID        string             `json:"track_id"`
	TenantID       string             `json:"tenant_id"`
	Source         string             `json:"source"`
	Geometry       Geometry           `json:"geometry"`
	AltitudeM      float64            `json:"altitude_m"`
	HeadingDeg     float64            `json:"heading_deg"`
	SpeedMps       float64            `json:"speed_mps"`
	Classification string             `json:"classification"`
	APP6DSIDC      string             `json:"app6d_sidc"`
	ObservedAt     string             `json:"observed_at"`
	Metadata       map[string]any     `json:"metadata"`
}

type Geometry struct {
	Type        string    `json:"type"`
	Coordinates []float64 `json:"coordinates"` // [lon, lat]
}

func FromCoT(e cot.Event, tenantID, classification, sourcePrefix string) Track {
	return Track{
		Schema:         "will.track.v0",
		TrackID:        e.UID,
		TenantID:       tenantID,
		Source:         sourcePrefix + "/" + e.UID,
		Geometry:       Geometry{Type: "Point", Coordinates: []float64{e.Lon, e.Lat}},
		AltitudeM:      e.Hae,
		HeadingDeg:     e.Course,
		SpeedMps:       e.Speed,
		Classification: classification,
		APP6DSIDC:      e.SIDC(),
		ObservedAt:     timeOrNow(e.Time).UTC().Format(time.RFC3339Nano),
		Metadata: map[string]any{
			"plugin":     "atak-mil",
			"version":    "0.1.0",
			"cot_type":   e.Type,
			"callsign":   e.Callsign,
			"group":      e.Group,
			"ce_metres":  e.Ce,
			"le_metres":  e.Le,
		},
	}
}

func (t Track) JSON() ([]byte, error) {
	return json.Marshal(t)
}

func timeOrNow(t time.Time) time.Time {
	if t.IsZero() {
		return time.Now()
	}
	return t
}
