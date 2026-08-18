package cot

import (
	"strings"
	"testing"
)

const friendlyMsg = `<?xml version="1.0" encoding="UTF-8"?>
<event uid="ANDROID-tablet-7" type="a-f-G-U-C-I"
       time="2026-05-04T12:00:00Z" start="2026-05-04T12:00:00Z" stale="2026-05-04T12:05:00Z">
  <point lat="45.8696" lon="24.7753" hae="500.0" ce="9999999" le="9999999"/>
  <detail>
    <contact callsign="ALPHA-1"/>
    <__group name="Cyan"/>
    <track course="180.0" speed="3.5"/>
  </detail>
</event>`

const hostileAirMsg = `<event uid="hostile-1" type="a-h-A-M-F" time="2026-05-04T12:00:00Z">
  <point lat="46.0" lon="25.0" hae="3000" ce="100" le="100"/>
</event>`

func TestDecodeFriendly(t *testing.T) {
	e, err := Decode([]byte(friendlyMsg))
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	if e.UID != "ANDROID-tablet-7" {
		t.Errorf("uid=%s", e.UID)
	}
	if e.Affiliation() != "f" {
		t.Errorf("affiliation=%s", e.Affiliation())
	}
	if e.Callsign != "ALPHA-1" {
		t.Errorf("callsign=%s", e.Callsign)
	}
	sidc := e.SIDC()
	if sidc[1] != 'F' || sidc[2] != 'G' {
		t.Errorf("sidc=%s; want SF G prefix", sidc)
	}
}

func TestDecodeHostileAir(t *testing.T) {
	e, err := Decode([]byte(hostileAirMsg))
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	if e.Affiliation() != "h" {
		t.Errorf("affiliation=%s", e.Affiliation())
	}
	if e.SIDC()[1] != 'H' {
		t.Errorf("sidc=%s; want hostile", e.SIDC())
	}
}

func TestRejectsEmpty(t *testing.T) {
	if _, err := Decode(nil); err == nil {
		t.Fatal("expected error on empty input")
	}
}

func TestRejectsOversized(t *testing.T) {
	huge := []byte(strings.Repeat("a", MaxMessageBytes+1))
	if _, err := Decode(huge); err == nil {
		t.Fatal("expected error on oversized input")
	}
}

func TestRejectsBadXML(t *testing.T) {
	if _, err := Decode([]byte("<event broken")); err == nil {
		t.Fatal("expected error on malformed xml")
	}
}

func TestRejectsMissingAttributes(t *testing.T) {
	bad := `<event time="2026-05-04T12:00:00Z"><point lat="0" lon="0"/></event>`
	if _, err := Decode([]byte(bad)); err == nil {
		t.Fatal("expected error on missing uid/type")
	}
}

func TestRejectsLatOutOfRange(t *testing.T) {
	bad := `<event uid="x" type="a-f-G" time="2026-05-04T12:00:00Z">
		<point lat="999" lon="0"/></event>`
	if _, err := Decode([]byte(bad)); err == nil {
		t.Fatal("expected error on out-of-range lat")
	}
}

func TestRejectsLonOutOfRange(t *testing.T) {
	bad := `<event uid="x" type="a-f-G" time="2026-05-04T12:00:00Z">
		<point lat="0" lon="999"/></event>`
	if _, err := Decode([]byte(bad)); err == nil {
		t.Fatal("expected error on out-of-range lon")
	}
}

// Fuzz: hostile inputs must not crash.
func FuzzDecode(f *testing.F) {
	f.Add([]byte(friendlyMsg))
	f.Add([]byte("<event"))
	f.Add([]byte(""))
	f.Fuzz(func(_ *testing.T, data []byte) {
		_, _ = Decode(data)
	})
}
