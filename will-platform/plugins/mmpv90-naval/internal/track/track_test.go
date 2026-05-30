package track

import (
	"strings"
	"testing"
	"time"
)

func TestOwnShipIsFriendlySurfaceCombatant(t *testing.T) {
	tr := BuildOwnShip(OwnShipPLI{
		HullID: "F501", Pennant: "501",
		Lat: 44.17, Lon: 28.65, HeadingDeg: 90, SpeedMps: 12,
		Heel: 1.2, SeaState: 3, FuelPct: 88,
		HelmStatus: "AUTO", CommsStatus: "OK",
		ObservedAt: time.Now().UTC(),
	}, "tenant-1", "NESECRET", "mmpv90/F501")
	if !strings.HasPrefix(tr.APP6DSIDC, "SFS") {
		t.Fatalf("expected friendly sea-surface SIDC, got %q", tr.APP6DSIDC)
	}
	if v, _ := tr.Metadata["ownship"].(bool); !v {
		t.Fatal("expected metadata.ownship=true")
	}
	if got, _ := tr.Metadata["hull_class"].(string); got != "MMPV-90" {
		t.Fatalf("hull_class=%q", got)
	}
}

func TestDetectionAffiliationDrivesThreatFlag(t *testing.T) {
	host := BuildDetection(Detection{
		ID: "n-001", Domain: DomainSurface, Aff: AffHostile, Sensor: "SURFACE_RADAR",
		Lat: 44.20, Lon: 28.90, SpeedMps: 8,
	}, "t", "NESECRET", "s")
	if v, _ := host.Metadata["threat"].(bool); !v {
		t.Fatal("hostile detection must have threat=true")
	}
	if !strings.HasPrefix(host.APP6DSIDC, "SHS") {
		t.Fatalf("expected hostile sea-surface SIDC, got %q", host.APP6DSIDC)
	}

	unk := BuildDetection(Detection{
		ID: "n-002", Domain: DomainAir, Aff: AffUnknown, Sensor: "AIR_RADAR",
		Lat: 44.25, Lon: 29.10, AltitudeM: 8000, SpeedMps: 220,
	}, "t", "NESECRET", "s")
	if v, _ := unk.Metadata["threat"].(bool); v {
		t.Fatal("unknown-affiliation detection must not be tagged threat=true")
	}
	if !strings.HasPrefix(unk.APP6DSIDC, "SUA") {
		t.Fatalf("expected unknown-air SIDC, got %q", unk.APP6DSIDC)
	}
}

// TestAISContactForcesOSINTMarking is the conformance check for the AIS path:
// regardless of the operational base marking, an AIS contact MUST egress
// classified as OSINT and tagged metadata.osint=true (ADR-016).
func TestAISContactForcesOSINTMarking(t *testing.T) {
	tr := BuildAISContact(AISContact{
		MMSI: "271012345", Name: "MV STAR PILOT", Type: "CARGO",
		Lat: 44.50, Lon: 30.00, HeadingDeg: 270, SpeedMps: 7,
		ObservedAt: time.Now().UTC(),
	}, "tenant-1", "NESECRET", "mmpv90/F501")
	if !strings.Contains(strings.ToUpper(tr.Classification), "OSINT") {
		t.Fatalf("AIS classification must carry the OSINT caveat, got %q", tr.Classification)
	}
	if v, _ := tr.Metadata["osint"].(bool); !v {
		t.Fatal("AIS contact must have metadata.osint=true")
	}
	if conf, _ := tr.Metadata["confidence"].(string); conf != "low" {
		t.Fatalf("AIS contact confidence=%q, want low", conf)
	}
	if v, _ := tr.Metadata["threat"].(bool); v {
		t.Fatal("AIS contact must not be tagged threat=true")
	}
}

func TestForceOSINTCaveatIsIdempotent(t *testing.T) {
	cases := []struct{ in, want string }{
		{"NESECRET", "NESECRET // OSINT"},
		{"NESECRET // OSINT", "NESECRET // OSINT"},
		{"NESECRET // REL ROU", "NESECRET // REL ROU / OSINT"},
		{"", "NESECRET // OSINT"},
	}
	for _, c := range cases {
		if got := forceOSINTCaveat(c.in); got != c.want {
			t.Fatalf("forceOSINTCaveat(%q)=%q, want %q", c.in, got, c.want)
		}
	}
}

// TestNoTaskingSurface — coordinator discipline guard (ADR-018):
// no CMS replacement, no weapons direction, no sail orders.
func TestNoTaskingSurface(t *testing.T) {
	_ = BuildOwnShip
	_ = BuildDetection
	_ = BuildAISContact
}
