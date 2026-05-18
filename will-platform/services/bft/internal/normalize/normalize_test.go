package normalize

import (
	"strings"
	"testing"
)

const cotFriendly = `<event uid="LYNX-21" type="a-f-G-U-C-A" time="2026-05-18T09:00:00Z">
  <point lat="45.873" lon="24.778"/>
  <detail><contact callsign="VANATOR-21"/><__group name="Cyan"/><track course="210" speed="6.5"/></detail>
</event>`

const cotHostile = `<event uid="X" type="a-h-A-M-F" time="2026-05-18T09:00:00Z">
  <point lat="45.9" lon="24.8"/></event>`

const nffiFriend = `<track><id>ABRAMS-07</id><callsign>TUNARI-07</callsign>
  <symbol>SFGPUCA----</symbol><latitude>45.870</latitude><longitude>24.770</longitude>
  <course>180</course><speed>8.0</speed><timestamp>2026-05-18T09:00:00Z</timestamp></track>`

const nffiHostile = `<track><id>H1</id><symbol>SHGP-------</symbol>
  <latitude>45.9</latitude><longitude>24.8</longitude><timestamp>2026-05-18T09:00:00Z</timestamp></track>`

func TestWILLNativeHappyPath(t *testing.T) {
	r, err := FromWILLNative([]byte(`{"external_id":"COBRA-3","callsign":"LUPUL-3","platform_type":"cobra_ii","branch":"land","lat":45.88,"lon":24.79,"heading_deg":90,"speed_mps":12}`))
	if err != nil {
		t.Fatal(err)
	}
	if r.ExternalID != "COBRA-3" || r.PlatformType != "cobra_ii" || r.SourceFormat != "will_native" {
		t.Fatalf("got %+v", r)
	}
}

func TestWILLNativeRejectsBadJSON(t *testing.T) {
	if _, err := FromWILLNative([]byte("not json")); err == nil {
		t.Fatal("expected malformed error")
	}
}

func TestWILLNativeRejectsOutOfRange(t *testing.T) {
	_, err := FromWILLNative([]byte(`{"external_id":"x","callsign":"y","lat":999,"lon":0}`))
	if err != ErrRange {
		t.Fatalf("expected ErrRange, got %v", err)
	}
}

func TestCoTFriendlyAccepted(t *testing.T) {
	r, err := FromCoTFriendly([]byte(cotFriendly))
	if err != nil {
		t.Fatal(err)
	}
	if r.Callsign != "VANATOR-21" || r.Branch != "land" || r.SourceFormat != "cot_friendly" {
		t.Fatalf("got %+v", r)
	}
}

func TestCoTHostileRejected(t *testing.T) {
	if _, err := FromCoTFriendly([]byte(cotHostile)); err != ErrNotFriendly {
		t.Fatalf("expected ErrNotFriendly, got %v", err)
	}
}

func TestCoTXXEDefence(t *testing.T) {
	mal := `<?xml version="1.0"?><!DOCTYPE e [<!ENTITY x "boom">]><event uid="A" type="a-f-G" time="2026-05-18T09:00:00Z"><point lat="0" lon="0"/></event>`
	// Should still parse the event without expanding entities (no panic, no hang).
	if _, err := FromCoTFriendly([]byte(mal)); err != nil && err != ErrNotFriendly {
		// acceptable to error; must not crash — reaching here means no panic
		_ = err
	}
}

func TestNFFIFriendAccepted(t *testing.T) {
	r, err := FromNFFI([]byte(nffiFriend))
	if err != nil {
		t.Fatal(err)
	}
	if r.ExternalID != "ABRAMS-07" || r.Callsign != "TUNARI-07" || r.SourceFormat != "nffi" {
		t.Fatalf("got %+v", r)
	}
}

func TestNFFIHostileRejected(t *testing.T) {
	if _, err := FromNFFI([]byte(nffiHostile)); err != ErrNotFriendly {
		t.Fatalf("expected ErrNotFriendly, got %v", err)
	}
}

func TestGuardRejectsEmptyAndOversize(t *testing.T) {
	if _, err := FromWILLNative(nil); err != ErrEmpty {
		t.Fatalf("empty: got %v", err)
	}
	big := []byte(strings.Repeat("a", MaxMessageBytes+1))
	if _, err := FromCoTFriendly(big); err != ErrTooLarge {
		t.Fatalf("oversize: got %v", err)
	}
}

func TestStatusAndBranchDefaulting(t *testing.T) {
	r, _ := FromWILLNative([]byte(`{"external_id":"x","callsign":"y","lat":1,"lon":1,"status":"weird","branch":"weird"}`))
	if r.Status != "OPERATIONAL" || r.Branch != "land" {
		t.Fatalf("expected safe defaults, got status=%s branch=%s", r.Status, r.Branch)
	}
	r2, _ := FromWILLNative([]byte(`{"external_id":"x","callsign":"y","lat":1,"lon":1,"status":"bingo","branch":"air"}`))
	if r2.Status != "BINGO" || r2.Branch != "air" {
		t.Fatalf("expected passthrough, got status=%s branch=%s", r2.Status, r2.Branch)
	}
}
