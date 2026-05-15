// Package prediction is the BMS predictive battlefield analysis module.
//
// What it does (publicly-documented techniques only):
//   - Track propagation: forward-project a track's position using its current
//     kinematic state (position + heading + speed). 3-σ uncertainty grows
//     linearly with the projection horizon.
//   - Engagement windows: for each (track, effector) pair, compute the time
//     interval during which the projected track sits inside the effector's
//     kinematic envelope.
//   - Threat density: bin the projected positions into a lat/lon grid so the
//     UI can colour the AOI by anticipated pressure.
//   - COA (Course-of-Action) recommendation: greedy weapon-target assignment
//     that maximises total expected probability of kill while respecting
//     each effector's rounds-remaining cap.
//
// What it deliberately does NOT do:
//   - It does not replace the effector's own fire-control prediction. The
//     interception solution belongs to the effector platform.
//   - It does not run a full multi-target tracking filter (Kalman / IMM /
//     factor graph). The fusion engine (Sprint 6) owns that. The BMS's
//     prediction is a coarse forward-propagation suitable for operator
//     situation awareness and engagement-window estimation.
//   - It does not produce probabilities of target-type identity. Threat
//     class is supplied by the upstream fusion / classification layer.
//
// docs/bms/predictive-analysis.md is the operator-facing description.
package prediction

import (
	"math"
	"sort"
	"time"
)

const earthR = 6_371_000.0

// ---------- Track propagation ----------

// Track is the propagation input. Heading is degrees true; speed is m/s.
type Track struct {
	ID             string
	Lat            float64
	Lon            float64
	AltitudeM      float64
	HeadingDeg     float64
	SpeedMps       float64
	ObservedAt     time.Time
	// 1-σ position uncertainty at observation, in metres. Grows linearly with horizon.
	PositionSigmaM float64
}

// Waypoint is one projected position with the propagation timestamp and the
// 3-σ uncertainty radius.
type Waypoint struct {
	T              time.Time `json:"t"`
	Lat            float64   `json:"lat"`
	Lon            float64   `json:"lon"`
	AltitudeM      float64   `json:"altitude_m"`
	UncertaintyM   float64   `json:"uncertainty_m"`
}

// Propagate produces stepCount waypoints at stepDt intervals. The first
// waypoint is the original position with 3·sigma uncertainty; each
// successive waypoint adds an `additionalSigmaPerS` metre 1-σ uncertainty.
const additionalSigmaPerS = 3.0

func Propagate(t Track, stepCount int, stepDt time.Duration) []Waypoint {
	if stepCount <= 0 || stepDt <= 0 {
		return nil
	}
	out := make([]Waypoint, 0, stepCount+1)
	out = append(out, Waypoint{
		T: t.ObservedAt, Lat: t.Lat, Lon: t.Lon, AltitudeM: t.AltitudeM,
		UncertaintyM: 3 * t.PositionSigmaM,
	})
	headingRad := t.HeadingDeg * math.Pi / 180
	cosH := math.Cos(headingRad)
	sinH := math.Sin(headingRad)
	for i := 1; i <= stepCount; i++ {
		dts := stepDt.Seconds() * float64(i)
		// Local-tangent-plane projection: north = cosH·v·dt; east = sinH·v·dt.
		northM := cosH * t.SpeedMps * dts
		eastM := sinH * t.SpeedMps * dts
		lat, lon := offsetLatLon(t.Lat, t.Lon, northM, eastM)
		sigma := t.PositionSigmaM + additionalSigmaPerS*dts
		out = append(out, Waypoint{
			T: t.ObservedAt.Add(time.Duration(dts * float64(time.Second))),
			Lat: lat, Lon: lon, AltitudeM: t.AltitudeM,
			UncertaintyM: 3 * sigma,
		})
	}
	return out
}

func offsetLatLon(lat, lon, northM, eastM float64) (float64, float64) {
	dlat := (northM / earthR) * (180 / math.Pi)
	dlon := (eastM / (earthR * math.Cos(lat*math.Pi/180))) * (180 / math.Pi)
	return lat + dlat, lon + dlon
}

// ---------- Engagement window ----------

