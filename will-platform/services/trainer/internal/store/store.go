// Package store holds training runs in memory. No live-entity tables, by
// ADR-013 boundary. Every run carries an exercise_id.
package store

import (
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/will-platform/trainer/internal/scoring"
)

type Run struct {
	ID           string                    `json:"id"`
	TenantID     string                    `json:"tenant_id"`
	ScenarioSlug string                    `json:"scenario_slug"`
	Trainee      string                    `json:"trainee"`
	ExerciseID   string                    `json:"exercise_id"`
	Status       string                    `json:"status"` // PLANNED|RUNNING|PAUSED|COMPLETE|ABORTED
	Score        float64                   `json:"score"`
	Grade        string                    `json:"grade"`
	BadgeAwarded string                    `json:"badge_awarded"`
	Assessment   []scoring.ObjectiveResult `json:"assessment"`
	StartedAt    *time.Time                `json:"started_at,omitempty"`
	EndedAt      *time.Time                `json:"ended_at,omitempty"`
	CreatedAt    time.Time                 `json:"created_at"`
}

type Store struct {
	mu   sync.Mutex
	runs map[string]map[string]*Run // tenant -> runID -> run
	seq  int
}

func New() *Store { return &Store{runs: map[string]map[string]*Run{}} }

func (s *Store) id(p string) string {
	s.seq++
	const d = "0123456789abcdefghijklmnopqrstuvwxyz"
	n, out := s.seq, ""
	for n > 0 {
		out = string(d[n%36]) + out
		n /= 36
	}
	return p + "-" + out
}

func (s *Store) Create(tenantID, slug, trainee string) Run {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.runs[tenantID] == nil {
		s.runs[tenantID] = map[string]*Run{}
	}
	r := &Run{
		ID:           s.id("run"),
		TenantID:     tenantID,
		ScenarioSlug: slug,
		Trainee:      trainee,
		ExerciseID:   s.id("EX"),
		Status:       "PLANNED",
		CreatedAt:    time.Now().UTC(),
	}
	s.runs[tenantID][r.ID] = r
	return *r
}

func (s *Store) Get(tenantID, id string) (Run, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	r, ok := s.runs[tenantID][id]
	if !ok {
		return Run{}, false
	}
	return *r, true
}

func (s *Store) List(tenantID string) []Run {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]Run, 0, len(s.runs[tenantID]))
	for _, r := range s.runs[tenantID] {
		out = append(out, *r)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out
}

var errBadTransition = fmt.Errorf("trainer: invalid run state transition")

// Transition handles EXCON lifecycle: start, pause, resume, abort.
func (s *Store) Transition(tenantID, id, action string) (Run, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	r, ok := s.runs[tenantID][id]
	if !ok {
		return Run{}, fmt.Errorf("trainer: run not found")
	}
	now := time.Now().UTC()
	switch action {
	case "start":
		if r.Status != "PLANNED" {
			return Run{}, errBadTransition
		}
		r.Status = "RUNNING"
		r.StartedAt = &now
	case "pause":
		if r.Status != "RUNNING" {
			return Run{}, errBadTransition
		}
		r.Status = "PAUSED"
	case "resume":
		if r.Status != "PAUSED" {
			return Run{}, errBadTransition
		}
		r.Status = "RUNNING"
	case "abort":
		if r.Status == "COMPLETE" || r.Status == "ABORTED" {
			return Run{}, errBadTransition
		}
		r.Status = "ABORTED"
		r.EndedAt = &now
	default:
		return Run{}, errBadTransition
	}
	return *r, nil
}

// Complete records the assessment and finalises the run. Only RUNNING or
// PAUSED runs can be completed.
func (s *Store) Complete(tenantID, id string, res scoring.Result) (Run, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	r, ok := s.runs[tenantID][id]
	if !ok {
		return Run{}, fmt.Errorf("trainer: run not found")
	}
	if r.Status != "RUNNING" && r.Status != "PAUSED" {
		return Run{}, errBadTransition
	}
	now := time.Now().UTC()
	r.Status = "COMPLETE"
	r.Score = res.Score
	r.Grade = res.Grade
	r.BadgeAwarded = res.BadgeAwarded
	r.Assessment = res.Breakdown
	r.EndedAt = &now
	return *r, nil
}

// CompletedSlugs returns the scenario slugs a trainee has passed (grade !=
// FAIL) — drives prerequisite gating in the catalogue.
func (s *Store) CompletedSlugs(tenantID, trainee string) []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	seen := map[string]bool{}
	var out []string
	for _, r := range s.runs[tenantID] {
		if r.Trainee == trainee && r.Status == "COMPLETE" && r.Grade != "FAIL" && !seen[r.ScenarioSlug] {
			seen[r.ScenarioSlug] = true
			out = append(out, r.ScenarioSlug)
		}
	}
	sort.Strings(out)
	return out
}

// Leaderboard: best completed score per (trainee, scenario), highest first.
type LeaderRow struct {
	Trainee      string  `json:"trainee"`
	ScenarioSlug string  `json:"scenario_slug"`
	Score        float64 `json:"score"`
	Grade        string  `json:"grade"`
	Badge        string  `json:"badge_awarded"`
}

func (s *Store) Leaderboard(tenantID string) []LeaderRow {
	s.mu.Lock()
	defer s.mu.Unlock()
	best := map[string]LeaderRow{}
	for _, r := range s.runs[tenantID] {
		if r.Status != "COMPLETE" {
			continue
		}
		k := r.Trainee + "|" + r.ScenarioSlug
		if cur, ok := best[k]; !ok || r.Score > cur.Score {
			best[k] = LeaderRow{r.Trainee, r.ScenarioSlug, r.Score, r.Grade, r.BadgeAwarded}
		}
	}
	out := make([]LeaderRow, 0, len(best))
	for _, v := range best {
		out = append(out, v)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Score > out[j].Score })
	return out
}
