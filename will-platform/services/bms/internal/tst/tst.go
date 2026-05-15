// Package tst classifies threats for the Time-Sensitive Target fast lane.
//
// A threat is a TST when EITHER:
//   - priority_score >= ScoreThreshold (default 0.75), OR
//   - threat_class is in the fast-class set (ballistic, cruise, swarm) AND
//     the time-to-defended-asset is below TTAThreshold (default 30 s).
//
// The TST lane abbreviates the operator-approval path: a single click in the
// UI combines propose+approve. ADR-008's "operator approves" gate is still
// honoured — a human still acts; the gate is just faster.
package tst

import "math"

const (
	ScoreThreshold = 0.75
	TTAThreshold   = 30.0 // seconds
)

var fastClasses = map[string]bool{
	"ballistic": true,
	"cruise":    true,
	"swarm":     true,
}

// Input captures the minimum a classifier needs.
type Input struct {
	PriorityScore float64
	ThreatClass   string
	SpeedMps      float64
	DistanceToAssetM float64 // nearest defended asset
}

// IsTST returns true when the threat qualifies for the fast lane.
func IsTST(in Input) bool {
	if in.PriorityScore >= ScoreThreshold {
		return true
	}
	if fastClasses[in.ThreatClass] {
		tta := timeToAsset(in.SpeedMps, in.DistanceToAssetM)
		if tta > 0 && tta <= TTAThreshold {
			return true
		}
	}
	return false
}

func timeToAsset(speedMps, distanceM float64) float64 {
	if speedMps <= 0 || distanceM <= 0 {
		return math.Inf(1)
	}
	return distanceM / speedMps
}
