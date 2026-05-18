// Package deconflict provides ADVISORY-ONLY geometry checks against active
// Fire Support Coordination Measures. ADR-012.
//
// It returns flags. It never blocks, gates, approves, or tasks anything.
// The fires chain of command and AFATDS remain the sole authority.
package deconflict

import "time"

// Ring is a GeoJSON-style outer ring [[lon,lat],...].
type Ring [][2]float64

type Measure struct {
	ExternalID    string
	MeasureType   string // NFA | RFA | FFA | CFL | FSCL | RFL | ACA | MFP
	Name          string
	Polygon       Ring
	MinAltM       *float64
	MaxAltM       *float64
	EffectiveFrom *time.Time
	EffectiveTo   *time.Time
}

// Active reports whether the measure is in effect at t. Nil bounds mean
// "unbounded on that side".
func (m Measure) Active(t time.Time) bool {
	if m.EffectiveFrom != nil && t.Before(*m.EffectiveFrom) {
		return false
	}
	if m.EffectiveTo != nil && t.After(*m.EffectiveTo) {
		return false
	}
	return true
}

// Flag is one advisory finding. Severity is "info" or "caution"; this
// package never emits anything stronger because it has no authority.
type Flag struct {
	MeasureID   string `json:"measure_id"`
	MeasureType string `json:"measure_type"`
	MeasureName string `json:"measure_name"`
	Severity    string `json:"severity"`
	Advisory    string `json:"advisory"`
}

// Check returns advisory flags for a point at (lon,lat,altM) and time t.
// NFA / RFA inside footprint -> caution. ACA inside footprint AND inside
// altitude band -> caution (deconflict aircraft). Everything else -> info.
func Check(lon, lat, altM float64, t time.Time, measures []Measure) []Flag {
	var flags []Flag
	for _, m := range measures {
		if !m.Active(t) {
			continue
		}
		if !pointInRing(lon, lat, m.Polygon) {
			continue
		}
		switch m.MeasureType {
		case "NFA":
			flags = append(flags, Flag{m.ExternalID, m.MeasureType, m.Name, "caution",
				"point lies inside an active No-Fire Area (advisory only)"})
		case "RFA", "RFL":
			flags = append(flags, Flag{m.ExternalID, m.MeasureType, m.Name, "caution",
				"point lies inside an active restrictive measure (advisory only)"})
		case "ACA":
			if inAltBand(altM, m.MinAltM, m.MaxAltM) {
				flags = append(flags, Flag{m.ExternalID, m.MeasureType, m.Name, "caution",
					"point lies inside an active Airspace Coordination Area altitude band — deconflict aircraft (advisory only)"})
			} else {
				flags = append(flags, Flag{m.ExternalID, m.MeasureType, m.Name, "info",
					"point lies inside an ACA footprint but outside its altitude band (advisory only)"})
			}
		default:
			flags = append(flags, Flag{m.ExternalID, m.MeasureType, m.Name, "info",
				"point lies inside an active coordination measure (advisory only)"})
		}
	}
	return flags
}

func inAltBand(alt float64, lo, hi *float64) bool {
	if lo != nil && alt < *lo {
		return false
	}
	if hi != nil && alt > *hi {
		return false
	}
	return true
}

// pointInRing — ray casting. Degenerate rings (<3 pts) are treated as
// "not containing" so a malformed measure can never raise a false caution.
func pointInRing(lon, lat float64, ring Ring) bool {
	if len(ring) < 3 {
		return false
	}
	inside := false
	j := len(ring) - 1
	for i := range ring {
		xi, yi := ring[i][0], ring[i][1]
		xj, yj := ring[j][0], ring[j][1]
		if ((yi > lat) != (yj > lat)) &&
			(lon < (xj-xi)*(lat-yi)/(yj-yi)+xi) {
			inside = !inside
		}
		j = i
	}
	return inside
}
