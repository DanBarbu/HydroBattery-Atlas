package store

import (
	"testing"

	"github.com/will-platform/trainer/internal/scoring"
)

func TestRunLifecycle(t *testing.T) {
	s := New()
	r := s.Create("t1", "first-light", "op-1")
	if r.Status != "PLANNED" || r.ExerciseID == "" {
		t.Fatalf("new run must be PLANNED with an exercise id, got %+v", r)
	}
	if _, err := s.Transition("t1", r.ID, "start"); err != nil {
		t.Fatalf("start: %v", err)
	}
	if _, err := s.Transition("t1", r.ID, "pause"); err != nil {
		t.Fatalf("pause: %v", err)
	}
	if _, err := s.Transition("t1", r.ID, "resume"); err != nil {
		t.Fatalf("resume: %v", err)
	}
	done, err := s.Complete("t1", r.ID, scoring.Result{Score: 82, Grade: "MERIT", BadgeAwarded: "WILL Operator Basic"})
	if err != nil {
		t.Fatalf("complete: %v", err)
	}
	if done.Status != "COMPLETE" || done.Grade != "MERIT" || done.EndedAt == nil {
		t.Fatalf("unexpected completed run: %+v", done)
	}
}

func TestInvalidTransitionRejected(t *testing.T) {
	s := New()
	r := s.Create("t1", "x", "op")
	if _, err := s.Transition("t1", r.ID, "pause"); err == nil {
		t.Fatal("pause from PLANNED must fail")
	}
	if _, err := s.Complete("t1", r.ID, scoring.Result{}); err == nil {
		t.Fatal("complete from PLANNED must fail")
	}
}

func TestCompletedSlugsOnlyCountsPasses(t *testing.T) {
	s := New()
	pass := s.Create("t1", "first-light", "op")
	_, _ = s.Transition("t1", pass.ID, "start")
	_, _ = s.Complete("t1", pass.ID, scoring.Result{Score: 80, Grade: "MERIT"})

	fail := s.Create("t1", "cincu-gmti-drill", "op")
	_, _ = s.Transition("t1", fail.ID, "start")
	_, _ = s.Complete("t1", fail.ID, scoring.Result{Score: 20, Grade: "FAIL"})

	got := s.CompletedSlugs("t1", "op")
	if len(got) != 1 || got[0] != "first-light" {
		t.Fatalf("only the passed scenario should count, got %v", got)
	}
}

func TestLeaderboardKeepsBestPerTraineeScenario(t *testing.T) {
	s := New()
	for _, sc := range []float64{55, 88, 72} {
		r := s.Create("t1", "first-light", "op")
		_, _ = s.Transition("t1", r.ID, "start")
		_, _ = s.Complete("t1", r.ID, scoring.Result{Score: sc, Grade: "PASS"})
	}
	lb := s.Leaderboard("t1")
	if len(lb) != 1 || lb[0].Score != 88 {
		t.Fatalf("leaderboard should keep best (88), got %+v", lb)
	}
}

func TestTenantIsolation(t *testing.T) {
	s := New()
	a := s.Create("t1", "x", "op")
	s.Create("t2", "y", "op")
	if _, ok := s.Get("t2", a.ID); ok {
		t.Fatal("cross-tenant Get must fail")
	}
}
