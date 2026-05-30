// Package sim drives a synthetic MEROPS feed: a Shahed-style one-way
// attack drone inbound, with engagement outcomes evolving over time
// (NONE → JAMMING_APPLIED → TARGET_NEUTRALISED). Intent is dev/HIL
// plausibility, not operational fidelity.
package sim

import (
	"context"
	"math"
	"time"

	"github.com/will-platform/plugins/merops-osint/internal/track"
)

type Config struct {
	SiteLat, SiteLon float64
	BearingDeg       float64 // direction the threat comes FROM
	StartRangeM      float64
	SpeedMps         float64
	AltitudeM        float64
	AIClassifier     string
	Period           time.Duration
	// JammingAfter and NeutralisedAfter are advisory engagement outcomes
	// reported by MEROPS over its feed; WILL records them, never actuates.
	JammingAfter     time.Duration
	NeutralisedAfter time.Duration
}

func Default() Config {
	return Config{
		SiteLat: 45.870, SiteLon: 28.000, // Eastern Romania, near Black Sea
		BearingDeg:  45, // threat from NE
		StartRangeM: 12000, SpeedMps: 50, AltitudeM: 300,
		AIClassifier:     "SHAHED",
		Period:           2 * time.Second,
		JammingAfter:     20 * time.Second,
		NeutralisedAfter: 40 * time.Second,
	}
}

type Sim struct{ cfg Config }

func New(cfg Config) *Sim { return &Sim{cfg: cfg} }

func (s *Sim) Name() string { return "sim" }

func (s *Sim) Run(ctx context.Context, out chan<- track.Detection) error {
	t0 := time.Now()
	tick := time.NewTicker(s.cfg.Period)
	defer tick.Stop()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case now := <-tick.C:
			d := s.detectionAt(now.Sub(t0))
			select {
			case out <- d:
			case <-ctx.Done():
				return ctx.Err()
			}
		}
	}
}

// detectionAt returns the inbound threat's MEROPS detection at elapsed time,
// with engagement-outcome metadata progressing through the planned
// jamming → neutralised sequence.
func (s *Sim) detectionAt(elapsed time.Duration) track.Detection {
	// Start position: StartRangeM out on BearingDeg from the site.
	sLat, sLon := offset(s.cfg.SiteLat, s.cfg.SiteLon, s.cfg.BearingDeg, s.cfg.StartRangeM)
	// Travel back toward the site (reverse bearing).
	reverse := math.Mod(s.cfg.BearingDeg+180, 360)
	travelled := s.cfg.SpeedMps * elapsed.Seconds()
	if travelled > s.cfg.StartRangeM {
		travelled = s.cfg.StartRangeM
	}
	lat, lon := offset(sLat, sLon, reverse, travelled)

	outcome := track.OutcomeNone
	sensor := ""
	switch {
	case elapsed >= s.cfg.NeutralisedAfter:
		outcome, sensor = track.OutcomeNeutral, "MEROPS-KINETIC"
	case elapsed >= s.cfg.JammingAfter:
		outcome, sensor = track.OutcomeJamming, "MEROPS-EW"
	}

	return track.Detection{
		ID:  "merops-sim-01",
		Lat: lat, Lon: lon, AltitudeM: s.cfg.AltitudeM,
		HeadingDeg: reverse, SpeedMps: s.cfg.SpeedMps,
		AIClassifier: s.cfg.AIClassifier, AIConfidence: 0.93,
		Outcome: outcome, OutcomeSensor: sensor,
		ObservedAt: time.Now().UTC(),
	}
}

// offset: flat-earth bearing+distance offset; sufficient for ranges typical
// of one-way attack-drone interceptions.
func offset(lat, lon, bearingDeg, distanceM float64) (float64, float64) {
	const earthR = 6_371_000.0
	br := bearingDeg * math.Pi / 180
	dLat := (distanceM * math.Cos(br)) / earthR * 180 / math.Pi
	dLon := (distanceM * math.Sin(br)) / (earthR * math.Cos(lat*math.Pi/180)) * 180 / math.Pi
	return lat + dLat, lon + dLon
}
