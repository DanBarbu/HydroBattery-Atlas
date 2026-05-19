// Package scoring turns reported objective outcomes into a weighted score
// and a grade. Transparent and reproducible (same discipline as the BMS
// threat-scoring doc): an instructor can hand-verify any run score.
package scoring

import "github.com/will-platform/trainer/internal/catalog"

// Outcome is what the EXCON / assessment reports per objective. For
// "graded" objectives, Achieved is 0..1. For "pass_fail", Passed is used.
type Outcome struct {
	ObjectiveID string  `json:"objective_id"`
	Achieved    float64 `json:"achieved"` // graded only, 0..1
	Passed      bool    `json:"passed"`   // pass_fail only
	Notes       string  `json:"notes"`
}

type ObjectiveResult struct {
	ObjectiveID string  `json:"objective_id"`
	Title       string  `json:"title"`
	Weight      float64 `json:"weight"`
	Kind        string  `json:"kind"`
	Score       float64 `json:"score"` // contribution toward 100
	Passed      bool    `json:"passed"`
	Notes       string  `json:"notes"`
}

type Result struct {
	Score        float64           `json:"score"` // 0..100
	Grade        string            `json:"grade"` // FAIL|PASS|MERIT|DISTINCTION
	BadgeAwarded string            `json:"badge_awarded"`
	Breakdown    []ObjectiveResult `json:"breakdown"`
}

// Grade thresholds. PASS additionally requires every pass_fail objective
// to have passed (a hard gate, not just an average).
const (
	passMark        = 60.0
	meritMark       = 75.0
	distinctionMark = 90.0
)

func Assess(s catalog.Scenario, outcomes []Outcome) Result {
	byID := map[string]Outcome{}
	for _, o := range outcomes {
		byID[o.ObjectiveID] = o
	}

	total := 0.0
	allPassFailPassed := true
	breakdown := make([]ObjectiveResult, 0, len(s.Objectives))

	for _, obj := range s.Objectives {
		o, reported := byID[obj.ID]
		r := ObjectiveResult{
			ObjectiveID: obj.ID, Title: obj.Title, Weight: obj.Weight, Kind: obj.Kind,
			Notes: o.Notes,
		}
		switch obj.Kind {
		case "pass_fail":
			passed := reported && o.Passed
			r.Passed = passed
			if passed {
				r.Score = obj.Weight
			} else {
				allPassFailPassed = false
			}
		default: // graded
			a := clamp01(o.Achieved)
			r.Score = obj.Weight * a
			r.Passed = a > 0
		}
		total += r.Score
		breakdown = append(breakdown, r)
	}

	grade := "FAIL"
	switch {
	case total >= distinctionMark && allPassFailPassed:
		grade = "DISTINCTION"
	case total >= meritMark && allPassFailPassed:
		grade = "MERIT"
	case total >= passMark && allPassFailPassed:
		grade = "PASS"
	}

	badge := ""
	if grade != "FAIL" && s.Badge != "" {
		badge = s.Badge
	}

	return Result{Score: round1(total), Grade: grade, BadgeAwarded: badge, Breakdown: breakdown}
}

func clamp01(x float64) float64 {
	if x < 0 {
		return 0
	}
	if x > 1 {
		return 1
	}
	return x
}

func round1(x float64) float64 {
	return float64(int(x*10+0.5)) / 10
}
