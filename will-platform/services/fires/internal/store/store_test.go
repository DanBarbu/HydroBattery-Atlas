package store

import (
	"testing"
	"time"
)

func TestIngestFSCMUpsertByExternalID(t *testing.T) {
	s := New()
	s.IngestFSCM("t1", FSCM{ExternalID: "nfa-1", MeasureType: "NFA", Name: "v1"})
	s.IngestFSCM("t1", FSCM{ExternalID: "nfa-1", MeasureType: "NFA", Name: "v2"})
	got := s.ListFSCM("t1")
	if len(got) != 1 || got[0].Name != "v2" {
		t.Fatalf("expected single upserted measure v2, got %+v", got)
	}
	if got[0].Source != "afatds" {
		t.Fatalf("source should default to afatds, got %q", got[0].Source)
	}
}

func TestActiveFSCMFiltersByWindow(t *testing.T) {
	s := New()
	past := time.Now().Add(-2 * time.Hour)
	ended := time.Now().Add(-time.Hour)
	from := time.Now().Add(-time.Minute)
	s.IngestFSCM("t1", FSCM{ExternalID: "old", MeasureType: "RFA", Name: "old", EffectiveFrom: &past, EffectiveTo: &ended})
	s.IngestFSCM("t1", FSCM{ExternalID: "now", MeasureType: "ACA", Name: "now", EffectiveFrom: &from})
	act := s.ActiveFSCM("t1", time.Now())
	if len(act) != 1 || act[0].ExternalID != "now" {
		t.Fatalf("expected only the active measure, got %+v", act)
	}
}

func TestIngestFireMissionStatus(t *testing.T) {
	s := New()
	s.IngestFireMissionStatus("t1", FireMissionStatus{ExternalID: "fm-1", Status: "PLANNED", FiringUnit: "HIMARS Bn"})
	s.IngestFireMissionStatus("t1", FireMissionStatus{ExternalID: "fm-1", Status: "SPLASH", FiringUnit: "HIMARS Bn"})
	got := s.ListFireMissions("t1")
	if len(got) != 1 || got[0].Status != "SPLASH" {
		t.Fatalf("expected single upserted status SPLASH, got %+v", got)
	}
}

func TestTenantIsolation(t *testing.T) {
	s := New()
	s.IngestFSCM("t1", FSCM{ExternalID: "a", MeasureType: "NFA", Name: "a"})
	s.IngestFSCM("t2", FSCM{ExternalID: "b", MeasureType: "NFA", Name: "b"})
	if len(s.ListFSCM("t1")) != 1 || len(s.ListFSCM("t2")) != 1 {
		t.Fatal("tenant isolation breached")
	}
}

func TestToDeconflictMeasuresOnlyActive(t *testing.T) {
	s := New()
	from := time.Now().Add(-time.Minute)
	s.IngestFSCM("t1", FSCM{ExternalID: "aca", MeasureType: "ACA", Name: "aca",
		Polygon: [][2]float64{{0, 0}, {1, 0}, {1, 1}, {0, 1}, {0, 0}}, EffectiveFrom: &from})
	dm := s.ToDeconflictMeasures("t1", time.Now())
	if len(dm) != 1 || dm[0].MeasureType != "ACA" {
		t.Fatalf("expected one ACA deconflict measure, got %+v", dm)
	}
}
