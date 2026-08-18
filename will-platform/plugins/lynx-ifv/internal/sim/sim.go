// Package sim drives a synthetic Lynx KF41 platoon (default 4 vehicles)
// along a road-march heading, with column spacing and fuel drain. Intent is
// dev/HIL plausibility, not vehicle-dynamics fidelity.
package sim

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/will-platform/plugins/lynx-ifv/internal/track"
)

type Config struct {
	UnitPrefix     string
	StartLat       float64
	StartLon       float64
	HeadingDeg     float64
	MarchSpeedMps  float64 // 8-15 m/s for an IFV column on a road
	ColumnSpacingM float64
	Vehicles       int
	Period         time.Duration
	StartFuelPct   float64
	DrainPctPerMin float64
}

func Default() Config {
	return Config{
		UnitPrefix: "lynx",
		StartLat:   45.850, StartLon: 24.780,
		HeadingDeg: 90, MarchSpeedMps: 8,
		ColumnSpacingM: 75,
		Vehicles:       4,
		Period:         2 * time.Second,
		StartFuelPct:   92,
		DrainPctPerMin: 0.4,
	}
}

type Sim struct{ cfg Config }

func New(cfg Config) *Sim { return &Sim{cfg: cfg} }

func (s *Sim) Name() string { return "sim" }

// Run advances the column along HeadingDeg at MarchSpeedMps; each vehicle
// holds station at index*ColumnSpacingM behind the lead.
func (s *Sim) Run(ctx context.Context, out chan<- track.PlatformPLI) error {
	t0 := time.Now()
	tick := time.NewTicker(s.cfg.Period)
	defer tick.Stop()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case now := <-tick.C:
			elapsed := now.Sub(t0)
			for i := 0; i < s.cfg.Vehicles; i++ {
				select {
				case out <- s.tick(i, elapsed):
				case <-ctx.Done():
					return ctx.Err()
				}
			}
		}
	}
}

// tick returns vehicle idx's PLI after elapsed time. Exported within the
// package so tests can drive deterministic instants without racing the timer.
func (s *Sim) tick(idx int, elapsed time.Duration) track.PlatformPLI {
	leadDist := s.cfg.MarchSpeedMps * elapsed.Seconds()
	// idx 0 = lead; later vehicles trail behind by ColumnSpacingM each.
	dist := leadDist - float64(idx)*s.cfg.ColumnSpacingM
	if dist < 0 {
		dist = 0
	}
	lat, lon := offset(s.cfg.StartLat, s.cfg.StartLon, s.cfg.HeadingDeg, dist)
	fuel := s.cfg.StartFuelPct - s.cfg.DrainPctPerMin*elapsed.Minutes()
	if fuel < 0 {
		fuel = 0
	}
	move := track.MoveRoute
	if s.cfg.MarchSpeedMps < 0.1 {
		move = track.MoveHalt
	}
	return track.PlatformPLI{
		UnitID:       fmt.Sprintf("%s-%02d", s.cfg.UnitPrefix, idx+1),
		Callsign:     fmt.Sprintf("ALFA-%d", idx+1),
		Lat:          lat,
		Lon:          lon,
		AltitudeM:    480,
		HeadingDeg:   s.cfg.HeadingDeg,
		SpeedMps:     s.cfg.MarchSpeedMps,
		FuelPct:      fuel,
		EngineStatus: "OK",
		CommsStatus:  "OK",
		CrewSize:     6,
		Crew:         track.CrewMounted,
		Movement:     move,
		AmmoMain:     200,
		AmmoCoax:     800,
		AmmoSpike:    4,
		ObservedAt:   time.Now().UTC(),
	}
}

// offset: flat-earth bearing+distance offset; sufficient for tens-of-km
// road marches an IFV column moves on a single mission day.
func offset(lat, lon, bearingDeg, distanceM float64) (float64, float64) {
	const earthR = 6_371_000.0
	br := bearingDeg * math.Pi / 180
	dLat := (distanceM * math.Cos(br)) / earthR * 180 / math.Pi
	dLon := (distanceM * math.Sin(br)) / (earthR * math.Cos(lat*math.Pi/180)) * 180 / math.Pi
	return lat + dLat, lon + dLon
}
