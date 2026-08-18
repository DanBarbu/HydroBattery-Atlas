// Package decision implements the install/first-run opt-out decision trigger
// for TAK integration (ADR-017).
//
// Rationale: connecting WILL to an external TAK federation is a deliberate,
// accountable act, not a default. When the WILL platform is installed and run,
// the gateway starts in StatePending and refuses to open any TAK socket. An
// operator must record an explicit decision — Enabled or OptedOut — before the
// bridge will run. The decision, who made it, and when, are persisted so the
// choice survives restarts and is auditable.
//
// "Optional opt-out": the operator may decline TAK integration outright
// (StateOptedOut), and that choice is sticky until deliberately changed.
package decision

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type State string

const (
	// StatePending is the fresh-install default: no decision recorded yet.
	// The gateway will not connect or egress while pending.
	StatePending State = "pending"
	// StateEnabled means an operator authorised TAK integration. The bridge
	// may run, subject to the separate ADR-017 co-sign acknowledgement.
	StateEnabled State = "enabled"
	// StateOptedOut means an operator declined TAK integration. Sticky.
	StateOptedOut State = "opted_out"
)

// Record is the persisted decision.
type Record struct {
	State     State     `json:"state"`
	Operator  string    `json:"operator,omitempty"`
	Reason    string    `json:"reason,omitempty"`
	DecidedAt time.Time `json:"decided_at,omitempty"`
}

// Load reads the decision from path. A missing file is the first-run case and
// yields StatePending without error.
func Load(path string) (Record, error) {
	b, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return Record{State: StatePending}, nil
	}
	if err != nil {
		return Record{}, err
	}
	var r Record
	if err := json.Unmarshal(b, &r); err != nil {
		return Record{}, fmt.Errorf("decision: parse %s: %w", path, err)
	}
	if !valid(r.State) {
		return Record{}, fmt.Errorf("decision: invalid state %q in %s", r.State, path)
	}
	return r, nil
}

// Save atomically persists the decision to path.
func Save(path string, r Record) error {
	if !valid(r.State) {
		return fmt.Errorf("decision: refusing to save invalid state %q", r.State)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		return err
	}
	b, err := json.MarshalIndent(r, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o640); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// Record records an operator decision and persists it.
func RecordDecision(path string, state State, operator, reason string) (Record, error) {
	state = State(strings.ToLower(strings.TrimSpace(string(state))))
	if state != StateEnabled && state != StateOptedOut {
		return Record{}, fmt.Errorf("decision: operator may only set %q or %q, got %q",
			StateEnabled, StateOptedOut, state)
	}
	r := Record{State: state, Operator: operator, Reason: reason, DecidedAt: time.Now().UTC()}
	if err := Save(path, r); err != nil {
		return Record{}, err
	}
	return r, nil
}

// Seed applies a non-interactive default (e.g. from an env var or unattended
// install) ONLY when no decision has been recorded yet. It never overrides an
// operator's existing choice.
func Seed(path string, state State, operator, reason string) (Record, error) {
	cur, err := Load(path)
	if err != nil {
		return Record{}, err
	}
	if cur.State != StatePending {
		return cur, nil
	}
	state = State(strings.ToLower(strings.TrimSpace(string(state))))
	if state != StateEnabled && state != StateOptedOut {
		return Record{}, fmt.Errorf("decision: invalid seed state %q", state)
	}
	r := Record{State: state, Operator: operator, Reason: reason, DecidedAt: time.Now().UTC()}
	if err := Save(path, r); err != nil {
		return Record{}, err
	}
	return r, nil
}

func valid(s State) bool {
	return s == StatePending || s == StateEnabled || s == StateOptedOut
}
