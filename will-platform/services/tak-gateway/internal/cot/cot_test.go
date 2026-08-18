package cot

import (
	"strings"
	"testing"
	"time"
)

const sample = `<event version="2.0" uid="ALFA-1" type="a-f-G-E-S" time="2026-05-28T10:00:00Z" start="2026-05-28T10:00:00Z" stale="2026-05-28T10:05:00Z" how="m-g"><point lat="45.8696" lon="24.7753" hae="1250.5" ce="50" le="10"/><detail><contact callsign="ALFA-1"/><__group name="Friendly Units"/><track course="135" speed="15.3"/></detail></event>`

func TestDecode(t *testing.T) {
	ev, err := Decode([]byte(sample))
	if err != nil {
		t.Fatal(err)
	}
	if ev.UID != "ALFA-1" || ev.Type != "a-f-G-E-S" {
		t.Fatalf("got %+v", ev)
	}
	if ev.Lat != 45.8696 || ev.Lon != 24.7753 {
		t.Fatalf("coords %v %v", ev.Lat, ev.Lon)
	}
	if ev.Callsign != "ALFA-1" || ev.Affiliation() != "f" {
		t.Fatalf("detail %+v", ev)
	}
}

func TestEncodeDecodeRoundTrip(t *testing.T) {
	in := Event{
		UID: "BRAVO-2", Type: "a-h-A", Time: time.Now().UTC().Truncate(time.Second),
		Lat: 44.5, Lon: 26.1, Hae: 300, Course: 90, Speed: 12, Callsign: "BRAVO-2",
	}
	doc, err := in.Encode()
	if err != nil {
		t.Fatal(err)
	}
	out, err := Decode(doc)
	if err != nil {
		t.Fatalf("re-decode failed: %v\n%s", err, doc)
	}
	if out.UID != in.UID || out.Type != in.Type || out.Lat != in.Lat || out.Lon != in.Lon {
		t.Fatalf("round trip mismatch: %+v vs %+v", out, in)
	}
}

func TestDecodeRejectsOversize(t *testing.T) {
	big := make([]byte, MaxMessageBytes+1)
	if _, err := Decode(big); err == nil {
		t.Fatal("expected oversize rejection")
	}
}

func TestStreamDecoder(t *testing.T) {
	stream := sample + sample
	d := NewStreamDecoder(strings.NewReader(stream))
	for i := 0; i < 2; i++ {
		if _, err := d.Next(); err != nil {
			t.Fatalf("event %d: %v", i, err)
		}
	}
}
