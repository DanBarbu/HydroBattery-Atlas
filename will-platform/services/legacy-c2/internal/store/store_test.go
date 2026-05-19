package store

import (
	"testing"
	"time"
)

func tk(tenant, ext string) Track {
	return Track{
		TenantID: tenant, ExternalID: ext, SourceFormat: "jc3iedm",
		Callsign: ext, Hostility: "FR", Dimension: "LAND",
		Lat: 45.87, Lon: 24.78, ObservedAt: time.Now().UTC(),
	}
}

func TestUpsertTrackIsIdempotent(t *testing.T) {
	s := New()
	s.UpsertTrack(tk("t1", "OI-1"))
	s.UpsertTrack(tk("t1", "OI-1"))
	if got := s.ListTracks("t1"); len(got) != 1 {
		t.Fatalf("expected 1 track after upsert, got %d", len(got))
	}
}

func TestTenantIsolation(t *testing.T) {
	s := New()
	s.UpsertTrack(tk("t1", "A"))
	s.UpsertTrack(tk("t2", "B"))
	if len(s.ListTracks("t1")) != 1 || len(s.ListTracks("t2")) != 1 {
		t.Fatal("tenant isolation breached")
	}
}

func TestSouthboundLogCaps(t *testing.T) {
	s := New()
	for i := 0; i < southCap+50; i++ {
		s.AppendSouthbound(Southbound{TenantID: "t1", TrackExternalID: "X", APP6SIDC: "SFGP-----------", AdatP3: "x"})
	}
	if got := len(s.ListSouthbound("t1")); got != southCap {
		t.Fatalf("southbound log should cap at %d, got %d", southCap, got)
	}
}
