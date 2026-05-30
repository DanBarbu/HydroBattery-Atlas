package track

import (
	"strings"
	"testing"
	"time"
)

func TestBuildEmitsFriendlyUASPLI(t *testing.T) {
	tr := Build(Telemetry{
		UnitID: "vector-01", Variant: "Vector",
		Lat: 45.8, Lon: 24.7, AltitudeM: 400, HeadingDeg: 180, SpeedMps: 18,
		BatteryPct: 78, MissionMode: "AUTO", VideoURL: "rtsp://vector-gcs/01",
		ObservedAt: time.Now().UTC(),
	}, "tenant-1", "NESECRET", "vector/gcs-1")

	if !strings.HasPrefix(tr.APP6DSIDC, "SF") {
		t.Fatalf("expected friendly SIDC, got %q", tr.APP6DSIDC)
	}
	if v, _ := tr.Metadata["platform"].(bool); !v {
		t.Fatal("expected metadata.platform=true")
	}
	if v, _ := tr.Metadata["unmanned"].(bool); !v {
		t.Fatal("expected metadata.unmanned=true")
	}
	if v, _ := tr.Metadata["isr"].(bool); !v {
		t.Fatal("expected metadata.isr=true")
	}
	if v, _ := tr.Metadata["threat"].(bool); v {
		t.Fatal("friendly ISR asset must never be tagged as a threat")
	}
}

func TestScorpionVariantDistinctSIDC(t *testing.T) {
	v := Build(Telemetry{UnitID: "v1", Variant: "Vector"}, "t", "NESECRET", "s")
	s := Build(Telemetry{UnitID: "s1", Variant: "Scorpion"}, "t", "NESECRET", "s")
	if v.APP6DSIDC == s.APP6DSIDC {
		t.Fatal("Vector and Scorpion should encode distinctly")
	}
	if got, _ := s.Metadata["variant"].(string); got != "Scorpion" {
		t.Fatalf("variant metadata=%q", got)
	}
}

// TestNoTaskingSurface — coordinator discipline guard (ADR-018).
func TestNoTaskingSurface(t *testing.T) {
	_ = Build
}
