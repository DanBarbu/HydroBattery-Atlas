// Package track builds will.track.v0 payloads for the Rheinmetall MMPV-90
// offshore patrol vessel / corvette feed.
//
// Three track families (Phase 1 ingest-only, per ADR-018):
//
//   - BuildOwnShip:   the corvette's own friendly surface-combatant PLI
//   - BuildDetection: naval radar/EO/ESM detections (surface, air, subsurface)
//   - BuildAISContact: AIS broadcasts treated as OSINT-layer advisory tracks
//     (per ADR-016; classification forced to "<base> // OSINT")
//
// Coordinator discipline: no CMS replacement, no weapons direction, no sail
// orders. Only the three Build* functions are exported; the plugin has no
// outbound socket to the ship's combat-management or steering systems.
package track

import (
	"encoding/json"
	"strings"
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

// Domain identifies the operational domain of a naval sensor detection.
type Domain string

const (
	DomainSurface    Domain = "SURFACE"
	DomainAir        Domain = "AIR"
	DomainSubsurface Domain = "SUBSURFACE"
)

// Affiliation is the STANAG-2019 affiliation character.
type Affiliation string

const (
	AffFriend  Affiliation = "F"
	AffHostile Affiliation = "H"
	AffNeutral Affiliation = "N"
	AffUnknown Affiliation = "U"
)

// OwnShipPLI is the corvette's own platform position + ship-state summary.
type OwnShipPLI struct {
	HullID      string
	Pennant     string // pennant number / hull-side identifier
	Lat, Lon    float64
	HeadingDeg  float64
	SpeedMps    float64 // ground/water speed
	Heel        float64 // degrees, positive starboard
	SeaState    int     // Douglas scale 0-9, advisory
	FuelPct     float64
	HelmStatus  string // "AUTO" | "MANUAL"
	CommsStatus string // "OK" | "DEGRADED" | "LOST"
	ObservedAt  time.Time
}

// Detection is a contact reported by the ship's naval sensor suite
// (surface radar / air radar / EO/IR / ESM / sonar).
type Detection struct {
	ID         string
	Domain     Domain
	Aff        Affiliation
	Sensor     string // "SURFACE_RADAR" | "AIR_RADAR" | "EO" | "IR" | "ESM" | "SONAR"
	Lat, Lon   float64
	AltitudeM  float64 // negative for subsurface; 0 for surface; positive for air
	HeadingDeg float64
	SpeedMps   float64
	Confidence float64
	ObservedAt time.Time
}

// AISContact is a Class-A or Class-B AIS broadcast received by the ship's
// AIS receiver. Treated as OSINT per ADR-016: the classification is forced
// to "<base> // OSINT" and metadata.osint=true. AIS contacts are NEVER
// auto-fused with operational naval tracks; they are an advisory layer.
type AISContact struct {
	MMSI       string
	Name       string
	CallSign   string
	Lat, Lon   float64
	HeadingDeg float64
	SpeedMps   float64
	Type       string // AIS shiptype: "CARGO" | "TANKER" | "FISHING" | "PASSENGER" | "OTHER"
	ObservedAt time.Time
}

// BuildOwnShip renders the corvette's own PLI as a friendly surface-combatant track.
func BuildOwnShip(p OwnShipPLI, tenantID, classification, sourcePrefix string) Track {
	return Track{
		Schema:         Schema,
		TrackID:        p.HullID,
		TenantID:       tenantID,
		Source:         sourcePrefix + "/ownship/" + p.HullID,
		Geometry:       Geometry{Type: "Point", Coordinates: []float64{p.Lon, p.Lat}},
		HeadingDeg:     p.HeadingDeg,
		SpeedMps:       p.SpeedMps,
		Classification: classification,
		APP6DSIDC:      "SFSPCL-----------", // friendly · sea-surface · present · combatant line
		ObservedAt:     orNow(p.ObservedAt).UTC().Format(time.RFC3339Nano),
		Metadata: map[string]any{
			"plugin":       "mmpv90-naval",
			"version":      "0.1.0",
			"direction":    "ingress",
			"platform":     true,
			"ownship":      true,
			"hull_class":   "MMPV-90",
			"pennant":      p.Pennant,
			"heel_deg":     p.Heel,
			"sea_state":    p.SeaState,
			"fuel_pct":     p.FuelPct,
			"helm_status":  p.HelmStatus,
			"comms_status": p.CommsStatus,
		},
	}
}

// BuildDetection renders a naval sensor detection as a will.track.v0 track.
func BuildDetection(d Detection, tenantID, classification, sourcePrefix string) Track {
	return Track{
		Schema:         Schema,
		TrackID:        d.ID,
		TenantID:       tenantID,
		Source:         sourcePrefix + "/sensor/" + d.ID,
		Geometry:       Geometry{Type: "Point", Coordinates: []float64{d.Lon, d.Lat}},
		AltitudeM:      d.AltitudeM,
		HeadingDeg:     d.HeadingDeg,
		SpeedMps:       d.SpeedMps,
		Classification: classification,
		APP6DSIDC:      navalSIDC(d.Aff, d.Domain),
		ObservedAt:     orNow(d.ObservedAt).UTC().Format(time.RFC3339Nano),
		Metadata: map[string]any{
			"plugin":     "mmpv90-naval",
			"version":    "0.1.0",
			"direction":  "ingress",
			"naval":      true,
			"domain":     string(d.Domain),
			"sensor":     d.Sensor,
			"aff":        string(d.Aff),
			"threat":     d.Aff == AffHostile,
			"confidence": d.Confidence,
		},
	}
}

// BuildAISContact renders an AIS broadcast as an OSINT-layer advisory track.
// The classification is forced into the OSINT caveat per ADR-016.
func BuildAISContact(c AISContact, tenantID, classificationBase, sourcePrefix string) Track {
	cls := forceOSINTCaveat(classificationBase)
	return Track{
		Schema:         Schema,
		TrackID:        "AIS-" + c.MMSI,
		TenantID:       tenantID,
		Source:         sourcePrefix + "/ais/" + c.MMSI,
		Geometry:       Geometry{Type: "Point", Coordinates: []float64{c.Lon, c.Lat}},
		HeadingDeg:     c.HeadingDeg,
		SpeedMps:       c.SpeedMps,
		Classification: cls,
		APP6DSIDC:      "SUSPC------------", // unknown · sea-surface · present · civilian
		ObservedAt:     orNow(c.ObservedAt).UTC().Format(time.RFC3339Nano),
		Metadata: map[string]any{
			"plugin":     "mmpv90-naval",
			"version":    "0.1.0",
			"direction":  "ingress",
			"osint":      true,
			"confidence": "low",
			"layer":      "ais",
			"mmsi":       c.MMSI,
			"name":       c.Name,
			"callsign":   c.CallSign,
			"ship_type":  c.Type,
		},
	}
}

func (t Track) JSON() ([]byte, error) { return json.Marshal(t) }

// navalSIDC maps (affiliation, domain) to an APP-6D code. The first character
// is the symbol set identifier, the second affiliation, the fourth dimension.
func navalSIDC(aff Affiliation, dom Domain) string {
	a := byte('U')
	if aff != "" {
		a = aff[0]
	}
	dim := byte('S') // sea-surface default
	switch dom {
	case DomainAir:
		dim = 'A'
	case DomainSubsurface:
		dim = 'U'
	case DomainSurface:
		dim = 'S'
	}
	return "S" + string(a) + string(dim) + "P-------------"
}

// forceOSINTCaveat appends " // OSINT" to a base marking if not already present.
// Pure base markings ("NESECRET") become "NESECRET // OSINT". An already-
// caveated marking is returned unchanged.
func forceOSINTCaveat(base string) string {
	base = strings.TrimSpace(base)
	if base == "" {
		return "NESECRET // OSINT"
	}
	if strings.Contains(strings.ToUpper(base), "OSINT") {
		return base
	}
	if strings.Contains(base, "//") {
		return base + " / OSINT"
	}
	return base + " // OSINT"
}

func orNow(t time.Time) time.Time {
	if t.IsZero() {
		return time.Now()
	}
	return t
}
