package pairing

import "testing"

func patriot() Effector {
	return Effector{
		ID: "pat-1", Kind: KindSamArea, Status: "READY",
		Lat: 45.87, Lon: 24.78,
		MinRangeM: 3_000, MaxRangeM: 80_000,
		MinAltitudeM: 50, MaxAltitudeM: 25_000,
		MaxTargetSpeedMps: 2_400,
		RoundsRemaining: 8,
	}
}

func nsm() Effector {
	return Effector{
		ID: "nsm-1", Kind: KindNSMCoastal, Status: "READY",
		Lat: 44.20, Lon: 28.65,
		MinRangeM: 3_000, MaxRangeM: 200_000,
		MinAltitudeM: -10, MaxAltitudeM: 5_000,
		MaxTargetSpeedMps: 700,
		RoundsRemaining: 4,
	}
}

func cUAS() Effector {
	return Effector{
		ID: "cuas-1", Kind: KindCUAS, Status: "READY",
		Lat: 45.87, Lon: 24.78,
		MinRangeM: 50, MaxRangeM: 2_500,
		MinAltitudeM: 0, MaxAltitudeM: 600,
		MaxTargetSpeedMps: 60,
		RoundsRemaining: 200,
	}
}

func TestPatriotEngagesCruise(t *testing.T) {
	target := Target{Lat: 45.92, Lon: 24.78, AltitudeM: 200, SpeedMps: 260, ThreatClass: "cruise"}
	m, ok := Best(target, []Effector{patriot(), nsm(), cUAS()})
	if !ok {
		t.Fatal("expected a match")
	}
	if m.Effector.ID != "pat-1" {
		t.Fatalf("expected Patriot to win, got %s", m.Effector.ID)
	}
}

func TestCUASPrefersUAVOneWay(t *testing.T) {
	target := Target{Lat: 45.872, Lon: 24.78, AltitudeM: 120, SpeedMps: 30, ThreatClass: "uav_one_way"}
	m, ok := Best(target, []Effector{patriot(), cUAS()})
	if !ok {
		t.Fatal("expected a match")
	}
	if m.Effector.ID != "cuas-1" {
		t.Fatalf("expected C-UAS to win at low/slow target, got %s (range margin=%.0f)", m.Effector.ID, m.RangeMarginM)
	}
}

func TestNoMatchWhenStatusNotReady(t *testing.T) {
	e := patriot()
	e.Status = "MAINTENANCE"
	target := Target{Lat: 45.92, Lon: 24.78, AltitudeM: 200, SpeedMps: 260, ThreatClass: "cruise"}
	if _, ok := Best(target, []Effector{e}); ok {
		t.Fatal("expected no match when status != READY")
	}
}

func TestNoMatchWhenOutOfRange(t *testing.T) {
	// Patriot has 80 km max; target 200 km away.
	target := Target{Lat: 47.5, Lon: 26.0, AltitudeM: 200, SpeedMps: 260, ThreatClass: "cruise"}
	if _, ok := Best(target, []Effector{patriot()}); ok {
		t.Fatal("expected no match out of range")
	}
}

func TestNoMatchWhenKindIncompatible(t *testing.T) {
	target := Target{Lat: 44.25, Lon: 28.70, AltitudeM: 5, SpeedMps: 30, ThreatClass: "surface"}
	// Only NSM is compatible with surface targets; pass a Patriot only.
	if _, ok := Best(target, []Effector{patriot()}); ok {
		t.Fatal("expected no match: Patriot is not compatible with surface")
	}
}

func TestPicksFitWhenOnlyNSMCompatible(t *testing.T) {
	target := Target{Lat: 44.25, Lon: 28.70, AltitudeM: 5, SpeedMps: 30, ThreatClass: "surface"}
	m, ok := Best(target, []Effector{patriot(), nsm()})
	if !ok || m.Effector.ID != "nsm-1" {
		t.Fatalf("expected NSM for surface target, got match=%v id=%s", ok, m.Effector.ID)
	}
}

func TestRoundsRemainingZeroExcludes(t *testing.T) {
	e := patriot()
	e.RoundsRemaining = 0
	if _, ok := Best(Target{Lat: 45.92, Lon: 24.78, AltitudeM: 200, SpeedMps: 260, ThreatClass: "cruise"}, []Effector{e}); ok {
		t.Fatal("expected no match with zero rounds")
	}
}

func capFighter() Effector {
	return Effector{
		ID: "soim-01", Kind: KindAirIntercept, Status: "READY",
		Lat: 45.80, Lon: 24.70,
		MinRangeM: 2_000, MaxRangeM: 100_000,
		MinAltitudeM: 30, MaxAltitudeM: 18_000,
		MaxTargetSpeedMps: 900, RoundsRemaining: 8,
	}
}

func skynex() Effector {
	return Effector{
		ID: "skynex-1", Kind: KindGunSHORAD, Status: "READY",
		Lat: 45.87, Lon: 24.78,
		MinRangeM: 100, MaxRangeM: 4_000,
		MinAltitudeM: 0, MaxAltitudeM: 3_500,
		MaxTargetSpeedMps: 1_000, RoundsRemaining: 1_200,
	}
}

func TestPatriotEngagesBallistic(t *testing.T) {
	// Ballistic threat 40 km out, 10 km altitude, fast.
	target := Target{Lat: 46.2, Lon: 24.78, AltitudeM: 10_000, SpeedMps: 1_800, ThreatClass: "ballistic"}
	m, ok := Best(target, []Effector{patriot(), capFighter(), skynex()})
	if !ok || m.Effector.ID != "pat-1" {
		t.Fatalf("expected Patriot to take the ballistic, got ok=%v id=%s", ok, m.Effector.ID)
	}
}

func TestCapFighterDoesNotDoBallistic(t *testing.T) {
	target := Target{Lat: 45.85, Lon: 24.75, AltitudeM: 10_000, SpeedMps: 1_800, ThreatClass: "ballistic"}
	if _, ok := Best(target, []Effector{capFighter()}); ok {
		t.Fatal("CAP fighter must not be paired against a ballistic threat")
	}
}

func TestCapFighterEngagesAircraft(t *testing.T) {
	target := Target{Lat: 45.95, Lon: 24.85, AltitudeM: 8_000, SpeedMps: 250, ThreatClass: "aircraft"}
	m, ok := Best(target, []Effector{capFighter()})
	if !ok || m.Effector.ID != "soim-01" {
		t.Fatalf("expected CAP fighter to engage aircraft, got ok=%v id=%s", ok, m.Effector.ID)
	}
}

func TestSkynexTakesCloseInSwarm(t *testing.T) {
	// Low slow swarm 2 km from the gun; Patriot is min-range 3 km so it
	// cannot, and the CAP fighter min-altitude excludes a 100 m threat.
	target := Target{Lat: 45.882, Lon: 24.78, AltitudeM: 100, SpeedMps: 40, ThreatClass: "swarm"}
	m, ok := Best(target, []Effector{patriot(), capFighter(), skynex()})
	if !ok || m.Effector.ID != "skynex-1" {
		t.Fatalf("expected Skynex for the close-in swarm, got ok=%v id=%s", ok, m.Effector.ID)
	}
}
