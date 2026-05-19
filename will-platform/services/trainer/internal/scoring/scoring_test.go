package scoring

import (
	"testing"

	"github.com/will-platform/trainer/internal/catalog"
)

func scn() catalog.Scenario {
	return catalog.Scenario{
		Slug: "x", Title: "X", Badge: "Test Badge",
		Objectives: []catalog.Objective{
			{ID: "g1", Title: "graded", Weight: 60, Kind: "graded"},
			{ID: "pf1", Title: "pass/fail", Weight: 40, Kind: "pass_fail"},
		},
	}
}

func TestPerfectRunIsDistinction(t *testing.T) {
	r := Assess(scn(), []Outcome{
		{ObjectiveID: "g1", Achieved: 1.0},
		{ObjectiveID: "pf1", Passed: true},
	})
	if r.Score != 100 || r.Grade != "DISTINCTION" || r.BadgeAwarded != "Test Badge" {
		t.Fatalf("got %+v", r)
	}
}

func TestPassFailGateBlocksGradeEvenWithHighScore(t *testing.T) {
	// 60/60 graded but the mandatory pass_fail failed -> FAIL, no badge,
	// despite a 60 numeric score.
	r := Assess(scn(), []Outcome{
		{ObjectiveID: "g1", Achieved: 1.0},
		{ObjectiveID: "pf1", Passed: false},
	})
	if r.Grade != "FAIL" || r.BadgeAwarded != "" {
		t.Fatalf("pass_fail gate must block grade/badge, got %+v", r)
	}
}

func TestGradedClampedAndWeighted(t *testing.T) {
	r := Assess(scn(), []Outcome{
		{ObjectiveID: "g1", Achieved: 1.5}, // clamps to 1.0 -> 60
		{ObjectiveID: "pf1", Passed: true}, // 40
	})
	if r.Score != 100 {
		t.Fatalf("expected clamp to 100, got %.1f", r.Score)
	}
}

func TestPassBand(t *testing.T) {
	r := Assess(scn(), []Outcome{
		{ObjectiveID: "g1", Achieved: 0.5}, // 30
		{ObjectiveID: "pf1", Passed: true}, // 40 -> total 70, all pf passed
	})
	if r.Grade != "PASS" {
		t.Fatalf("70 with pf passed should be PASS, got %s (%.1f)", r.Grade, r.Score)
	}
}

func TestMissingOutcomeCountsAsZero(t *testing.T) {
	r := Assess(scn(), []Outcome{{ObjectiveID: "g1", Achieved: 1.0}}) // pf1 not reported
	if r.Grade != "FAIL" {
		t.Fatalf("unreported pass_fail must fail the gate, got %s", r.Grade)
	}
}