// Effector is the subset the prediction package needs.
type Effector struct {
	ID                string
	Lat               float64
	Lon               float64
	MinRangeM         float64
	MaxRangeM         float64
	MinAltitudeM      float64
	MaxAltitudeM      float64
	MaxTargetSpeedMps float64
	RoundsRemaining   int
	Status            string // only "READY" produces a window
}

// Window describes when a track is engageable by an effector. T0/T1 are
// inclusive; if Engageable is false the rest of the fields are zero.
type Window struct {
	TrackID    string    `json:"track_id"`
	EffectorID string    `json:"effector_id"`
	Engageable bool      `json:"engageable"`
	T0         time.Time `json:"t0,omitempty"`
	T1         time.Time `json:"t1,omitempty"`
}

// EngagementWindow walks the propagated trajectory and returns the first
// continuous window during which the projected track sits inside the
// effector's envelope. waypoints is typically the result of Propagate(t, …).
func EngagementWindow(t Track, e Effector, waypoints []Waypoint) Window {
	w := Window{TrackID: t.ID, EffectorID: e.ID}
	if e.Status != "READY" || e.RoundsRemaining <= 0 || len(waypoints) == 0 {
		return w
	}
	if t.SpeedMps > e.MaxTargetSpeedMps {
		return w
	}
	var inside bool
	for _, p := range waypoints {
		if p.AltitudeM < e.MinAltitudeM || p.AltitudeM > e.MaxAltitudeM {
			continue
		}
		d := haversineM(p.Lat, p.Lon, e.Lat, e.Lon)
		if d < e.MinRangeM || d > e.MaxRangeM {
			if inside {
				w.T1 = p.T
				return w
			}
			continue
		}
		if !inside {
			w.T0 = p.T
			inside = true
			w.Engageable = true
		}
		w.T1 = p.T
	}
	return w
}

// ---------- Threat density grid ----------

type Cell struct {
	LatMin float64 `json:"lat_min"`
	LatMax float64 `json:"lat_max"`
	LonMin float64 `json:"lon_min"`
	LonMax float64 `json:"lon_max"`
	Score  float64 `json:"score"` // sum of priority scores attributed to this cell
}

// AOI is a bounding box.
type AOI struct {
	LatMin, LatMax, LonMin, LonMax float64
}

// Density buckets each track's propagated waypoints into rows×cols cells of
// the AOI. Score is the track's priority weighted by how many of its
// waypoints fall in the cell (0..1 share). Rows × cols ≤ 32 × 32 is plenty
// for a tactical AOI.
func Density(aoi AOI, rows, cols int, scored []ScoredPropagation) []Cell {
	if rows <= 0 || cols <= 0 || rows > 32 || cols > 32 {
		return nil
	}
	dLat := (aoi.LatMax - aoi.LatMin) / float64(rows)
	dLon := (aoi.LonMax - aoi.LonMin) / float64(cols)
	cells := make([]Cell, rows*cols)
	for r := 0; r < rows; r++ {
		for c := 0; c < cols; c++ {
			cells[r*cols+c] = Cell{
				LatMin: aoi.LatMin + float64(r)*dLat,
				LatMax: aoi.LatMin + float64(r+1)*dLat,
				LonMin: aoi.LonMin + float64(c)*dLon,
				LonMax: aoi.LonMin + float64(c+1)*dLon,
			}
		}
	}
	for _, sp := range scored {
		if len(sp.Waypoints) == 0 {
			continue
		}
		share := 1.0 / float64(len(sp.Waypoints))
		for _, w := range sp.Waypoints {
			if w.Lat < aoi.LatMin || w.Lat >= aoi.LatMax || w.Lon < aoi.LonMin || w.Lon >= aoi.LonMax {
				continue
			}
			r := int((w.Lat - aoi.LatMin) / dLat)
			c := int((w.Lon - aoi.LonMin) / dLon)
			if r < 0 || r >= rows || c < 0 || c >= cols {
				continue
			}
			cells[r*cols+c].Score += sp.PriorityScore * share
		}
	}
	return cells
}

// ScoredPropagation pairs a track's projection with its priority score.
type ScoredPropagation struct {
	TrackID       string
	PriorityScore float64
	Waypoints     []Waypoint
}

// ---------- Course-of-Action recommendation ----------

// COAInput is the assignment problem the recommender solves.
type COAInput struct {
	Threats   []ThreatLite
	Effectors []Effector
}

