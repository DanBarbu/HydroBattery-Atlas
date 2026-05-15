// Package pairing applies the WILL weapon-target pairing rules.
//
// Rule set (documented in docs/bms/engagement-workflow.md):
//   1. Effector must be READY (not RELOADING/MAINTENANCE/OFFLINE).
//   2. Rounds remaining > 0.
//   3. Target speed within the effector's kinematic envelope.
//   4. Target altitude within the envelope.
//   5. Slant range to target within [min_range, max_range].
//   6. Kind compatibility (a C-UAS will not be paired with a ballistic threat).
//
// Among effectors that satisfy all six, prefer the one with the largest
// remaining range margin (most likely to engage from outside the threat's
// effective envelope). Ties broken by larger rounds_remaining.
package pairing

import (
	"math"
)

type EffectorKind string

const (
	KindSamArea    EffectorKind = "sam_area"
	KindSamPoint   EffectorKind = "sam_point"
	KindNSMCoastal EffectorKind = "nsm_coastal"
	KindJammerRF   EffectorKind = "jammer_rf"
	KindCUAS       EffectorKind = "c_uas"
)

type Effector struct {
	ID                string
	Kind              EffectorKind
	Status            string  // "READY"|"ENGAGING"|...
	Lat               float64
	Lon               float64
	MinRangeM         float64
	MaxRangeM         float64
	MinAltitudeM      float64
	MaxAltitudeM      float64
	MaxTargetSpeedMps float64
	RoundsRemaining   int
}

type Target struct {
	Lat        float64
	Lon        float64
	AltitudeM  float64
	SpeedMps   float64
	ThreatClass string // matches scoring.ThreatClass values
}

// Compatibility table: which kinds may engage which threat classes.
var kindCompatibility = map[EffectorKind]map[string]bool{
	KindSamArea:    {"cruise": true, "aircraft": true, "uav_one_way": true, "swarm": true},
	KindSamPoint:   {"cruise": true, "uav_one_way": true, "swarm": true},
	KindNSMCoastal: {"surface": true},
	KindJammerRF:   {"uav_one_way": true, "swarm": true},
	KindCUAS:       {"uav_one_way": true, "swarm": true},
}

// Best returns the chosen effector and a score (higher = better fit) plus
// the slant range. Returns false if nothing is compatible.
type Match struct {
	Effector       Effector
	SlantRangeM    float64
	RangeMarginM   float64
}

func Best(target Target, candidates []Effector) (Match, bool) {
	var best Match
	found := false
	for _, e := range candidates {
		m, ok := evaluate(target, e)
		if !ok {
			continue
		}
		if !found || rank(m) > rank(best) {
			best = m
			found = true
		}
	}
	return best, found
}

func evaluate(target Target, e Effector) (Match, bool) {
	if e.Status != "READY" {
		return Match{}, false
	}
	if e.RoundsRemaining <= 0 {
		return Match{}, false
	}
	if target.SpeedMps > e.MaxTargetSpeedMps {
		return Match{}, false
	}
	if target.AltitudeM < e.MinAltitudeM || target.AltitudeM > e.MaxAltitudeM {
		return Match{}, false
	}
	if !kindCompatibility[e.Kind][target.ThreatClass] {
		return Match{}, false
	}
	range_m := haversineM(target.Lat, target.Lon, e.Lat, e.Lon)
	if range_m < e.MinRangeM || range_m > e.MaxRangeM {
		return Match{}, false
	}
	return Match{Effector: e, SlantRangeM: range_m, RangeMarginM: e.MaxRangeM - range_m}, true
}

func rank(m Match) float64 {
	return m.RangeMarginM*1.0 + float64(m.Effector.RoundsRemaining)*100.0
}

func haversineM(lat1, lon1, lat2, lon2 float64) float64 {
	const r = 6_371_000.0
	dLat := (lat2 - lat1) * math.Pi / 180
	dLon := (lon2 - lon1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return r * c
}
