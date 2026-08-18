package prediction

import (
	"math"
	"testing"
	"time"
)

func TestPropagateProducesCountPlusOneWaypoints(t *testing.T) {
	wps := Propagate(Track{Lat: 45.87, Lon: 24.78, HeadingDeg: 90, SpeedMps: 100, ObservedAt: time.Unix(0, 0)},
		5, time.Second)
	if len(wps) != 6 {
		t.Fatalf("want 6 waypoints, got %d", len(wps))
	}
	if wps[0].UncertaintyM != 0 {
		t.Fatalf("first waypoint should reflect zero sigma, got %f", wps[0].UncertaintyM)
	}
	if !(wps[5].UncertaintyM > wps[0].UncertaintyM) {
		t.Fatalf("uncertainty should grow with horizon")
	}
}

func TestPropagateMovesEastForHeading90(t *testing.T) {
	wps := Propagate(Track{Lat: 45.87, Lon: 24.78, HeadingDeg: 90, SpeedMps: 100, ObservedAt: time.Unix(0, 0)},
		1, 10*time.Second)
	if !(wps[1].Lon > wps[0].Lon+1e-6) {
		t.Fatalf("expected eastward movement, got lon %f → %f", wps[0].Lon, wps[1].Lon)
	}
	if math.Abs(wps[1].Lat-wps[0].Lat) > 1e-3 {
		t.Fatalf("expected near-zero latitude change, got %f → %f", wps[0].Lat, wps[1].Lat)
	}
}

func TestEngagementWindowFindsInsideInterval(t *testing.T) {
	// Effector at Cincu, 50 km max. Track 100 km east, heading west at
	// 200 m/s closes inside the envelope around t=100s and stays in.
	track := Track{ID: "t", Lat: 45.87, Lon: 25.96, HeadingDeg: 270, SpeedMps: 200, ObservedAt: time.Unix(0, 0)}
	eff := Effector{ID: "p", Lat: 45.87, Lon: 24.78,
		MinRangeM: 3_000, MaxRangeM: 50_000,
		MinAltitudeM: 0, MaxAltitudeM: 25_000,
		MaxTargetSpeedMps: 2_400, RoundsRemaining: 8, Status: "READY"}
	wps := Propagate(track, 600, time.Second)
	w := EngagementWindow(track, eff, wps)
	if !w.Engageable {
		t.Fatalf("expected an engageable window")
	}
	if !w.T1.After(w.T0) {
		t.Fatalf("expected T1 > T0, got %v / %v", w.T0, w.T1)
	}
}

func TestEngagementWindowEmptyWhenEffectorNotReady(t *testing.T) {
	eff := Effector{Status: "MAINTENANCE", RoundsRemaining: 8, MaxRangeM: 50_000, MaxTargetSpeedMps: 2400}
	w := EngagementWindow(Track{}, eff, nil)
	if w.Engageable {
		t.Fatal("not-READY effector should produce no window")
	}
}

func TestEngagementWindowEmptyWhenTooFast(t *testing.T) {
	eff := Effector{Status: "READY", RoundsRemaining: 8, MaxRangeM: 50_000, MaxAltitudeM: 25_000, MaxTargetSpeedMps: 60}
	wps := Propagate(Track{Lat: 45.87, Lon: 25.0, HeadingDeg: 270, SpeedMps: 200, ObservedAt: time.Unix(0, 0)},
		60, time.Second)
	w := EngagementWindow(Track{SpeedMps: 200}, eff, wps)
	if w.Engageable {
		t.Fatal("over-speed target should produce no window")
	}
}

func TestDensityBucketsWaypoints(t *testing.T) {
	aoi := AOI{LatMin: 45.0, LatMax: 46.0, LonMin: 24.0, LonMax: 25.0}
	wps := []Waypoint{{Lat: 45.5, Lon: 24.5}, {Lat: 45.5, Lon: 24.5}}
	cells := Density(aoi, 2, 2, []ScoredPropagation{{TrackID: "t", PriorityScore: 0.8, Waypoints: wps}})
	if len(cells) != 4 {
		t.Fatalf("expected 4 cells, got %d", len(cells))
	}
	// Expect exactly the lower-right quadrant to receive score (lat 45.5
	// falls in row 1 because the cut is at 45.5; lon 24.5 falls in col 1).
	totalScore := 0.0
	cellsWithScore := 0
	for _, c := range cells {
		totalScore += c.Score
		if c.Score > 0 {
			cellsWithScore++
		}
	}
	if cellsWithScore != 1 {
		t.Fatalf("expected score in exactly one cell, got %d", cellsWithScore)
	}
	if math.Abs(totalScore-0.8) > 1e-6 {
		t.Fatalf("expected total score 0.8, got %f", totalScore)
	}
}

func TestDensityRefusesAbsurdGrid(t *testing.T) {
	if Density(AOI{}, 0, 0, nil) != nil {
		t.Fatal("zero rows/cols must return nil")
	}
	if Density(AOI{}, 33, 33, nil) != nil {
		t.Fatal("over-cap grid must return nil")
	}
}

func TestCOAGreedyAssignsBestPK(t *testing.T) {
	threats := []ThreatLite{
		{ID: "t-high", PriorityScore: 0.9, ThreatClass: "cruise", Lat: 45.92, Lon: 24.78, AltitudeM: 200, SpeedMps: 260},
		{ID: "t-low", PriorityScore: 0.3, ThreatClass: "cruise", Lat: 45.88, Lon: 24.78, AltitudeM: 200, SpeedMps: 80},
	}
	effectors := []Effector{
		{ID: "pat", Lat: 45.87, Lon: 24.78, MinRangeM: 3000, MaxRangeM: 80_000,
			MinAltitudeM: 50, MaxAltitudeM: 25_000, MaxTargetSpeedMps: 2400,
			RoundsRemaining: 1, Status: "READY"},
	}
	steps := COA(COAInput{Threats: threats, Effectors: effectors})
	if len(steps) != 2 {
		t.Fatalf("expected 2 steps, got %d", len(steps))
	}
	if steps[0].EffectorID != "pat" {
		t.Fatalf("highest-priority threat should be assigned first; got %+v", steps[0])
	}
	if steps[1].EffectorID != "" {
		t.Fatalf("rounds=1 means second threat should be unassigned; got %+v", steps[1])
	}
}

func TestCOAReturnsEmptyOnEmptyInput(t *testing.T) {
	steps := COA(COAInput{})
	if len(steps) != 0 {
		t.Fatalf("expected empty result, got %+v", steps)
	}
}
