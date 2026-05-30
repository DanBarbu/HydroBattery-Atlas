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

func TestOwnShipAdvancesEastAlongLeg(t *testing.T) {
	cfg := Default()
	s := New(cfg)
	a := s.ownShipAt(0)
	b := s.ownShipAt(60 * time.Second)
	if dist(a.Lat, a.Lon, b.Lat, b.Lon) <= 0 {
		t.Fatal("ownship did not advance")
	}
	if b.Lon <= a.Lon {
		t.Fatal("ownship did not move east on heading 090")
	}
	if b.FuelPct >= a.FuelPct {
		t.Fatal("fuel did not drain")
	}
}

func TestSurfaceContactHeldNearOwnShip(t *testing.T) {
	cfg := Default()
	s := New(cfg)
	pli := s.ownShipAt(30 * time.Second)
	d := s.surfaceContactAt(pli.Lat, pli.Lon, 30*time.Second)
	r := dist(pli.Lat, pli.Lon, d.Lat, d.Lon)
	// Contact is parked ~7.5 km from own ship; allow 10 % flat-earth slack.
	if r < 6500 || r > 8500 {
		t.Fatalf("surface contact at %.0fm, expected ~7500m", r)
	}
}

func TestAirContactAtAltitude(t *testing.T) {
	cfg := Default()
	s := New(cfg)
	pli := s.ownShipAt(10 * time.Second)
	d := s.airContactAt(pli.Lat, pli.Lon, 10*time.Second)
	if d.AltitudeM < 5000 {
		t.Fatalf("air contact altitude=%.0fm too low", d.AltitudeM)
	}
}

func TestAISMerchantTransitsWest(t *testing.T) {
	cfg := Default()
	s := New(cfg)
	pli := s.ownShipAt(0)
	a := s.aisMerchantAt(pli.Lat, pli.Lon, 0)
	b := s.aisMerchantAt(pli.Lat, pli.Lon, 5*time.Minute)
	if b.Lon >= a.Lon {
		t.Fatal("AIS merchant should have moved west")
	}
}
