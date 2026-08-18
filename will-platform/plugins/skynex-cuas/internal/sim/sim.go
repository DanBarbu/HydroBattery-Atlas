// Package sim drives a small fleet of synthetic UAS detections toward a
// defended asset. The intent is plausible C-UAS scenarios for dev and HIL
// game-days, NOT operational accuracy. The real Skynex vendor adapter lives
// elsewhere (ADR-018 follow-up).
package sim

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/will-platform/plugins/skynex-cuas/internal/track"
)

// Config is the sim profile.
type Config struct {
	// BatteryLat/Lon mark the protected battery position; tracks approach it.
	BatteryLat, BatteryLon float64
	// NumTracks is how many concurrent inbound UAS to simulate.
	NumTracks int
	// PeriodS is the publish interval per track.
	PeriodS time.Duration
	// SpeedMps is the inbound ground speed.
	SpeedMps float64
	// StartRangeM is how far out each track begins.
	StartRangeM float64
	// AltitudeM is the cruise altitude.
	AltitudeM float64
}

// Default returns a sensible default profile centred on a Romanian inland AOI.
func Default() Config {
	return Config{
		BatteryLat: 45.872, BatteryLon: 24.776,
		NumTracks: 2, PeriodS: 2 * time.Second,
		SpeedMps: 45, StartRangeM: 5000, AltitudeM: 250,
	}
}

// Sim implements feed.Feed.
type Sim struct{ cfg Config }

func New(cfg Config) *Sim { return &Sim{cfg: cfg} }

func (s *Sim) Name() string { return "sim" }

// Run generates detections and posts them to out at cfg.PeriodS until ctx is
// cancelled.
func (s *Sim) Run(ctx context.Context, out chan<- track.Detection) error {
	starts := s.startPositions()
	t0 := time.Now()
	tick := time.NewTicker(s.cfg.PeriodS)
	defer tick.Stop()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case now := <-tick.C:
			elapsed := now.Sub(t0).Seconds()
			for i, start := range starts {
				d := s.advance(start, elapsed, i)
				select {
				case out <- d:
				case <-ctx.Done():
					return ctx.Err()
				}
			}
		}
	}
}

// startPositions distributes NumTracks evenly around the battery on a circle
// of StartRangeM metres, each heading inbound.
func (s *Sim) startPositions() []startPos {
	out := make([]startPos, 0, s.cfg.NumTracks)
	for i := 0; i < s.cfg.NumTracks; i++ {
		bearing := float64(i) * (360.0 / float64(s.cfg.NumTracks))
		lat, lon := offset(s.cfg.BatteryLat, s.cfg.BatteryLon, bearing, s.cfg.StartRangeM)
		out = append(out, startPos{lat: lat, lon: lon, bearing: bearing})
	}
	return out
}

type startPos struct {
	lat, lon float64
	bearing  float64
}

// advance moves a track inbound from its start by speed*elapsed metres along
// the reverse bearing (toward the battery).
func (s *Sim) advance(p startPos, elapsed float64, idx int) track.Detection {
	travelled := s.cfg.SpeedMps * elapsed
	// Bound to StartRangeM so the track doesn't fly past the battery.
	if travelled > s.cfg.StartRangeM {
		travelled = s.cfg.StartRangeM
	}
	reverse := math.Mod(p.bearing+180, 360)
	lat, lon := offset(p.lat, p.lon, reverse, travelled)
	return track.Detection{
		ID:  fmt.Sprintf("skynex-sim-%02d", idx),
		Lat: lat, Lon: lon, AltitudeM: s.cfg.AltitudeM,
		HeadingDeg: reverse, SpeedMps: s.cfg.SpeedMps,
		Class: "UAS", Confidence: 0.85, ObservedAt: time.Now().UTC(),
	}
}

// offset returns a (lat,lon) reached by travelling distanceM metres on the
// given bearing from (lat,lon). Flat-earth approximation; good for the few-km
// ranges Skynex engages at.
func offset(lat, lon, bearingDeg, distanceM float64) (float64, float64) {
	const earthR = 6_371_000.0
	br := bearingDeg * math.Pi / 180
	dLat := (distanceM * math.Cos(br)) / earthR * 180 / math.Pi
	dLon := (distanceM * math.Sin(br)) / (earthR * math.Cos(lat*math.Pi/180)) * 180 / math.Pi
	return lat + dLat, lon + dLon
}
