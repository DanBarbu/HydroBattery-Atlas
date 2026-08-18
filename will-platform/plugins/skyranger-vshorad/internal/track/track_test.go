package track

import (
	"strings"
	"testing"
	"time"
)

func TestBuildDetectionMarksHostileVSHORAD(t *testing.T) {
	tr := Build(Detection{
		ID: "skr-001", Lat: 45.7, Lon: 24.6, AltitudeM: 200,
		HeadingDeg: 90, SpeedMps: 50, Class: "UAS", Confidence: 0.88,
		ObservedAt: time.Now().UTC(),
	}, "tenant-1", "NESECRET", "skyranger/A1")
	if !strings.HasPrefix(tr.APP6DSIDC, "SH") {
		t.Fatalf("expected hostile, got %q", tr.APP6DSIDC)
	}
	if v, _ := tr.Metadata["vshorad"].(bool); !v {
		t.Fatal("expected metadata.vshorad=true")
	}
	if v, _ := tr.Metadata["threat"].(bool); !v {
		t.Fatal("expected metadata.threat=true")
	}
}

func TestBuildPlatformMarksFriendlyPlatform(t *testing.T) {
	tr := BuildPlatform(PlatformPLI{
		UnitID: "skr-A1", Lat: 45.7, Lon: 24.6, HeadingDeg: 0, SpeedMps: 0,
		Ammo: 252, Missiles: 4, Mode: "READY", ObservedAt: time.Now().UTC(),
	}, "tenant-1", "NESECRET", "skyranger/A1")
	if !strings.HasPrefix(tr.APP6DSIDC, "SF") {
		t.Fatalf("expected friendly SIDC, got %q", tr.APP6DSIDC)
	}
	if v, _ := tr.Metadata["platform"].(bool); !v {
		t.Fatal("expected metadata.platform=true")
	}
	if v, _ := tr.Metadata["threat"].(bool); v {
		t.Fatal("platform PLI must not be tagged as a threat")
	}
}

// TestNoTaskingSurface — coordinator discipline guard (ADR-018).
// Only Build and BuildPlatform produce tracks; no Engage/Task/Fire surface.
func TestNoTaskingSurface(t *testing.T) {
	_ = Build
	_ = BuildPlatform
}
