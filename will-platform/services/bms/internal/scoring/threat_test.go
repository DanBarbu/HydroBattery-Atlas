package scoring

import "testing"

var assets = []DefendedAsset{
	{Name: "Cincu HQ", Lat: 45.8696, Lon: 24.7753},
}

func TestFriendlyScoresLow(t *testing.T) {
	r := Score(Track{Affiliation: "F", SpeedMps: 300, Class: ClassAircraft, Lat: 45.87, Lon: 24.78, HeadingDeg: 0}, assets, DefaultWeights())
	if r.Score > 0.25 {
		t.Fatalf("friendly should score low, got %.3f", r.Score)
	}
}

func TestHostileClosingCruiseScoresHigh(t *testing.T) {
	// Hostile cruise missile 5 km away, heading directly at the asset.
	r := Score(Track{
		Affiliation: "H", SpeedMps: 250, Class: ClassCruise,
		Lat: 45.92, Lon: 24.78, HeadingDeg: 180,
	}, assets, DefaultWeights())
	if r.Score < 0.55 {
		t.Fatalf("hostile closing cruise should score high, got %.3f (%v)", r.Score, r.Components)
	}
}

func TestBallisticAlwaysBeatsAircraft(t *testing.T) {
	weights := DefaultWeights()
	ballistic := Score(Track{Affiliation: "U", SpeedMps: 600, Class: ClassBallistic, Lat: 45.92, Lon: 24.78}, assets, weights)
	aircraft := Score(Track{Affiliation: "U", SpeedMps: 600, Class: ClassAircraft, Lat: 45.92, Lon: 24.78}, assets, weights)
	if ballistic.Score <= aircraft.Score {
		t.Fatalf("ballistic %.3f should beat aircraft %.3f at equal kinematics", ballistic.Score, aircraft.Score)
	}
}

func TestProximityBoostsScore(t *testing.T) {
	w := DefaultWeights()
	close := Score(Track{Affiliation: "H", SpeedMps: 100, Class: ClassUAVOneWay, Lat: 45.87, Lon: 24.78}, assets, w)
	far := Score(Track{Affiliation: "H", SpeedMps: 100, Class: ClassUAVOneWay, Lat: 47.00, Lon: 26.00}, assets, w)
	if close.Score <= far.Score {
		t.Fatalf("proximity should boost: close=%.3f far=%.3f", close.Score, far.Score)
	}
}

func TestRecedingScoresLowerThanClosing(t *testing.T) {
	w := DefaultWeights()
	closing := Score(Track{Affiliation: "H", SpeedMps: 200, Class: ClassCruise, Lat: 45.92, Lon: 24.78, HeadingDeg: 180}, assets, w)
	receding := Score(Track{Affiliation: "H", SpeedMps: 200, Class: ClassCruise, Lat: 45.92, Lon: 24.78, HeadingDeg: 0}, assets, w)
	if closing.Score <= receding.Score {
		t.Fatalf("closing %.3f should beat receding %.3f", closing.Score, receding.Score)
	}
}

func TestEmptyAssetsHasZeroHeadingAndProximityComponents(t *testing.T) {
	r := Score(Track{Affiliation: "H", SpeedMps: 200, Class: ClassCruise, Lat: 45.92, Lon: 24.78}, nil, DefaultWeights())
	if r.Components["heading"] != 0 || r.Components["proximity"] != 0 {
		t.Fatalf("expected zero heading/proximity, got %v", r.Components)
	}
}

func TestScoreClampedToUnitInterval(t *testing.T) {
	r := Score(Track{Affiliation: "H", SpeedMps: 10_000, Class: ClassBallistic, Lat: 45.87, Lon: 24.78, HeadingDeg: 180}, assets, DefaultWeights())
	if r.Score < 0 || r.Score > 1 {
		t.Fatalf("score out of range: %.3f", r.Score)
	}
}
