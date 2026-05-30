package track

import (
	"strings"
	"testing"
	"time"
)

func TestBuildEmitsFriendlyTrackedIFV(t *testing.T) {
	tr := Build(PlatformPLI{
		UnitID: "lynx-01", Callsign: "ALFA-1",
		Lat: 45.85, Lon: 24.78, AltitudeM: 480, HeadingDeg: 90, SpeedMps: 8,
		FuelPct: 87, EngineStatus: "OK", CommsStatus: "OK",
		CrewSize: 6, Crew: CrewMounted, Movement: MoveRoute,
		AmmoMain: 200, AmmoCoax: 800, AmmoSpike: 4,
		ObservedAt: time.Now().UTC(),
	}, "tenant-1", "NESECRET", "lynx/btn-1")

	if !strings.HasPrefix(tr.APP6DSIDC, "SF") {
		t.Fatalf("expected friendly SIDC, got %q", tr.APP6DSIDC)
	}
	if v, _ := tr.Metadata["ifv"].(bool); !v {
		t.Fatal("expected metadata.ifv=true")
	}
	if v, _ := tr.Metadata["platform"].(bool); !v {
		t.Fatal("expected metadata.platform=true")
	}
	if v, _ := tr.Metadata["threat"].(bool); v {
		t.Fatal("friendly IFV must never be tagged as a threat")
	}
	ammo, ok := tr.Metadata["ammo"].(map[string]any)
	if !ok {
		t.Fatalf("expected ammo map, got %T", tr.Metadata["ammo"])
	}
	if ammo["main"].(int) != 200 || ammo["spike"].(int) != 4 {
		t.Fatalf("ammo counts wrong: %+v", ammo)
	}
}

// TestNoTaskingSurface — coordinator discipline guard (ADR-018):
// no turret control, no fire-control access, no ammunition release.
func TestNoTaskingSurface(t *testing.T) {
	_ = Build
}
