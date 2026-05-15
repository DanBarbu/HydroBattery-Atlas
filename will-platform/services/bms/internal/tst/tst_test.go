package tst

import "testing"

func TestHighScoreAlwaysTST(t *testing.T) {
	if !IsTST(Input{PriorityScore: 0.9, ThreatClass: "aircraft"}) {
		t.Fatal("score >= 0.75 must be TST regardless of class")
	}
}

func TestLowScoreNotTST(t *testing.T) {
	if IsTST(Input{PriorityScore: 0.3, ThreatClass: "aircraft", SpeedMps: 250, DistanceToAssetM: 8000}) {
		t.Fatal("low-priority aircraft at 32s TTA should not be TST")
	}
}

func TestFastClassWithImminentTTAIsTST(t *testing.T) {
	// 250 m/s, 5 km away → 20s TTA.
	if !IsTST(Input{PriorityScore: 0.5, ThreatClass: "cruise", SpeedMps: 250, DistanceToAssetM: 5000}) {
		t.Fatal("cruise with 20s TTA must be TST")
	}
}

func TestFastClassWithFarTTAIsNotTST(t *testing.T) {
	if IsTST(Input{PriorityScore: 0.5, ThreatClass: "cruise", SpeedMps: 100, DistanceToAssetM: 30000}) {
		t.Fatal("cruise with 300s TTA should not be TST on its own")
	}
}

func TestSurfaceNeverFastClass(t *testing.T) {
	if IsTST(Input{PriorityScore: 0.5, ThreatClass: "surface", SpeedMps: 200, DistanceToAssetM: 100}) {
		t.Fatal("surface is not in the fast-class set")
	}
}

func TestZeroSpeedHandled(t *testing.T) {
	if IsTST(Input{PriorityScore: 0.4, ThreatClass: "cruise", SpeedMps: 0, DistanceToAssetM: 1000}) {
		t.Fatal("zero speed must not trigger TST")
	}
}
