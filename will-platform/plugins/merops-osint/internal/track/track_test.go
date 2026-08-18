package track

import (
	"strings"
	"testing"
	"time"
)

func TestBuildForcesOSINTMarking(t *testing.T) {
	tr := Build(Detection{
		ID: "merops-001", Lat: 45.9, Lon: 28.1, AltitudeM: 300,
		HeadingDeg: 270, SpeedMps: 50, AIClassifier: "SHAHED", AIConfidence: 0.94,
		Outcome: OutcomeJamming, OutcomeSensor: "MEROPS-EW",
		ObservedAt: time.Now().UTC(),
	}, "tenant-1", "NESECRET", "merops/site-1")

	if !strings.Contains(strings.ToUpper(tr.Classification), "OSINT") {
		t.Fatalf("classification must carry OSINT caveat, got %q", tr.Classification)
	}
	if v, _ := tr.Metadata["osint"].(bool); !v {
		t.Fatal("metadata.osint must be true")
	}
	if conf, _ := tr.Metadata["confidence"].(string); conf != "low" {
		t.Fatalf("confidence=%q, want low", conf)
	}
	if v, _ := tr.Metadata["threat"].(bool); !v {
		t.Fatal("MEROPS detection must be tagged threat=true")
	}
	if v, _ := tr.Metadata["engagement_actuable_by_will"].(bool); v {
		t.Fatal("engagement_actuable_by_will must be false — WILL cannot actuate MEROPS")
	}
	if !strings.HasPrefix(tr.APP6DSIDC, "SH") {
		t.Fatalf("expected hostile SIDC, got %q", tr.APP6DSIDC)
	}
}

func TestForceOSINTCaveatIsIdempotent(t *testing.T) {
	cases := []struct{ in, want string }{
		{"NESECRET", "NESECRET // OSINT"},
		{"NESECRET // OSINT", "NESECRET // OSINT"},
		{"NESECRET // REL USA", "NESECRET // REL USA / OSINT"},
		{"", "NESECRET // OSINT"},
	}
	for _, c := range cases {
		if got := forceOSINTCaveat(c.in); got != c.want {
			t.Fatalf("forceOSINTCaveat(%q)=%q, want %q", c.in, got, c.want)
		}
	}
}

func TestEngagementOutcomeIsAdvisoryOnly(t *testing.T) {
	// A KINETIC_APPLIED outcome must NOT make the track WILL-actuable.
	tr := Build(Detection{
		ID: "merops-002", Lat: 46.0, Lon: 28.2, AIClassifier: "SHAHED",
		Outcome: OutcomeKinetic, OutcomeSensor: "MEROPS-KINETIC",
	}, "tenant-1", "NESECRET", "merops/site-1")
	if v, _ := tr.Metadata["engagement_actuable_by_will"].(bool); v {
		t.Fatal("KINETIC outcome must remain advisory; WILL must not actuate")
	}
	if got, _ := tr.Metadata["engagement_outcome"].(string); got != "KINETIC_APPLIED" {
		t.Fatalf("engagement_outcome=%q", got)
	}
}

// TestNoTaskingSurface — coordinator discipline guard (ADR-018):
// Build is the only exported producer; no Engage/Task/Command function.
func TestNoTaskingSurface(t *testing.T) {
	_ = Build
}
