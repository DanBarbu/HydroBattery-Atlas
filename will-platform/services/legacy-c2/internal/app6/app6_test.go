package app6

import "testing"

func TestSIDCMapping(t *testing.T) {
	cases := []struct {
		host, dim string
		want      string
	}{
		{HostFriend, DimLand, "SFGP-----------"},
		{HostHostile, DimAir, "SHAP-----------"},
		{HostNeutral, DimSeaSurface, "SNSP-----------"},
		{HostUnknown, DimSubsurface, "SUUP-----------"},
		{HostSuspect, DimSpace, "SSPP-----------"},
		{HostAssumedFriend, DimLand, "SAGP-----------"},
		{"???", "???", "SUGP-----------"}, // unrecognised -> unknown/ground
	}
	for _, c := range cases {
		if got := SIDC(c.host, c.dim); got != c.want {
			t.Errorf("SIDC(%q,%q)=%q want %q", c.host, c.dim, got, c.want)
		}
		if len(SIDC(c.host, c.dim)) != 15 {
			t.Errorf("SIDC must be 15 chars")
		}
	}
}

func TestAffiliationChar(t *testing.T) {
	if AffiliationChar(HostHostile) != "H" || AffiliationChar("nonsense") != "U" {
		t.Fatal("affiliation char mapping wrong")
	}
}
