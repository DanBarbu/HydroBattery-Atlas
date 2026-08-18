package classification

import "testing"

func TestAtOrBelowCeiling(t *testing.T) {
	cases := []struct {
		name, marking, ceiling string
		want                   bool
	}{
		{"equal", "NESECRET", "NESECRET", true},
		{"below", "NESECRET", "SECRET", true},
		{"above dropped", "SECRET", "NESECRET", false},
		{"caveat ignored for level", "NESECRET // OSINT", "NESECRET", true},
		{"empty marking", "", "NESECRET", false},
		{"empty ceiling", "NESECRET", "", false},
		{"garbage marking", "MADE_UP", "NESECRET", false},
		{"garbage ceiling", "NESECRET", "MADE_UP", false},
		{"cross scheme ro vs nato denied", "NATO_UNCLASSIFIED", "NESECRET", false},
		{"cross scheme nato vs ro denied", "NESECRET", "NATO_SECRET", false},
		{"nato within scheme below", "NATO_UNCLASSIFIED", "NATO_SECRET", true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := AtOrBelowCeiling(c.marking, c.ceiling); got != c.want {
				t.Fatalf("AtOrBelowCeiling(%q,%q)=%v want %v", c.marking, c.ceiling, got, c.want)
			}
		})
	}
}
