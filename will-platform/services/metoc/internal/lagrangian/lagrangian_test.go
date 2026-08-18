package lagrangian

import (
	"math"
	"testing"
)

func TestAdvectRequiresPositiveDuration(t *testing.T) {
	if _, err := Advect(BlackSeaSurface(), DriftParams{Lat: 44, Lon: 29, DurationS: 0}); err != ErrBadDuration {
		t.Fatalf("want ErrBadDuration, got %v", err)
	}
}

func TestAdvectRejectsTooManySteps(t *testing.T) {
	p := DriftParams{Lat: 44, Lon: 29, DurationS: 1e9, StepS: 1}
	if _, err := Advect(BlackSeaSurface(), p); err != ErrTooManySteps {
		t.Fatalf("want ErrTooManySteps, got %v", err)
	}
}

func TestAdvectMovesDownstreamAndSpreads(t *testing.T) {
	// Pure eastward 1 m/s current, no fallback.
	f := Field{FallbackUEast: 1.0, FallbackVNorth: 0, RadiusM: 1000}
	wp, err := Advect(f, DriftParams{Lat: 44, Lon: 29, DurationS: 3600, StepS: 600})
	if err != nil {
		t.Fatal(err)
	}
	if len(wp) != 7 { // t=0 plus 6 steps
		t.Fatalf("want 7 waypoints, got %d", len(wp))
	}
	first, last := wp[0], wp[len(wp)-1]
	if last.Lon <= first.Lon {
		t.Errorf("eastward current should increase lon: %f -> %f", first.Lon, last.Lon)
	}
	if math.Abs(last.Lat-first.Lat) > 1e-6 {
		t.Errorf("no north velocity yet lat moved: %f -> %f", first.Lat, last.Lat)
	}
	if last.SpreadM <= first.SpreadM {
		t.Errorf("uncertainty should grow with time")
	}
	// ~1 m/s east for 3600 s ≈ 3600 m ≈ 0.0457 deg lon at lat 44.
	wantDeg := 3600.0 / (111320.0 * math.Cos(44*math.Pi/180))
	if math.Abs((last.Lon-first.Lon)-wantDeg) > 0.005 {
		t.Errorf("displacement off: got %f want ~%f deg", last.Lon-first.Lon, wantDeg)
	}
}

func TestWindageAddsLeeway(t *testing.T) {
	f := Field{RadiusM: 1000} // zero current
	noWind, _ := Advect(f, DriftParams{Lat: 44, Lon: 29, DurationS: 3600, StepS: 600})
	withWind, _ := Advect(f, DriftParams{
		Lat: 44, Lon: 29, DurationS: 3600, StepS: 600,
		Windage: 0.03, WindUEast: 10,
	})
	if withWind[len(withWind)-1].Lon <= noWind[len(noWind)-1].Lon {
		t.Errorf("windage with eastward wind should push parcel east")
	}
}

func TestFieldAtUsesNearestSample(t *testing.T) {
	f := Field{
		Samples: []Sample{{Lat: 44.0, Lon: 29.0, UEastMps: 2, VNorthMps: -1}},
		RadiusM: 50000,
	}
	u, v := f.At(44.001, 29.001)
	if math.Abs(u-2) > 0.01 || math.Abs(v-(-1)) > 0.01 {
		t.Errorf("near a sample should return ~its value, got u=%f v=%f", u, v)
	}
	// Far away -> fallback.
	f.FallbackUEast, f.FallbackVNorth = 9, 9
	u, v = f.At(10, 10)
	if u != 9 || v != 9 {
		t.Errorf("far from samples should use fallback, got u=%f v=%f", u, v)
	}
}
