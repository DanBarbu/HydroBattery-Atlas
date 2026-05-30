package sim

import (
	"context"
	"math"
	"testing"
	"time"

	"github.com/will-platform/plugins/vector-mini-uas/internal/track"
)

func dist(lat1, lon1, lat2, lon2 float64) float64 {
	const earthR = 6_371_000.0
	dLat := (lat2 - lat1) * math.Pi / 180
	dLon := (lon2 - lon1) * math.Pi / 180 * math.Cos(lat1*math.Pi/180)
	return math.Hypot(dLat, dLon) * earthR
}

func TestOrbitsAroundCentre(t *testing.T) {
	cfg := Default()
	cfg.Period = 10 * time.Millisecond
	s := New(cfg)
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()
	out := make(chan track.Telemetry, 64)
	go func() { _ = s.Run(ctx, out) }()
	count := 0
	for {
		select {
		case tl := <-out:
			d := dist(tl.Lat, tl.Lon, cfg.OrbitCenterLat, cfg.OrbitCenterLon)
			// Within 10 % of OrbitRadiusM under flat-earth approx.
			if math.Abs(d-cfg.OrbitRadiusM) > 0.10*cfg.OrbitRadiusM {
				t.Fatalf("orbit radius drift: got %.0fm, expected ~%.0fm", d, cfg.OrbitRadiusM)
			}
			count++
		case <-ctx.Done():
			goto done
		}
	}
done:
	if count < 3 {
		t.Fatalf("only %d ticks observed", count)
	}
}

func TestBatteryDrainsAndSwitchesToRTL(t *testing.T) {
	cfg := Default()
	cfg.StartBatteryPct = 30
	cfg.DrainPctPerMin = 60 // 1 %/sec — easy to reason about
	s := New(cfg)

	// Deterministic: call tick(elapsed) directly rather than racing a ticker.
	earlyAuto := s.tick(1 * time.Second) // ~29 % battery, AUTO
	if earlyAuto.MissionMode != "AUTO" {
		t.Fatalf("at 29%% expected AUTO, got %q (battery=%.1f)", earlyAuto.MissionMode, earlyAuto.BatteryPct)
	}
	lateRTL := s.tick(10 * time.Second) // ~20 % battery, below 25 % threshold
	if lateRTL.MissionMode != "RTL" {
		t.Fatalf("below 25%% expected RTL, got %q (battery=%.1f)", lateRTL.MissionMode, lateRTL.BatteryPct)
	}
	if lateRTL.BatteryPct >= earlyAuto.BatteryPct {
		t.Fatalf("battery did not drain: early=%.1f late=%.1f", earlyAuto.BatteryPct, lateRTL.BatteryPct)
	}
}
