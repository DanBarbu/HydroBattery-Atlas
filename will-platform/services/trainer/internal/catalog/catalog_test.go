package catalog

import "testing"

func TestLibraryWeightsSumTo100(t *testing.T) {
	for _, s := range Library {
		sum := 0.0
		for _, o := range s.Objectives {
			sum += o.Weight
		}
		if sum != 100 {
			t.Fatalf("scenario %q objective weights sum to %.0f, want 100", s.Slug, sum)
		}
	}
}

func TestPrerequisitesReferenceRealScenarios(t *testing.T) {
	for _, s := range Library {
		for _, p := range s.Prerequisites {
			if _, ok := BySlug(p); !ok {
				t.Fatalf("scenario %q has unknown prerequisite %q", s.Slug, p)
			}
		}
	}
}

func TestUnlockedGating(t *testing.T) {
	// Nothing completed: only tier-1 entry (no prerequisites) is unlocked.
	u := Unlocked(nil)
	for _, s := range u {
		if len(s.Prerequisites) != 0 {
			t.Fatalf("with nothing completed, %q should be locked", s.Slug)
		}
	}
	if len(u) == 0 {
		t.Fatal("expected at least one prerequisite-free scenario")
	}
}

func TestUnlockOpensNextTier(t *testing.T) {
	u := Unlocked([]string{"first-light"})
	found := false
	for _, s := range u {
		if s.Slug == "cincu-gmti-drill" {
			found = true
		}
	}
	if !found {
		t.Fatal("completing first-light should unlock cincu-gmti-drill")
	}
}

func TestLockedIsComplementOfUnlocked(t *testing.T) {
	completed := []string{"first-light"}
	u := map[string]bool{}
	for _, s := range Unlocked(completed) {
		u[s.Slug] = true
	}
	for _, s := range Locked(completed) {
		if u[s.Slug] {
			t.Fatalf("%q appears in both locked and unlocked", s.Slug)
		}
	}
	if len(Unlocked(completed))+len(Locked(completed)) != len(Library) {
		t.Fatal("locked + unlocked must partition the library")
	}
}

func TestExconRequiresDeepProgression(t *testing.T) {
	if scs := Unlocked([]string{"first-light"}); contains(scs, "excon-controller") {
		t.Fatal("EXCON must not unlock from first-light alone")
	}
	full := []string{"first-light", "cincu-gmti-drill", "black-sea-swarm", "bmd-intercept", "emcon-silent", "tst-under-pressure"}
	if scs := Unlocked(full); !contains(scs, "excon-controller") {
		t.Fatal("EXCON should unlock once its prerequisites are complete")
	}
}

func contains(scs []Scenario, slug string) bool {
	for _, s := range scs {
		if s.Slug == slug {
			return true
		}
	}
	return false
}
