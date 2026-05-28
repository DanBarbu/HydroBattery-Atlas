// Package forward converts between decoded CoT events and the will.track.v0
// bus payload, in both directions:
//
//	FromCoT  TAK -> WILL (ingress; TAK treated as a sensor source)
//	ToCoT    WILL -> TAK (egress; gated upstream by the classification ceiling)
package forward

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/will-platform/tak-gateway/internal/cot"
)

const version = "0.1.0"

// Track is the will.track.v0 payload shape shared across the platform.
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

type Geometry struct {
	Type        string    `json:"type"`
	Coordinates []float64 `json:"coordinates"` // [lon, lat]
}

// FromCoT builds an ingress track from a decoded CoT event. TAK is a sensor
// source: the track is marked at the connection's configured classification
// and tagged so the picture and fusion layers know its origin.
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
		APP6DSIDC:      sidc(e),
		ObservedAt:     timeOrNow(e.Time).UTC().Format(time.RFC3339Nano),
		Metadata: map[string]any{
			"plugin":    "tak-gateway",
			"version":   version,
			"direction": "ingress",
			"cot_type":  e.Type,
			"callsign":  e.Callsign,
			"group":     e.Group,
			"ce_metres": e.Ce,
			"le_metres": e.Le,
		},
	}
}

// ToCoT renders a will.track.v0 track as a CoT event for egress to TAK. The
// original CoT type is preserved when the track came from TAK; otherwise a
// conservative unknown-ground type is synthesised.
func ToCoT(t Track) (cot.Event, error) {
	if len(t.Geometry.Coordinates) < 2 {
		return cot.Event{}, fmt.Errorf("forward: track %s missing coordinates", t.TrackID)
	}
	cotType, _ := t.Metadata["cot_type"].(string)
	if cotType == "" {
		cotType = "a-u-G" // atom, unknown affiliation, ground
	}
	callsign, _ := t.Metadata["callsign"].(string)
	group, _ := t.Metadata["group"].(string)
	obs, err := time.Parse(time.RFC3339Nano, t.ObservedAt)
	if err != nil {
		obs = time.Now().UTC()
	}
	return cot.Event{
		UID:      t.TrackID,
		Type:     cotType,
		Time:     obs,
		How:      "m-g",
		Lon:      t.Geometry.Coordinates[0],
		Lat:      t.Geometry.Coordinates[1],
		Hae:      t.AltitudeM,
		Course:   t.HeadingDeg,
		Speed:    t.SpeedMps,
		Callsign: callsign,
		Group:    group,
	}, nil
}

func (t Track) JSON() ([]byte, error) { return json.Marshal(t) }

// ParseTrack decodes a will.track.v0 payload arriving from the bus.
func ParseTrack(buf []byte) (Track, error) {
	var t Track
	if err := json.Unmarshal(buf, &t); err != nil {
		return Track{}, err
	}
	return t, nil
}

func sidc(e cot.Event) string {
	aff := e.Affiliation()
	dim := byte('G')
	if len(e.Type) >= 5 {
		switch e.Type[4] {
		case 'A':
			dim = 'A'
		case 'S':
			dim = 'S'
		case 'U':
			dim = 'U'
		}
	}
	affMap := map[string]byte{"f": 'F', "h": 'H', "n": 'N', "u": 'U', "p": 'P'}
	a, ok := affMap[aff]
	if !ok {
		a = 'P'
	}
	return fmt.Sprintf("S%c%cP-----------", a, dim)
}

func timeOrNow(t time.Time) time.Time {
	if t.IsZero() {
		return time.Now()
	}
	return t
}
