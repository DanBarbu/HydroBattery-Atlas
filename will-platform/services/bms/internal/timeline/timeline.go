// Package timeline records the F2T2EA kill-chain stamps and produces the
// After-Action Review (AAR) pack. WILL is a coordinator; the AAR pack is
// the auditor-facing evidence that records who approved what when, with
// the rationale used at the time.
//
// F2T2EA:
//   Find    — sensor first detects a candidate
//   Fix     — track is correlated and persistent
//   Track   — track is high-confidence; BMS scores it
//   Target  — BMS proposes an engagement (operator queued)
//   Engage  — operator approves; effector accepts
//   Assess  — effector reports completion (or operator aborts)
package timeline

import (
	"time"
)

type Stamps struct {
	Find   *time.Time `json:"find,omitempty"`
	Fix    *time.Time `json:"fix,omitempty"`
	Track  *time.Time `json:"track,omitempty"`
	Target *time.Time `json:"target,omitempty"`
	Engage *time.Time `json:"engage,omitempty"`
	Assess *time.Time `json:"assess,omitempty"`
}

// Set returns a copy of s with the named phase updated to t. Unknown phases
// are ignored; idempotent on already-stamped phases (does not overwrite).
func Set(s Stamps, phase string, t time.Time) Stamps {
	switch phase {
	case "find":
		if s.Find == nil {
			s.Find = &t
		}
	case "fix":
		if s.Fix == nil {
			s.Fix = &t
		}
	case "track":
		if s.Track == nil {
			s.Track = &t
		}
	case "target":
		if s.Target == nil {
			s.Target = &t
		}
	case "engage":
		if s.Engage == nil {
			s.Engage = &t
		}
	case "assess":
		if s.Assess == nil {
			s.Assess = &t
		}
	}
	return s
}

// Durations returns inter-phase durations for AAR plots.
type Durations struct {
	FindToFix    time.Duration `json:"find_to_fix_s"`
	FixToTrack   time.Duration `json:"fix_to_track_s"`
	TrackToTarget time.Duration `json:"track_to_target_s"`
	TargetToEngage time.Duration `json:"target_to_engage_s"`
	EngageToAssess time.Duration `json:"engage_to_assess_s"`
	FindToAssess time.Duration `json:"find_to_assess_s"`
}

func Compute(s Stamps) Durations {
	d := Durations{}
	if s.Find != nil && s.Fix != nil {
		d.FindToFix = s.Fix.Sub(*s.Find)
	}
	if s.Fix != nil && s.Track != nil {
		d.FixToTrack = s.Track.Sub(*s.Fix)
	}
	if s.Track != nil && s.Target != nil {
		d.TrackToTarget = s.Target.Sub(*s.Track)
	}
	if s.Target != nil && s.Engage != nil {
		d.TargetToEngage = s.Engage.Sub(*s.Target)
	}
	if s.Engage != nil && s.Assess != nil {
		d.EngageToAssess = s.Assess.Sub(*s.Engage)
	}
	if s.Find != nil && s.Assess != nil {
		d.FindToAssess = s.Assess.Sub(*s.Find)
	}
	return d
}

// AAR is the after-action review pack. Designed to be export-friendly:
// a single JSON document covers the full lifecycle of one engagement.
type AAR struct {
	EngagementID     string         `json:"engagement_id"`
	ThreatID         string         `json:"threat_id"`
	EffectorID       string         `json:"effector_id"`
	FinalStatus      string         `json:"final_status"`
	IsTST            bool           `json:"is_tst"`
	Timeline         Stamps         `json:"timeline"`
	Durations        Durations      `json:"durations"`
	ProbabilityOfKill float64       `json:"probability_of_kill"`
	TimeToInterceptS  float64       `json:"time_to_intercept_s"`
	Rationale        map[string]any `json:"score_rationale"`
	Notes            string         `json:"notes,omitempty"`
	GeneratedAt      time.Time      `json:"generated_at"`
}
