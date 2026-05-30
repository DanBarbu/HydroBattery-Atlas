package sim

import (
	"context"
	"math"
	"testing"
	"time"

	"github.com/will-platform/plugins/skynex-cuas/internal/track"
)

// haversineApprox: meters between two near points using flat-earth approx.
func dist(lat1, lon1, lat2, lon2 float64) float64 {
	const earthR = 6_371_000.0
	dLat := (lat2 - lat1) * math.Pi / 180
	dLon := (lon2 - lon1) * math.Pi / 180 * math.Cos(lat1*math.Pi/180)
	return math.Hypot(dLat, dLon) * earthR
}

func TestTracksApproachBattery(t *testing.T) {
	cfg := Default()
	cfg.PeriodS = 10 * time.Millisecond
	s := New(cfg)
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()
	out := make(chan track.Detection, 64)
	go func() { _ = s.Run(ctx, out) }()

	// Take a snapshot of first-tick positions and after a few ticks.
	first := map[string]track.Detection{}
	last := map[string]track.Detection{}
	for {
		select {
		case d := <-out:
			if _, ok := first[d.ID]; !ok {
				first[d.ID] = d
			}
			last[d.ID] = d
		case <-ctx.Done():
			goto done
		}
	}
done:
	if len(first) == 0 {
		t.Fatal("no detections received")
	}
	for id, f := range first {
		l := last[id]
		df := dist(f.Lat, f.Lon, cfg.BatteryLat, cfg.BatteryLon)
		dl := dist(l.Lat, l.Lon, cfg.BatteryLat, cfg.BatteryLon)
		if dl > df {
			t.Fatalf("track %s moved away from battery (first=%.0fm last=%.0fm)", id, df, dl)
		}
	}
}

func TestStartPositionsRingAroundBattery(t *testing.T) {
	cfg := Default()
	cfg.NumTracks = 4
	s := New(cfg)
	ps := s.startPositions()
	if len(ps) != 4 {
		t.Fatalf("got %d", len(ps))
	}
	for _, p := range ps {
		d := dist(p.lat, p.lon, cfg.BatteryLat, cfg.BatteryLon)
		// Each start should be within 10% of StartRangeM (flat-earth approx).
		if math.Abs(d-cfg.StartRangeM) > 0.10*cfg.StartRangeM {
			t.Fatalf("start at %.0fm, expected ~%.0fm", d, cfg.StartRangeM)
		}
	}
}
