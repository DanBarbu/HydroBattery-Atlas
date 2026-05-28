package decision

import (
	"path/filepath"
	"testing"
)

func TestFreshInstallIsPending(t *testing.T) {
	path := filepath.Join(t.TempDir(), "decision.json")
	r, err := Load(path)
	if err != nil {
		t.Fatal(err)
	}
	if r.State != StatePending {
		t.Fatalf("fresh install state = %q, want pending", r.State)
	}
}

func TestRecordAndReload(t *testing.T) {
	path := filepath.Join(t.TempDir(), "decision.json")
	if _, err := RecordDecision(path, StateOptedOut, "lt.popescu", "no TAK federation in theatre"); err != nil {
		t.Fatal(err)
	}
	r, err := Load(path)
	if err != nil {
		t.Fatal(err)
	}
	if r.State != StateOptedOut || r.Operator != "lt.popescu" {
		t.Fatalf("reloaded = %+v", r)
	}
	if r.DecidedAt.IsZero() {
		t.Fatal("DecidedAt not set")
	}
}

func TestOperatorCannotSetPending(t *testing.T) {
	path := filepath.Join(t.TempDir(), "decision.json")
	if _, err := RecordDecision(path, StatePending, "x", "y"); err == nil {
		t.Fatal("expected error setting pending via RecordDecision")
	}
}

func TestSeedDoesNotOverrideOperator(t *testing.T) {
	path := filepath.Join(t.TempDir(), "decision.json")
	if _, err := RecordDecision(path, StateOptedOut, "op", "declined"); err != nil {
		t.Fatal(err)
	}
	// An unattended seed must NOT flip an operator's opt-out to enabled.
	r, err := Seed(path, StateEnabled, "installer", "default")
	if err != nil {
		t.Fatal(err)
	}
	if r.State != StateOptedOut {
		t.Fatalf("seed overrode operator decision: %q", r.State)
	}
}

func TestSeedAppliesOnFreshInstall(t *testing.T) {
	path := filepath.Join(t.TempDir(), "decision.json")
	r, err := Seed(path, StateOptedOut, "installer", "safe default")
	if err != nil {
		t.Fatal(err)
	}
	if r.State != StateOptedOut {
		t.Fatalf("seed not applied on fresh install: %q", r.State)
	}
}
