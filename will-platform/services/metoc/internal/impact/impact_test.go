package impact

import "testing"

func TestClearWeatherIsGo(t *testing.T) {
	c := Conditions{CeilingM: 3000, VisibilityM: 10000, WindSpeedMps: 4, Precip: "none", SeaState: 1}
	for _, k := range AllAssetKinds {
		if r := Assess(c, k); r.Status != GO {
			t.Errorf("%s in clear weather should be GO, got %s (%v)", k, r.Status, r.Reasons)
		}
	}
}

func TestLowCeilingFogNoGoForAir(t *testing.T) {
	c := Conditions{CeilingM: 90, VisibilityM: 800, WindSpeedMps: 3}
	if r := Assess(c, "air_intercept"); r.Status != NOGO {
		t.Fatalf("air_intercept should be NO_GO in fog, got %s", r.Status)
	}
	// Patriot is all-weather: still GO in the same fog.
	if r := Assess(c, "sam_area"); r.Status != GO {
		t.Fatalf("sam_area should be GO in fog, got %s", r.Status)
	}
}

func TestHighWindGroundsUAV(t *testing.T) {
	c := Conditions{WindSpeedMps: 16, VisibilityM: 10000}
	if r := Assess(c, "uav"); r.Status != NOGO {
		t.Fatalf("uav should be NO_GO in 16 m/s wind, got %s", r.Status)
	}
}

func TestSeaStateGatesNaval(t *testing.T) {
	if r := Assess(Conditions{SeaState: 6}, "nsm_coastal"); r.Status != NOGO {
		t.Fatalf("nsm_coastal NO_GO at sea state 6, got %s", r.Status)
	}
	if r := Assess(Conditions{SeaState: 4}, "naval"); r.Status != CAUTION {
		t.Fatalf("naval CAUTION at sea state 4, got %s", r.Status)
	}
}

func TestIcingGroundsUAVButCautionsFighter(t *testing.T) {
	c := Conditions{TempC: 0, Precip: "moderate", VisibilityM: 10000, CeilingM: 1000}
	if r := Assess(c, "uav"); r.Status != NOGO {
		t.Fatalf("uav NO_GO with icing, got %s", r.Status)
	}
	if r := Assess(c, "air_intercept"); r.Status != CAUTION {
		t.Fatalf("air_intercept CAUTION with icing, got %s", r.Status)
	}
}

func TestLowVisDegradesEOIR(t *testing.T) {
	if r := Assess(Conditions{VisibilityM: 800}, "eo_ir"); r.Status != NOGO {
		t.Fatalf("eo_ir NO_GO at 800 m vis, got %s", r.Status)
	}
	if r := Assess(Conditions{VisibilityM: 800}, "gmti_radar"); r.Status != GO {
		t.Fatalf("gmti_radar largely unaffected by low vis, got %s", r.Status)
	}
}
