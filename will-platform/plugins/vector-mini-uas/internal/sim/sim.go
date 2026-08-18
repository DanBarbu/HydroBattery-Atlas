// Package sim drives a synthetic Vector flying a closed reconnaissance loop
// with battery drain. Intent is dev/HIL plausibility, not flight-test fidelity.
package sim

import (
	"context"
	"math"
	"time"

	"github.com/will-platform/plugins/vector-mini-uas/internal/track"
)

type Config struct {
	UnitID          string
	Variant         string // "Vector" | "Scorpion"
	OrbitCenterLat  float64
	OrbitCenterLon  float64
	OrbitRadiusM    float64
	CruiseSpeedMps  float64 // ~18 m/s for Vector
	CruiseAltM      float64
	Period          time.Duration
	StartBatteryPct float64
	DrainPctPerMin  float64
	VideoURL        string
}

func Default() Config {
	return Config{
		UnitID:         "vector-01",
		Variant:        "Vector",
		OrbitCenterLat: 45.870, OrbitCenterLon: 24.800,
		OrbitRadiusM:    1500,
		CruiseSpeedMps:  18,
		CruiseAltM:      400,
		Period:          1 * time.Second,
		StartBatteryPct: 95,
		DrainPctPerMin:  1.5,
		VideoURL:        "",
	}
}

type Sim struct{ cfg Config }

func New(cfg Config) *Sim { return &Sim{cfg: cfg} }

func (s *Sim) Name() string { return "sim" }

// Run circles the orbit centre at OrbitRadiusM, draining battery as it flies,
// and switches the mission mode AUTO -> RTL once battery drops below 25 %.
func (s *Sim) Run(ctx context.Context, out chan<- track.Telemetry) error {
	t0 := time.Now()
	tick := time.NewTicker(s.cfg.Period)
	defer tick.Stop()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case now := <-tick.C:
			out <- s.tick(now.Sub(t0))
		}
	}
}

func (s *Sim) tick(elapsed time.Duration) track.Telemetry {
	// Angular position around the orbit.
	circumference := 2 * math.Pi * s.cfg.OrbitRadiusM
	frac := math.Mod(s.cfg.CruiseSpeedMps*elapsed.Seconds(), circumference) / circumference
	angle := frac * 2 * math.Pi
	lat, lon := offset(s.cfg.OrbitCenterLat, s.cfg.OrbitCenterLon, angle*180/math.Pi, s.cfg.OrbitRadiusM)
	// Heading is tangent to the orbit (angle + 90°).
	heading := math.Mod(angle*180/math.Pi+90, 360)

	battery := s.cfg.StartBatteryPct - s.cfg.DrainPctPerMin*elapsed.Minutes()
	if battery < 0 {
		battery = 0
	}
	mode := "AUTO"
	if battery < 25 {
		mode = "RTL"
	}

	return track.Telemetry{
		UnitID: s.cfg.UnitID, Variant: s.cfg.Variant,
		Lat: lat, Lon: lon, AltitudeM: s.cfg.CruiseAltM,
		HeadingDeg: heading, SpeedMps: s.cfg.CruiseSpeedMps,
		BatteryPct: battery, MissionMode: mode, VideoURL: s.cfg.VideoURL,
		ObservedAt: time.Now().UTC(),
	}
}

// offset: flat-earth bearing+distance offset. Sufficient for the few-km orbit
// radii Class I Mini UAS fly at.
func offset(lat, lon, bearingDeg, distanceM float64) (float64, float64) {
	const earthR = 6_371_000.0
	br := bearingDeg * math.Pi / 180
	dLat := (distanceM * math.Cos(br)) / earthR * 180 / math.Pi
	dLon := (distanceM * math.Sin(br)) / (earthR * math.Cos(lat*math.Pi/180)) * 180 / math.Pi
	return lat + dLat, lon + dLon
}
