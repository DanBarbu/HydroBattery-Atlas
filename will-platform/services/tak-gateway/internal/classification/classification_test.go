package classification

import "testing"

func TestAtOrBelowCeiling(t *testing.T) {
	cases := []struct {
		name    string
		marking string
		ceiling string
		want    bool
	}{
		{"equal at ceiling", "NESECRET", "NESECRET", true},
		{"below ceiling", "NESECRET", "SECRET", true},
		{"above ceiling dropped", "SECRET", "NESECRET", false},
		{"top secret above nesecret", "STRICT_SECRET_DE_IMPORTANTA_DEOSEBITA", "NESECRET", false},
		{"osint caveat ignored for level", "NESECRET // OSINT", "NESECRET", true},
		{"nato within scheme below", "NATO_UNCLASSIFIED", "NATO_SECRET", true},
		{"nato within scheme above dropped", "NATO_SECRET", "NATO_RESTRICTED", false},
		// fail-closed cases:
		{"empty marking", "", "NESECRET", false},
		{"empty ceiling", "NESECRET", "", false},
		{"garbage marking", "TOTALLY_MADE_UP", "NESECRET", false},
		{"garbage ceiling", "NESECRET", "TOTALLY_MADE_UP", false},
		{"cross scheme ro vs nato denied", "NATO_UNCLASSIFIED", "NESECRET", false},
		{"cross scheme nato vs ro denied", "NESECRET", "NATO_SECRET", false},
		{"whitespace only", "   ", "NESECRET", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := AtOrBelowCeiling(c.marking, c.ceiling); got != c.want {
				t.Fatalf("AtOrBelowCeiling(%q,%q)=%v want %v", c.marking, c.ceiling, got, c.want)
			}
		})
	}
}

func TestBaseAndCaveats(t *testing.T) {
	if got := Base("NESECRET // OSINT"); got != "NESECRET" {
		t.Fatalf("Base=%q", got)
	}
	cv := Caveats("NESECRET // OSINT / REL FVEY")
	if len(cv) != 2 || cv[0] != "OSINT" || cv[1] != "REL FVEY" {
		t.Fatalf("Caveats=%v", cv)
	}
	if Caveats("NESECRET") != nil {
		t.Fatalf("expected no caveats")
	}
}
