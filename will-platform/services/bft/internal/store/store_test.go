package store

import (
	"testing"
	"time"

	"github.com/will-platform/bft/internal/normalize"
)

func rep(extID, branch string, when time.Time) normalize.Report {
	return normalize.Report{
		ExternalID: extID, Callsign: extID, PlatformType: "lynx_kf41",
		Branch: branch, Echelon: "company", Lat: 45.87, Lon: 24.78,
		Status: "OPERATIONAL", Classification: "NESECRET",
		SourceFormat: "will_native", ObservedAt: when, Metadata: map[string]any{},
	}
}

func TestIngestUpsertsByExternalID(t *testing.T) {
	s := New()
	now := time.Now().UTC()
	s.Ingest("t1", rep("LYNX-1", "land", now))
	s.Ingest("t1", rep("LYNX-1", "land", now.Add(time.Minute)))
	if got := s.List("t1"); len(got) != 1 {
		t.Fatalf("expected 1 asset after upsert, got %d", len(got))
	}
}

func TestListSortedByBranchThenCallsign(t *testing.T) {
	s := New()
	now := time.Now().UTC()
	s.Ingest("t1", rep("AIR-9", "air", now))
	s.Ingest("t1", rep("LAND-2", "land", now))
	s.Ingest("t1", rep("LAND-1", "land", now))
	got := s.List("t1")
	if got[0].Branch != "air" || got[1].Callsign != "LAND-1" {
		t.Fatalf("unexpected ordering: %+v", got)
	}
}

func TestStaleDetectsNoComms(t *testing.T) {
	s := New()
	now := time.Now().UTC()
	s.Ingest("t1", rep("FRESH", "land", now))
	s.Ingest("t1", rep("OLD", "land", now.Add(-10*time.Minute)))
	stale := s.Stale("t1", 5*time.Minute, now)
	if len(stale) != 1 || stale[0].ExternalID != "OLD" {
		t.Fatalf("expected only OLD stale, got %+v", stale)
	}
}

func TestTenantIsolation(t *testing.T) {
	s := New()
	now := time.Now().UTC()
	s.Ingest("t1", rep("A", "land", now))
	s.Ingest("t2", rep("B", "land", now))
	if len(s.List("t1")) != 1 || len(s.List("t2")) != 1 {
		t.Fatal("tenants must not see each other's assets")
	}
	if _, ok := s.Get("t1", s.List("t2")[0].ID); ok {
		t.Fatal("cross-tenant Get must fail")
	}
}
