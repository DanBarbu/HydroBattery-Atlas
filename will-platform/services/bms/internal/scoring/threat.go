// Package scoring implements the WILL BMS threat-prioritisation method.
//
// The methodology is intentionally publicly documented (docs/bms/threat-scoring.md)
// so an operator can hand-verify any priority score from first principles.
// Score is in [0, 1]; higher = more urgent.
//
// Five weighted components, each normalised to [0, 1]:
//   - kinematics:    speed (faster = more urgent for cruise/ballistic categories)
//   - affiliation:   hostile = 1.0, unknown = 0.4, neutral = 0.0, friendly = 0.0
//   - heading:       closing on a defended asset = 1.0, receding = 0.0
//   - proximity:     distance to the nearest defended asset (closer = higher)
//   - classification:cruise/ballistic > swarm > UAV one-way > aircraft > surface
//
// The weights are documented and exposed; integrators tune them per doctrine.
package scoring

import (
	"math"
)

type ThreatClass string

const (
	ClassCruise     ThreatClass = "cruise"
	ClassBallistic  ThreatClass = "ballistic"
	ClassUAVOneWay  ThreatClass = "uav_one_way"
	ClassAircraft   ThreatClass = "aircraft"
	ClassSurface    ThreatClass = "surface"
	ClassSwarm      ThreatClass = "swarm"
	ClassUnknown    ThreatClass = "unknown"
)

// Track is the input shape the scorer accepts; mapped from will.track.v0 by
// the api layer. Heading is the bearing in degrees; speed in m/s.
type Track struct {
	Affiliation string  // "F"|"H"|"N"|"U" (APP-6D affiliation single char)
	Lat         float64
	Lon         float64
	SpeedMps    float64
	HeadingDeg  float64
	Class       ThreatClass
}

// DefendedAsset is a location worth defending. Customers configure these per
// tenant; the demo seeds two assets near Cincu.
type DefendedAsset struct {
	Name string
	Lat  float64
	Lon  float64
}

// Weights are the five component weights. Default values come from the
// publicly-documented WILL doctrine table; integrators override at startup.
type Weights struct {
	Kinematics    float64
	Affiliation   float64
	Heading       float64
	Proximity     float64
	Classification float64
}

func DefaultWeights() Weights {
	return Weights{
		Kinematics:    0.20,
		Affiliation:   0.25,
		Heading:       0.15,
		Proximity:     0.25,
		Classification: 0.15,
	}
}

// Score returns the priority score plus a per-component breakdown for the
// rationale JSON.
type Result struct {
	Score      float64            `json:"score"`
	Components map[string]float64 `json:"components"`
}

func Score(t Track, assets []DefendedAsset, w Weights) Result {
	c := map[string]float64{
		"kinematics":    kinematicComponent(t),
		"affiliation":   affiliationComponent(t),
		"heading":       headingComponent(t, assets),
		"proximity":     proximityComponent(t, assets),
		"classification": classComponent(t),
	}
	wTotal := w.Kinematics + w.Affiliation + w.Heading + w.Proximity + w.Classification
	if wTotal == 0 {
		wTotal = 1
	}
	raw :=
		w.Kinematics*c["kinematics"] +
			w.Affiliation*c["affiliation"] +
			w.Heading*c["heading"] +
			w.Proximity*c["proximity"] +
			w.Classification*c["classification"]
	return Result{Score: clamp01(raw / wTotal), Components: c}
}

func kinematicComponent(t Track) float64 {
	// Saturating function: 1.0 at >=900 m/s (Mach ~2.6), linear below.
	if t.SpeedMps <= 0 {
		return 0
	}
	return clamp01(t.SpeedMps / 900)
}

func affiliationComponent(t Track) float64 {
	switch t.Affiliation {
	case "H":
		return 1.0
	case "U":
		return 0.4
	case "N":
		return 0.0
	case "F":
		return 0.0
	}
	return 0.5
}

func headingComponent(t Track, assets []DefendedAsset) float64 {
	if len(assets) == 0 {
		return 0
	}
	best := 0.0
	for _, a := range assets {
		bearing := bearingDeg(t.Lat, t.Lon, a.Lat, a.Lon)
		delta := angleDelta(t.HeadingDeg, bearing)
		// Closing on bearing → high. 0° delta = 1.0; 180° = 0.0.
		v := 1 - (delta / 180.0)
		if v > best {
			best = v
		}
	}
	return clamp01(best)
}

func proximityComponent(t Track, assets []DefendedAsset) float64 {
	if len(assets) == 0 {
		return 0
	}
	best := math.MaxFloat64
	for _, a := range assets {
		d := haversineM(t.Lat, t.Lon, a.Lat, a.Lon)
		if d < best {
			best = d
		}
	}
	// Saturate to zero at 50 km away, 1.0 at the asset.
	const sat = 50_000.0
	if best >= sat {
		return 0
	}
	return clamp01(1 - best/sat)
}

func classComponent(t Track) float64 {
	switch t.Class {
	case ClassBallistic:
		return 1.0
	case ClassCruise:
		return 0.9
	case ClassSwarm:
		return 0.75
	case ClassUAVOneWay:
		return 0.6
	case ClassAircraft:
		return 0.5
	case ClassSurface:
		return 0.3
	}
	return 0.4
}

func clamp01(x float64) float64 {
	if x < 0 {
		return 0
	}
	if x > 1 {
		return 1
	}
	return x
}

// haversineM returns metres between two WGS-84 points.
func haversineM(lat1, lon1, lat2, lon2 float64) float64 {
	const r = 6_371_000.0
	dLat := (lat2 - lat1) * math.Pi / 180
	dLon := (lon2 - lon1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return r * c
}

func bearingDeg(lat1, lon1, lat2, lon2 float64) float64 {
	φ1 := lat1 * math.Pi / 180
	φ2 := lat2 * math.Pi / 180
	λ1 := lon1 * math.Pi / 180
	λ2 := lon2 * math.Pi / 180
	y := math.Sin(λ2-λ1) * math.Cos(φ2)
	x := math.Cos(φ1)*math.Sin(φ2) - math.Sin(φ1)*math.Cos(φ2)*math.Cos(λ2-λ1)
	θ := math.Atan2(y, x)
	return math.Mod(θ*180/math.Pi+360, 360)
}

func angleDelta(a, b float64) float64 {
	d := math.Mod(math.Abs(a-b), 360)
	if d > 180 {
		d = 360 - d
	}
	return d
}
