package sim

import (
	"math"
	"testing"
	"time"

	"github.com/will-platform/plugins/merops-osint/internal/track"
)

func dist(lat1, lon1, lat2, lon2 float64) float64 {
	const earthR = 6_371_000.0
	dLat := (lat2 - lat1) * math.Pi / 180
	dLon := (lon2 - lon1) * math.Pi / 180 * math.Cos(lat1*math.Pi/180)
	return math.Hypot(dLat, dLon) * earthR
}

func TestThreatClosesOnSite(t *testing.T) {
	cfg := Default()
	s := New(cfg)
	a := s.detectionAt(0)
	b := s.detectionAt(60 * time.Second)
	if dist(b.Lat, b.Lon, cfg.SiteLat, cfg.SiteLon) >= dist(a.Lat, a.Lon, cfg.SiteLat, cfg.SiteLon) {
		t.Fatal("threat did not close on site")
	}
}

func TestEngagementOutcomeSequence(t *testing.T) {
	cfg := Default()
	s := New(cfg)
	pre := s.detectionAt(5 * time.Second)
	if pre.Outcome != track.OutcomeNone {
		t.Fatalf("before jamming: outcome=%q want NONE", pre.Outcome)
	}
	mid := s.detectionAt(25 * time.Second)
	if mid.Outcome != track.OutcomeJamming {
		t.Fatalf("during jamming: outcome=%q want JAMMING_APPLIED", mid.Outcome)
	}
	if mid.OutcomeSensor != "MEROPS-EW" {
		t.Fatalf("jamming sensor=%q", mid.OutcomeSensor)
	}
	post := s.detectionAt(50 * time.Second)
	if post.Outcome != track.OutcomeNeutral {
		t.Fatalf("after neutralised: outcome=%q want TARGET_NEUTRALISED", post.Outcome)
	}
}

func TestAIClassifierPassedThrough(t *testing.T) {
	cfg := Default()
	cfg.AIClassifier = "FIXED_WING"
	s := New(cfg)
	d := s.detectionAt(10 * time.Second)
	if d.AIClassifier != "FIXED_WING" {
		t.Fatalf("AIClassifier=%q", d.AIClassifier)
	}
}
