package timeline

import (
	"testing"
	"time"
)

func TestSetIsIdempotent(t *testing.T) {
	t0 := time.Unix(100, 0)
	t1 := time.Unix(200, 0)
	s := Set(Stamps{}, "find", t0)
	s = Set(s, "find", t1)
	if !s.Find.Equal(t0) {
		t.Fatalf("Set should be idempotent on existing phase, got %v", s.Find)
	}
}

func TestSetUnknownPhaseIgnored(t *testing.T) {
	s := Set(Stamps{}, "bogus", time.Unix(100, 0))
	if s.Find != nil || s.Engage != nil {
		t.Fatal("unknown phase must not mutate")
	}
}

func TestComputeProducesExpectedDurations(t *testing.T) {
	t0 := time.Unix(100, 0)
	stamps := Stamps{
		Find:   ptr(t0),
		Fix:    ptr(t0.Add(2 * time.Second)),
		Track:  ptr(t0.Add(3 * time.Second)),
		Target: ptr(t0.Add(10 * time.Second)),
		Engage: ptr(t0.Add(15 * time.Second)),
		Assess: ptr(t0.Add(45 * time.Second)),
	}
	d := Compute(stamps)
	if d.FindToFix != 2*time.Second {
		t.Errorf("FindToFix=%s", d.FindToFix)
	}
	if d.TargetToEngage != 5*time.Second {
		t.Errorf("TargetToEngage=%s", d.TargetToEngage)
	}
	if d.FindToAssess != 45*time.Second {
		t.Errorf("FindToAssess=%s", d.FindToAssess)
	}
}

func TestPartialStampsAreOK(t *testing.T) {
	d := Compute(Stamps{Find: ptr(time.Unix(100, 0))})
	if d.FindToFix != 0 || d.FindToAssess != 0 {
		t.Fatal("missing later stamps should produce zero durations")
	}
}

func ptr(t time.Time) *time.Time { return &t }
