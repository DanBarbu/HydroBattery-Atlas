// Package sim drives a synthetic MMPV-90 Black Sea patrol scenario: the
// corvette steams east from a Romanian port, the surface radar holds an
// unknown small-craft contact, the air radar holds an unknown high-altitude
// transit, and the AIS receiver picks up a westbound merchant. Intent is
// dev/HIL plausibility, not maritime-domain fidelity.
package sim

import (
	"context"
	"math"
	"time"

	"github.com/will-platform/plugins/mmpv90-naval/internal/feed"
	"github.com/will-platform/plugins/mmpv90-naval/internal/track"
)

type Config struct {
	HullID             string
	Pennant            string
	StartLat, StartLon float64
	HeadingDeg         float64
	CruiseSpeedMps     float64
	OwnShipPeriod      time.Duration
	DetectionPeriod    time.Duration
	AISPeriod          time.Duration
	StartFuelPct       float64
	DrainPctPerMin     float64
}

func Default() Config {
	return Config{
		HullID: "F501", Pennant: "501",
		StartLat: 44.170, StartLon: 28.650, // Constanța approach
		HeadingDeg: 90, CruiseSpeedMps: 12, // ~23 knots
		OwnShipPeriod:   2 * time.Second,
		DetectionPeriod: 3 * time.Second,
		AISPeriod:       5 * time.Second,
		StartFuelPct:    88,
		DrainPctPerMin:  0.15,
	}
}

type Sim struct{ cfg Config }

func New(cfg Config) *Sim { return &Sim{cfg: cfg} }

func (s *Sim) Name() string { return "sim" }

// Run multiplexes three tickers onto the events channel.
func (s *Sim) Run(ctx context.Context, out chan<- feed.Event) error {
	t0 := time.Now()
	own := time.NewTicker(s.cfg.OwnShipPeriod)
	det := time.NewTicker(s.cfg.DetectionPeriod)
	ais := time.NewTicker(s.cfg.AISPeriod)
	defer own.Stop()
	defer det.Stop()
	defer ais.Stop()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case now := <-own.C:
			pli := s.ownShipAt(now.Sub(t0))
			send(ctx, out, feed.Event{OwnShip: &pli})
		case now := <-det.C:
			pli := s.ownShipAt(now.Sub(t0))
			surf := s.surfaceContactAt(pli.Lat, pli.Lon, now.Sub(t0))
			air := s.airContactAt(pli.Lat, pli.Lon, now.Sub(t0))
			send(ctx, out, feed.Event{Detection: &surf})
			send(ctx, out, feed.Event{Detection: &air})
		case now := <-ais.C:
			pli := s.ownShipAt(now.Sub(t0))
			ais := s.aisMerchantAt(pli.Lat, pli.Lon, now.Sub(t0))
			send(ctx, out, feed.Event{AIS: &ais})
		}
	}
}

func send(ctx context.Context, out chan<- feed.Event, ev feed.Event) {
	select {
	case out <- ev:
	case <-ctx.Done():
	}
}

// ownShipAt returns the corvette's PLI after elapsed time on a straight leg.
func (s *Sim) ownShipAt(elapsed time.Duration) track.OwnShipPLI {
	dist := s.cfg.CruiseSpeedMps * elapsed.Seconds()
	lat, lon := offset(s.cfg.StartLat, s.cfg.StartLon, s.cfg.HeadingDeg, dist)
	fuel := s.cfg.StartFuelPct - s.cfg.DrainPctPerMin*elapsed.Minutes()
	if fuel < 0 {
		fuel = 0
	}
	return track.OwnShipPLI{
		HullID: s.cfg.HullID, Pennant: s.cfg.Pennant,
		Lat: lat, Lon: lon,
		HeadingDeg: s.cfg.HeadingDeg, SpeedMps: s.cfg.CruiseSpeedMps,
		Heel: 1.0, SeaState: 3, FuelPct: fuel,
		HelmStatus: "AUTO", CommsStatus: "OK",
		ObservedAt: time.Now().UTC(),
	}
}

// surfaceContactAt: an unknown-affiliation small craft 4 nm north-east of own ship.
func (s *Sim) surfaceContactAt(plLat, plLon float64, elapsed time.Duration) track.Detection {
	// Drift the contact a little to make it feel live.
	bearing := math.Mod(45+elapsed.Seconds()*0.1, 360)
	lat, lon := offset(plLat, plLon, bearing, 7500)
	return track.Detection{
		ID:     "mmpv90-surf-01",
		Domain: track.DomainSurface, Aff: track.AffUnknown, Sensor: "SURFACE_RADAR",
		Lat: lat, Lon: lon, AltitudeM: 0,
		HeadingDeg: 200, SpeedMps: 6, Confidence: 0.7,
		ObservedAt: time.Now().UTC(),
	}
}

// airContactAt: an unknown high-altitude transit 30 km south of own ship.
func (s *Sim) airContactAt(plLat, plLon float64, elapsed time.Duration) track.Detection {
	lat, lon := offset(plLat, plLon, 180, 30000)
	// Advance the air contact along an east-west transit.
	advance := 220.0 * elapsed.Seconds() // 220 m/s ~ 420 kt
	lat2, lon2 := offset(lat, lon, 270, advance)
	return track.Detection{
		ID:     "mmpv90-air-01",
		Domain: track.DomainAir, Aff: track.AffUnknown, Sensor: "AIR_RADAR",
		Lat: lat2, Lon: lon2, AltitudeM: 9500,
		HeadingDeg: 270, SpeedMps: 220, Confidence: 0.6,
		ObservedAt: time.Now().UTC(),
	}
}

// aisMerchantAt: a westbound merchant transiting parallel to the patrol leg.
func (s *Sim) aisMerchantAt(plLat, plLon float64, elapsed time.Duration) track.AISContact {
	// Park a merchant 12 km north on a westbound course.
	lat, lon := offset(plLat, plLon, 0, 12000)
	advance := 7.0 * elapsed.Seconds() // 7 m/s ~ 14 kt
	lat2, lon2 := offset(lat, lon, 270, advance)
	return track.AISContact{
		MMSI: "271012345", Name: "MV STAR PILOT", CallSign: "TC2345",
		Lat: lat2, Lon: lon2,
		HeadingDeg: 270, SpeedMps: 7,
		Type:       "CARGO",
		ObservedAt: time.Now().UTC(),
	}
}

// offset: flat-earth bearing+distance offset. Adequate for the tens-of-km
// engagement/detection envelopes of an MMPV-class patrol vessel.
func offset(lat, lon, bearingDeg, distanceM float64) (float64, float64) {
	const earthR = 6_371_000.0
	br := bearingDeg * math.Pi / 180
	dLat := (distanceM * math.Cos(br)) / earthR * 180 / math.Pi
	dLon := (distanceM * math.Sin(br)) / (earthR * math.Cos(lat*math.Pi/180)) * 180 / math.Pi
	return lat + dLat, lon + dLon
}
