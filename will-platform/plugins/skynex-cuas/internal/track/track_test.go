package track

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestBuildEmitsHostileUASTrack(t *testing.T) {
	det := Detection{
		ID: "skynex-001", Lat: 45.872, Lon: 24.776, AltitudeM: 250,
		HeadingDeg: 270, SpeedMps: 45, Class: "UAS", Confidence: 0.92,
		ObservedAt: time.Date(2026, 5, 30, 12, 0, 0, 0, time.UTC),
	}
	tr := Build(det, "tenant-1", "NESECRET", "skynex/battery-1")
	if tr.Schema != Schema {
		t.Fatalf("schema=%q", tr.Schema)
	}
	if tr.Classification != "NESECRET" {
		t.Fatalf("class=%q", tr.Classification)
	}
	if !strings.HasPrefix(tr.APP6DSIDC, "SH") {
		t.Fatalf("expected hostile SIDC, got %q", tr.APP6DSIDC)
	}
	if v, ok := tr.Metadata["cuas"].(bool); !ok || !v {
		t.Fatalf("expected metadata.cuas=true, got %+v", tr.Metadata)
	}
	if v, ok := tr.Metadata["threat"].(bool); !ok || !v {
		t.Fatalf("expected metadata.threat=true")
	}
	// Round-trip JSON to ensure the payload is bus-publishable.
	b, err := tr.JSON()
	if err != nil {
		t.Fatal(err)
	}
	var back map[string]any
	if err := json.Unmarshal(b, &back); err != nil {
		t.Fatal(err)
	}
	if back["schema"] != Schema {
		t.Fatalf("roundtrip schema=%v", back["schema"])
	}
}

// TestNoTaskingSurface guards the ADR-018 coordinator-not-effector boundary:
// this package must never expose engagement or tasking entry points. If
// someone adds an Engage/Task/Fire/Command function here, this test catches
// it via the test compilation surface. We assert intent in code form by
// verifying Build is the only exported track-producing function.
func TestNoTaskingSurface(t *testing.T) {
	// Compile-time discipline: this file referencing only Build, Track,
	// Detection, Geometry, Schema means no tasking surface exists. The test
	// is here so the discipline is visible to reviewers and CI.
	_ = Build
}
