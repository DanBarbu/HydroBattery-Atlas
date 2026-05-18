package store

import (
	"testing"
	"time"
)

func st(ext string) StateReport {
	return StateReport{
		ExternalID: ext, Name: ext, HullClass: "mmpv_90_corvette",
		Lat: 44.10, Lon: 29.10, HeadingDeg: 90, SpeedMps: 8,
		Status: "UNDERWAY", EmconState: "FULL", ObservedAt: time.Now().UTC(),
	}
}

func TestUpsertStateIsIdempotentByExternalID(t *testing.T) {
	s := New()
	s.UpsertState("t1", st("CORVETTE-1"))
	s.UpsertState("t1", st("CORVETTE-1"))
	if got := s.List("t1"); len(got) != 1 {
		t.Fatalf("expected 1 platform after upsert, got %d", len(got))
	}
}

func TestDefaultingOfEnums(t *testing.T) {
	s := New()
	r := st("X")
	r.HullClass = "nonsense"
	r.Status = "nonsense"
	r.EmconState = "nonsense"
	p := s.UpsertState("t1", r)
	if p.HullClass != "other" || p.Status != "UNDERWAY" || p.EmconState != "FULL" {
		t.Fatalf("expected safe defaults, got %+v", p)
	}
}

func TestSetCommsAndDegradedDetection(t *testing.T) {
	s := New()
	p := s.UpsertState("t1", st("CORVETTE-1"))
	_, ok := s.SetComms("t1", p.ID, []CommsLink{
		{Channel: "voip", Status: "UP"},
		{Channel: "satcom", Status: "DOWN"},
	})
	if !ok {
		t.Fatal("SetComms should find the platform")
	}
	deg := s.CommsDegraded("t1")
	if len(deg) != 1 || deg[0].ExternalID != "CORVETTE-1" {
		t.Fatalf("expected corvette flagged comms-degraded, got %+v", deg)
	}
}

func TestSetPayloads(t *testing.T) {
	s := New()
	p := s.UpsertState("t1", st("CORVETTE-1"))
	_, ok := s.SetPayloads("t1", p.ID, []Payload{
		{Name: "3D radar", Kind: "sensor", PayloadType: "3d_radar", Status: "READY"},
		{Name: "NSM launcher", Kind: "effector", PayloadType: "nsm", Status: "READY"},
	})
	if !ok {
		t.Fatal("SetPayloads should find the platform")
	}
	got, _ := s.Get("t1", p.ID)
	if len(got.Payloads) != 2 {
		t.Fatalf("expected 2 payloads, got %d", len(got.Payloads))
	}
}

func TestTenantIsolation(t *testing.T) {
	s := New()
	s.UpsertState("t1", st("A"))
	s.UpsertState("t2", st("B"))
	if len(s.List("t1")) != 1 || len(s.List("t2")) != 1 {
		t.Fatal("tenant isolation breached")
	}
	if _, ok := s.Get("t1", s.List("t2")[0].ID); ok {
		t.Fatal("cross-tenant Get must fail")
	}
}
