// Package sim drives a synthetic Skyranger 35 scenario: the mount drives a
// short patrol leg while a small fleet of UAS targets approach it. Intent is
// dev/HIL plausibility, not operational accuracy.
package sim

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/will-platform/plugins/skyranger-vshorad/internal/feed"
	"github.com/will-platform/plugins/skyranger-vshorad/internal/track"
)

type Config struct {
	UnitID                     string
	StartLat, StartLon         float64
	HeadingDeg                 float64 // direction of the patrol leg
	PatrolSpeedMps             float64 // ~5 m/s for an 8x8 on the move
	PatrolPeriod               time.Duration
	NumTracks                  int
	ThreatSpeedMps             float64
	ThreatAltitudeM            float64
	ThreatStartRangeM          float64
	DetectionPeriod            time.Duration
	InitialRounds, InitialMsls int
}

func Default() Config {
	return Config{
		UnitID:   "skyranger-A1",
		StartLat: 45.700, StartLon: 24.500,
		HeadingDeg: 45, PatrolSpeedMps: 5,
		PatrolPeriod:   1 * time.Second,
		NumTracks:      2,
		ThreatSpeedMps: 55, ThreatAltitudeM: 200, ThreatStartRangeM: 4500,
		DetectionPeriod: 2 * time.Second,
		InitialRounds:   252, InitialMsls: 4,
	}
}

type Sim struct{ cfg Config }

func New(cfg Config) *Sim { return &Sim{cfg: cfg} }

func (s *Sim) Name() string { return "sim" }

func (s *Sim) Run(ctx context.Context, out chan<- feed.Event) error {
	t0 := time.Now()
	patrolTick := time.NewTicker(s.cfg.PatrolPeriod)
	detTick := time.NewTicker(s.cfg.DetectionPeriod)
	defer patrolTick.Stop()
	defer detTick.Stop()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case now := <-patrolTick.C:
			pli := s.platformAt(now.Sub(t0))
			send(ctx, out, feed.Event{Platform: &pli})
		case now := <-detTick.C:
			pli := s.platformAt(now.Sub(t0))
			for i := 0; i < s.cfg.NumTracks; i++ {
				d := s.threatAt(pli.Lat, pli.Lon, now.Sub(t0), i)
				send(ctx, out, feed.Event{Detection: &d})
			}
		}
	}
}

func send(ctx context.Context, out chan<- feed.Event, ev feed.Event) {
	select {
	case out <- ev:
	case <-ctx.Done():
	}
}

// platformAt returns the mount's PLI after elapsed time on a straight patrol leg.
func (s *Sim) platformAt(elapsed time.Duration) track.PlatformPLI {
	dist := s.cfg.PatrolSpeedMps * elapsed.Seconds()
	lat, lon := offset(s.cfg.StartLat, s.cfg.StartLon, s.cfg.HeadingDeg, dist)
	return track.PlatformPLI{
		UnitID: s.cfg.UnitID, Lat: lat, Lon: lon,
		HeadingDeg: s.cfg.HeadingDeg, SpeedMps: s.cfg.PatrolSpeedMps,
		Ammo: s.cfg.InitialRounds, Missiles: s.cfg.InitialMsls, Mode: "READY",
		ObservedAt: time.Now().UTC(),
	}
}

// threatAt returns the i-th hostile UAS converging on the platform's current
// position from its initial bearing.
func (s *Sim) threatAt(plLat, plLon float64, elapsed time.Duration, idx int) track.Detection {
	bearing := float64(idx) * (360.0 / float64(s.cfg.NumTracks))
	sLat, sLon := offset(plLat, plLon, bearing, s.cfg.ThreatStartRangeM)
	travelled := s.cfg.ThreatSpeedMps * elapsed.Seconds()
	if travelled > s.cfg.ThreatStartRangeM {
		travelled = s.cfg.ThreatStartRangeM
	}
	reverse := math.Mod(bearing+180, 360)
	tLat, tLon := offset(sLat, sLon, reverse, travelled)
	return track.Detection{
		ID:  fmt.Sprintf("skr-sim-%02d", idx),
		Lat: tLat, Lon: tLon, AltitudeM: s.cfg.ThreatAltitudeM,
		HeadingDeg: reverse, SpeedMps: s.cfg.ThreatSpeedMps,
		Class: "UAS", Confidence: 0.85, ObservedAt: time.Now().UTC(),
	}
}

// offset: flat-earth bearing+distance offset. Sufficient for the few-km
// engagement envelopes Skyranger operates at.
func offset(lat, lon, bearingDeg, distanceM float64) (float64, float64) {
	const earthR = 6_371_000.0
	br := bearingDeg * math.Pi / 180
	dLat := (distanceM * math.Cos(br)) / earthR * 180 / math.Pi
	dLon := (distanceM * math.Sin(br)) / (earthR * math.Cos(lat*math.Pi/180)) * 180 / math.Pi
	return lat + dLat, lon + dLon
}