type ThreatLite struct {
	ID            string
	PriorityScore float64
	ThreatClass   string
	Lat           float64
	Lon           float64
	AltitudeM     float64
	SpeedMps      float64
}

// COAStep is one entry in the recommended engagement order.
type COAStep struct {
	ThreatID          string  `json:"threat_id"`
	EffectorID        string  `json:"effector_id"`
	ProbabilityOfKill float64 `json:"probability_of_kill"`
	Rationale         string  `json:"rationale"`
}

// COA returns the greedy assignment. Threats are processed in priority
// order; for each one we pick the highest-PK compatible effector that still
// has rounds left in the running tally. Documented heuristic; integrators
// can swap in a Hungarian-algorithm exact solver later without changing
// callers.
func COA(in COAInput) []COAStep {
	// Sort threats highest-priority first.
	threats := append([]ThreatLite{}, in.Threats...)
	sort.SliceStable(threats, func(i, j int) bool { return threats[i].PriorityScore > threats[j].PriorityScore })

	// Working copy of rounds remaining.
	rounds := map[string]int{}
	for _, e := range in.Effectors {
		rounds[e.ID] = e.RoundsRemaining
	}

	steps := make([]COAStep, 0, len(threats))
	for _, t := range threats {
		var best *Effector
		bestPK := -1.0
		for i := range in.Effectors {
			e := &in.Effectors[i]
			if rounds[e.ID] <= 0 {
				continue
			}
			if e.Status != "READY" {
				continue
			}
			if t.SpeedMps > e.MaxTargetSpeedMps {
				continue
			}
			if t.AltitudeM < e.MinAltitudeM || t.AltitudeM > e.MaxAltitudeM {
				continue
			}
			if !compatible(e, t.ThreatClass) {
				continue
			}
			d := haversineM(t.Lat, t.Lon, e.Lat, e.Lon)
			if d < e.MinRangeM || d > e.MaxRangeM {
				continue
			}
			pk := estimatePK(*e, d, t.SpeedMps)
			if pk > bestPK {
				bestPK = pk
				best = e
			}
		}
		if best == nil {
			steps = append(steps, COAStep{
				ThreatID: t.ID, EffectorID: "", ProbabilityOfKill: 0,
				Rationale: "no compatible effector with rounds remaining",
			})
			continue
		}
		rounds[best.ID]--
		steps = append(steps, COAStep{
			ThreatID: t.ID, EffectorID: best.ID, ProbabilityOfKill: bestPK,
			Rationale: "greedy: highest expected PK among compatible effectors",
		})
	}
	return steps
}

var compatibility = map[string]map[string]bool{
	"sam_area":    {"cruise": true, "aircraft": true, "uav_one_way": true, "swarm": true},
	"sam_point":   {"cruise": true, "uav_one_way": true, "swarm": true},
	"nsm_coastal": {"surface": true},
	"jammer_rf":   {"uav_one_way": true, "swarm": true},
	"c_uas":       {"uav_one_way": true, "swarm": true},
}

func compatible(e *Effector, threatClass string) bool {
	// Effector kind is not on the prediction.Effector struct; the BMS api
	// passes only kinematics + status here. The api layer screens on kind
	// when populating COAInput; we keep the rule table here for completeness.
	_ = compatibility
	_ = e
	_ = threatClass
	return true
}

func estimatePK(e Effector, slantRangeM, targetSpeedMps float64) float64 {
	mid := (e.MinRangeM + e.MaxRangeM) / 2
	span := (e.MaxRangeM - e.MinRangeM) / 2
	if span <= 0 {
		return 0.5
	}
	closeness := 1 - math.Abs(slantRangeM-mid)/span
	if closeness < 0 {
		closeness = 0
	}
	base := 0.5 + 0.4*closeness
	if e.MaxTargetSpeedMps <= 0 {
		return clamp01(base)
	}
	speedPenalty := targetSpeedMps / e.MaxTargetSpeedMps
	if speedPenalty > 1 {
		speedPenalty = 1
	}
	return clamp01(base * (1 - 0.2*speedPenalty))
}

// ---------- math helpers ----------

func haversineM(lat1, lon1, lat2, lon2 float64) float64 {
	dLat := (lat2 - lat1) * math.Pi / 180
	dLon := (lon2 - lon1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return earthR * c
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
