// Package track builds will.track.v0 payloads for Rheinmetall Lynx KF41 IFVs.
//
// The plugin emits friendly tracked-IFV PLI plus a compact vehicle health
// summary (fuel, engine, comms, crew, advisory ammo counts). Coordinator
// discipline (ADR-018): no turret control, no fire-control access, no
// ammunition release path — Build is the only exported track-producing
// function and the plugin has no outbound socket to the IFV's vehicle bus.
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

// CrewState is the crew-tablet view of a single Lynx.
type CrewState string

const (
	CrewMounted    CrewState = "MOUNTED"
	CrewDismounted CrewState = "DISMOUNTED"
)

// Movement is the high-level march state reported by the crew or inferred
// from kinematics.
type Movement string

const (
	MoveRoute   Movement = "ROUTE"
	MoveHalt    Movement = "HALT"
	MoveContact Movement = "CONTACT"
)

// PlatformPLI is the Lynx KF41 platform position + vehicle health summary.
// Advisory ammo counts are present so the operator picture is complete; they
// are NOT a fire-control surface (the FCS is the vendor's, not WILL's).
type PlatformPLI struct {
	UnitID       string
	Callsign     string
	Lat, Lon     float64
	AltitudeM    float64
	HeadingDeg   float64
	SpeedMps     float64
	FuelPct      float64
	EngineStatus string // "OK" | "DEGRADED" | "DOWN"
	CommsStatus  string // "OK" | "DEGRADED" | "LOST"
	CrewSize     int    // dismount-capable seats occupied
	Crew         CrewState
	Movement     Movement
	AmmoMain     int // 30 mm rounds (advisory)
	AmmoCoax     int // 7.62 coax rounds (advisory)
	AmmoSpike    int // ATGM rounds (advisory)
	ObservedAt   time.Time
}

// Build renders the platform PLI as a friendly tracked-IFV track.
func Build(p PlatformPLI, tenantID, classification, sourcePrefix string) Track {
	return Track{
		Schema:         Schema,
		TrackID:        p.UnitID,
		TenantID:       tenantID,
		Source:         sourcePrefix + "/" + p.UnitID,
		Geometry:       Geometry{Type: "Point", Coordinates: []float64{p.Lon, p.Lat}},
		AltitudeM:      p.AltitudeM,
		HeadingDeg:     p.HeadingDeg,
		SpeedMps:       p.SpeedMps,
		Classification: classification,
		APP6DSIDC:      "SFGPEVAT---------", // friendly · ground · equipment · vehicle · armoured · tracked
		ObservedAt:     orNow(p.ObservedAt).UTC().Format(time.RFC3339Nano),
		Metadata: map[string]any{
			"plugin":        "lynx-ifv",
			"version":       "0.1.0",
			"direction":     "ingress",
			"platform":      true,
			"ifv":           true,
			"callsign":      p.Callsign,
			"fuel_pct":      p.FuelPct,
			"engine_status": p.EngineStatus,
			"comms_status":  p.CommsStatus,
			"crew_size":     p.CrewSize,
			"crew_state":    string(p.Crew),
			"movement":      string(p.Movement),
			"ammo": map[string]any{
				"main":  p.AmmoMain,
				"coax":  p.AmmoCoax,
				"spike": p.AmmoSpike,
			},
		},
	}
}

func (t Track) JSON() ([]byte, error) { return json.Marshal(t) }

func orNow(t time.Time) time.Time {
	if t.IsZero() {
		return time.Now()
	}
	return t
}
