// Package lagrangian is the parcel-drift (Lagrangian) advection core of the
// METOC module (ADR-015). Given a flow field (surface current + wind) it
// integrates the trajectory of a drifting parcel — a man-overboard datum, a
// spilled marker, or a low-cost floating sensor released at sea — forward in
// time. Forecasting here is advisory only: it predicts where something will
// DRIFT, never where to send anything.
//
// The integrator is forward-Euler over a configurable step; positional
// uncertainty grows linearly with elapsed time (a simple, defensible 3-sigma
// cone) so the operator sees a spreading search area, not a false-precision
// point.
package lagrangian

import (
	"errors"
	"math"
)

// Sample is one flow-field measurement: eastward/northward velocity in m/s at
// a lat/lon. u is +east, v is +north (oceanographic/meteo convention).
type Sample struct {
	Lat      float64 `json:"lat"`
	Lon      float64 `json:"lon"`
	UEastMps float64 `json:"u_east_mps"`
	VNorthMps float64 `json:"v_north_mps"`
}

// Field is a set of flow samples plus a fallback analytic current used when no
// sample is near the query point. The default fallback is a gentle Black-Sea
// north-westerly surface set (the Rim Current runs broadly cyclonic).
type Field struct {
	Samples       []Sample
	FallbackUEast float64
	FallbackVNorth float64
	// RadiusM bounds how far a sample may be from the query point and still be
	// used. 0 selects a sensible default.
	RadiusM float64
}

// BlackSeaSurface returns a Field with no samples and a light cyclonic set
// (~0.15 m/s) typical of the western Black Sea Rim Current off Constanța.
func BlackSeaSurface() Field {
	return Field{FallbackUEast: -0.10, FallbackVNorth: 0.11, RadiusM: 25000}
}

// At returns the flow velocity (m/s east, m/s north) at a point. It uses the
// nearest sample within RadiusM; otherwise the analytic fallback. Inverse-
// distance weighting blends the nearest few samples for a smoother field.
func (f Field) At(lat, lon float64) (uEast, vNorth float64) {
	radius := f.RadiusM
	if radius <= 0 {
		radius = 25000
	}
	var sumW, sumU, sumV float64
	for _, s := range f.Samples {
		d := haversineM(lat, lon, s.Lat, s.Lon)
		if d > radius {
			continue
		}
		w := 1.0 / (d*d + 1.0) // +1 avoids singularity at the sample itself
		sumW += w
		sumU += w * s.UEastMps
		sumV += w * s.VNorthMps
	}
	if sumW == 0 {
		return f.FallbackUEast, f.FallbackVNorth
	}
	return sumU / sumW, sumV / sumW
}

// Waypoint is one position on a predicted drift trajectory. SpreadM is the
// 1-sigma positional uncertainty radius at that time.
type Waypoint struct {
	TOffsetS float64 `json:"t_offset_s"`
	Lat      float64 `json:"lat"`
	Lon      float64 `json:"lon"`
	SpreadM  float64 `json:"spread_m"`
}

// DriftParams configures an Advect run.
type DriftParams struct {
	Lat       float64 `json:"lat"`        // release latitude
	Lon       float64 `json:"lon"`        // release longitude
	DurationS float64 `json:"duration_s"` // total forecast horizon, seconds
	StepS     float64 `json:"step_s"`     // integration step, seconds (0 -> 600s)
	// Windage couples surface wind to parcel motion (leeway). A floating
	// sensor with low freeboard ~0.01-0.03; a life-raft ~0.03-0.06.
	Windage float64 `json:"windage"`
	// WindUEast/WindVNorth is a (constant) surface wind in m/s used for the
	// leeway term. Leave zero for current-only drift.
	WindUEast  float64 `json:"wind_u_east_mps"`
	WindVNorth float64 `json:"wind_v_north_mps"`
	// SpreadRateMps is the linear growth of 1-sigma uncertainty per second.
	// 0 -> a default ~0.05 m/s (~180 m/hr), reflecting flow-field error.
	SpreadRateMps float64 `json:"spread_rate_mps"`
}

var (
	// ErrBadDuration is returned for a non-positive horizon.
	ErrBadDuration = errors.New("lagrangian: duration must be positive")
	// ErrTooManySteps guards against pathological step counts (resource cap).
	ErrTooManySteps = errors.New("lagrangian: too many integration steps")
)

const maxSteps = 100000

// Advect integrates the parcel trajectory forward in time and returns the
// release point plus one waypoint per step. Forward-Euler; surface current
// from the field plus a windage (leeway) term.
func Advect(f Field, p DriftParams) ([]Waypoint, error) {
	if p.DurationS <= 0 {
		return nil, ErrBadDuration
	}
	step := p.StepS
	if step <= 0 {
		step = 600
	}
	if p.DurationS/step > maxSteps {
		return nil, ErrTooManySteps
	}
	spreadRate := p.SpreadRateMps
	if spreadRate <= 0 {
		spreadRate = 0.05
	}

	lat, lon := p.Lat, p.Lon
	out := []Waypoint{{TOffsetS: 0, Lat: lat, Lon: lon, SpreadM: 0}}
	for t := step; t <= p.DurationS+1e-9; t += step {
		uEast, vNorth := f.At(lat, lon)
		uEast += p.Windage * p.WindUEast
		vNorth += p.Windage * p.WindVNorth

		// metres moved this step, converted to degrees.
		dEastM := uEast * step
		dNorthM := vNorth * step
		lat += dNorthM / 111320.0
		coslat := math.Cos(lat * math.Pi / 180.0)
		if math.Abs(coslat) < 1e-6 {
			coslat = 1e-6
		}
		lon += dEastM / (111320.0 * coslat)

		out = append(out, Waypoint{
			TOffsetS: t,
			Lat:      lat,
			Lon:      lon,
			SpreadM:  spreadRate * t,
		})
	}
	return out, nil
}

func haversineM(lat1, lon1, lat2, lon2 float64) float64 {
	const r = 6371000.0
	rad := math.Pi / 180.0
	dLat := (lat2 - lat1) * rad
	dLon := (lon2 - lon1) * rad
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*rad)*math.Cos(lat2*rad)*math.Sin(dLon/2)*math.Sin(dLon/2)
	return 2 * r * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}
