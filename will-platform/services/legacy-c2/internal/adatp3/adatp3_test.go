package adatp3

import (
	"math"
	"strings"
	"testing"
	"time"
)

const msg = `MSGID/TRACKREP/WILL//
TRACKNO/TN-0421//
AMPN/ALFA-1//
POSIT/45.873000/24.778000/480.0//
IDENT/FR/LAND//
CLASS/RS//
TIMEPOS/2026-05-18T09:00:00Z//`

func TestParseHappyPath(t *testing.T) {
	tr, err := Parse([]byte(msg))
	if err != nil {
		t.Fatal(err)
	}
	if tr.TrackNo != "TN-0421" || tr.Callsign != "ALFA-1" || tr.Hostility != "FR" {
		t.Fatalf("got %+v", tr)
	}
	if math.Abs(tr.Lat-45.873) > 1e-6 || math.Abs(tr.Lon-24.778) > 1e-6 {
		t.Fatalf("posit wrong: %+v", tr)
	}
}

func TestRenderParseRoundTrip(t *testing.T) {
	in := TrackReport{
		TrackNo: "TN-1", Callsign: "BRAVO", Lat: 44.17, Lon: 28.64, AltitudeM: 12,
		Hostility: "HO", Dimension: "AIR", Classification: "CO",
		TimePos: time.Date(2026, 5, 18, 9, 0, 0, 0, time.UTC),
	}
	out, err := Parse([]byte(Render(in)))
	if err != nil {
		t.Fatalf("re-parse: %v", err)
	}
	if out.TrackNo != in.TrackNo || out.Hostility != in.Hostility || out.Dimension != in.Dimension ||
		math.Abs(out.Lat-in.Lat) > 1e-6 || !out.TimePos.Equal(in.TimePos) {
		t.Fatalf("round trip mismatch: in=%+v out=%+v", in, out)
	}
}

func TestRejectsEmptyOversizeMalformedRange(t *testing.T) {
	if _, err := Parse(nil); err != ErrEmpty {
		t.Fatalf("empty: %v", err)
	}
	if _, err := Parse([]byte(strings.Repeat("x", MaxMessageBytes+1))); err != ErrTooLarge {
		t.Fatalf("oversize: %v", err)
	}
	if _, err := Parse([]byte("HELLO/WORLD//")); err == nil {
		t.Fatal("missing MSGID/TRACKREP should error")
	}
	bad := "MSGID/TRACKREP/WILL//\nTRACKNO/T//\nPOSIT/999/0/0//"
	if _, err := Parse([]byte(bad)); err != ErrRange {
		t.Fatalf("range: %v", err)
	}
}

func TestDefaultsApplied(t *testing.T) {
	tr, err := Parse([]byte("MSGID/TRACKREP/WILL//\nTRACKNO/T//\nPOSIT/1/1/0//"))
	if err != nil {
		t.Fatal(err)
	}
	if tr.Hostility != "UK" || tr.Dimension != "LAND" || tr.TimePos.IsZero() {
		t.Fatalf("defaults not applied: %+v", tr)
	}
}
