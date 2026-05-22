package store

import (
	"testing"
	"time"
)

func TestIngestAndLatestObservation(t *testing.T) {
	s := New()
	tn := "t1"
	s.IngestObservation(tn, Observation{Station: "LRCV", ObservedAt: time.Now().Add(-time.Hour)})
	s.IngestObservation(tn, Observation{Station: "LRCV", ObservedAt: time.Now()})
	o, ok := s.LatestObservation(tn, "LRCV")
	if !ok {
		t.Fatal("expected an observation")
	}
	if got, _ := s.LatestObservation(tn, "LRCV"); got.ID != o.ID {
		t.Fatal("latest must be stable")
	}
	if _, ok := s.LatestObservation(tn, "ZZZZ"); ok {
		t.Fatal("unknown station should miss")
	}
}

func TestTenantIsolation(t *testing.T) {
	s := New()
	s.IngestObservation("a", Observation{Station: "LRCV"})
	if len(s.ListObservations("b")) != 0 {
		t.Fatal("tenant b must not see tenant a observations")
	}
}

func TestFieldFallsBackToBlackSea(t *testing.T) {
	s := New()
	f := s.Field("empty")
	if f.FallbackUEast == 0 && f.FallbackVNorth == 0 {
		t.Fatal("empty tenant should get analytic Black-Sea fallback")
	}
	s.IngestFlow("with", FlowSample{Lat: 44, Lon: 29, UEastMps: 1, VNorthMps: 1})
	if len(s.Field("with").Samples) != 1 {
		t.Fatal("ingested flow should appear as a field sample")
	}
}
