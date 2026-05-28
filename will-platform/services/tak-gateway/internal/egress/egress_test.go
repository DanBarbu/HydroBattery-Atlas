package egress

import (
	"testing"

	"github.com/will-platform/tak-gateway/internal/forward"
)

func trackWith(class string, md map[string]any) forward.Track {
	return forward.Track{
		Schema:         "will.track.v0",
		TrackID:        "t1",
		Geometry:       forward.Geometry{Type: "Point", Coordinates: []float64{24.7, 45.8}},
		Classification: class,
		Metadata:       md,
	}
}

// TestEgressNeverExceedsCeiling is the conformance test named in ADR-017: no
// track above the ceiling — and no unmarked/malformed track — is ever allowed.
func TestEgressNeverExceedsCeiling(t *testing.T) {
	p := Policy{Ceiling: "NESECRET", AllowOSINT: false}

	mustDrop := []forward.Track{
		trackWith("SECRET", nil),
		trackWith("STRICT_SECRET", nil),
		trackWith("STRICT_SECRET_DE_IMPORTANTA_DEOSEBITA", nil),
		trackWith("", nil),                  // unmarked
		trackWith("   ", nil),               // whitespace
		trackWith("MADE_UP_LABEL", nil),     // malformed
		trackWith("NATO_SECRET", nil),       // cross-scheme above
		trackWith("NATO_UNCLASSIFIED", nil), // cross-scheme, no equivalence assumed
		trackWith("NESECRET // OSINT", nil), // OSINT not enabled
	}
	for _, tr := range mustDrop {
		if d := p.Decide(tr); d.Allowed {
			t.Fatalf("track %q was allowed to egress but must be dropped (%s)", tr.Classification, d.Reason)
		}
	}

	mustAllow := []forward.Track{
		trackWith("NESECRET", nil),
	}
	for _, tr := range mustAllow {
		if d := p.Decide(tr); !d.Allowed {
			t.Fatalf("track %q should egress but was dropped: %s", tr.Classification, d.Reason)
		}
	}
}

func TestOSINTEgressGate(t *testing.T) {
	osintTrack := trackWith("NESECRET", map[string]any{"osint": true})

	closed := Policy{Ceiling: "NESECRET", AllowOSINT: false}
	if closed.Allows(osintTrack) {
		t.Fatal("OSINT track must be dropped when OSINT egress disabled")
	}
	open := Policy{Ceiling: "NESECRET", AllowOSINT: true}
	if !open.Allows(osintTrack) {
		t.Fatal("OSINT track at/below ceiling should egress when OSINT egress enabled")
	}
	// Even with OSINT enabled, an above-ceiling OSINT track is still dropped.
	if open.Allows(trackWith("SECRET // OSINT", map[string]any{"osint": true})) {
		t.Fatal("above-ceiling OSINT track must still be dropped")
	}
}
