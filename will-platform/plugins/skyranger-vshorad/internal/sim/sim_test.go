package sim

import (
	"context"
	"math"
	"testing"
	"time"

	"github.com/will-platform/plugins/skyranger-vshorad/internal/feed"
)

func dist(lat1, lon1, lat2, lon2 float64) float64 {
	const earthR = 6_371_000.0
	dLat := (lat2 - lat1) * math.Pi / 180
	dLon := (lon2 - lon1) * math.Pi / 180 * math.Cos(lat1*math.Pi/180)
	return math.Hypot(dLat, dLon) * earthR
}

func TestPlatformMovesAlongPatrolLeg(t *testing.T) {
	cfg := Default()
	cfg.PatrolPeriod = 10 * time.Millisecond
	cfg.DetectionPeriod = time.Hour // suppress detections
	s := New(cfg)
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()
	out := make(chan feed.Event, 64)
	go func() { _ = s.Run(ctx, out) }()

	var first, last *float64
	var firstLat, lastLat, firstLon, lastLon float64
	for {
		select {
		case ev := <-out:
			if ev.Platform != nil {
				if first == nil {
					firstLat, firstLon = ev.Platform.Lat, ev.Platform.Lon
					first = &firstLat
				}
				lastLat, lastLon = ev.Platform.Lat, ev.Platform.Lon
				last = &lastLat
			}
		case <-ctx.Done():
			goto done
		}
	}
done:
	if first == nil || last == nil {
		t.Fatal("no platform PLI received")
	}
	if dist(firstLat, firstLon, lastLat, lastLon) <= 0 {
		t.Fatal("platform did not move along patrol leg")
	}
}

func TestDetectionsConvergeOnPlatform(t *testing.T) {
	cfg := Default()
	cfg.PatrolSpeedMps = 0 // hold position to make the convergence test deterministic
	cfg.PatrolPeriod = time.Hour
	cfg.DetectionPeriod = 10 * time.Millisecond
	s := New(cfg)
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()
	out := make(chan feed.Event, 256)
	go func() { _ = s.Run(ctx, out) }()

	firstByID := map[string]float64{}
	lastByID := map[string]float64{}
	for {
		select {
		case ev := <-out:
			if ev.Detection != nil {
				d := dist(ev.Detection.Lat, ev.Detection.Lon, cfg.StartLat, cfg.StartLon)
				if _, ok := firstByID[ev.Detection.ID]; !ok {
					firstByID[ev.Detection.ID] = d
				}
				lastByID[ev.Detection.ID] = d
			}
		case <-ctx.Done():
			goto done
		}
	}
done:
	if len(firstByID) == 0 {
		t.Fatal("no detections received")
	}
	for id, f := range firstByID {
		l := lastByID[id]
		if l > f {
			t.Fatalf("detection %s drifted away from platform (first=%.0fm last=%.0fm)", id, f, l)
		}
	}
}
