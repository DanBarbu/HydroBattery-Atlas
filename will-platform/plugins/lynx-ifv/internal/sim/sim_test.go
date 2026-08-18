package sim

import (
	"math"
	"testing"
	"time"
)

func dist(lat1, lon1, lat2, lon2 float64) float64 {
	const earthR = 6_371_000.0
	dLat := (lat2 - lat1) * math.Pi / 180
	dLon := (lon2 - lon1) * math.Pi / 180 * math.Cos(lat1*math.Pi/180)
	return math.Hypot(dLat, dLon) * earthR
}

func TestColumnSpacingHolds(t *testing.T) {
	cfg := Default()
	s := New(cfg)
	// At t = 60s the lead is 480m ahead; trail vehicles trail by ColumnSpacingM.
	elapsed := 60 * time.Second
	lead := s.tick(0, elapsed)
	v2 := s.tick(1, elapsed)
	v3 := s.tick(2, elapsed)
	d12 := dist(lead.Lat, lead.Lon, v2.Lat, v2.Lon)
	d23 := dist(v2.Lat, v2.Lon, v3.Lat, v3.Lon)
	// Allow 10 % slack on the flat-earth approximation.
	for _, d := range []float64{d12, d23} {
		if math.Abs(d-cfg.ColumnSpacingM) > 0.10*cfg.ColumnSpacingM {
			t.Fatalf("column spacing drift: got %.1fm, expected ~%.0fm", d, cfg.ColumnSpacingM)
		}
	}
}

func TestFuelDrainsOverTime(t *testing.T) {
	cfg := Default()
	cfg.DrainPctPerMin = 6 // exaggerate for fast assertion
	s := New(cfg)
	early := s.tick(0, 10*time.Second)
	late := s.tick(0, 5*time.Minute)
	if late.FuelPct >= early.FuelPct {
		t.Fatalf("fuel did not drain: early=%.1f late=%.1f", early.FuelPct, late.FuelPct)
	}
}

func TestHaltedColumnReportsHalt(t *testing.T) {
	cfg := Default()
	cfg.MarchSpeedMps = 0
	s := New(cfg)
	pli := s.tick(0, 10*time.Second)
	if pli.Movement != "HALT" {
		t.Fatalf("expected HALT, got %q", pli.Movement)
	}
}
