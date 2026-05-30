// Package track builds will.track.v0 payloads for the US MEROPS AI-powered
// counter-drone feed (ADR-018). MEROPS is a US-supplied asset (US
// Counter-UAS Marketplace), not a SAFE contract; Romania consumes its feed
// as ADVISORY OSINT per ADR-016.
//
// Conformance:
//   - Every emitted track has its classification forced to "<base> // OSINT"
//   - metadata.osint=true, metadata.confidence="low"
//   - Tracks are NEVER auto-fused with operational C-UAS picture
//   - Coordinator discipline: no Engage/Task/Command surface; engagement is
//     reported as advisory metadata only (informational), not actuated.
package track

import (
	"encoding/json"
	"strings"
	"time"
)

const Schema = "will.track.v0"

type Geometry struct {
	Type        string    `json:"type"`
	Coordinates []float64 `json:"coordinates"` // [lon, lat]
}

type Track struct {
	Schema         string         `json:"schema"`
	TrackID        string         `json:"track_id"`
	TenantID       string         `json:"tenant_id"`
	Source         string         `json:"source"`
	Geometry       Geometry       `json:"geometry"`
	AltitudeM      float64        `json:"altitude_m"`
	HeadingDeg     float64        `json:"heading_deg"`
	SpeedMps       float64        `json:"speed_mps"`
	Classification string         `json:"classification"`
	APP6DSIDC      string         `json:"app6d_sidc"`
	ObservedAt     string         `json:"observed_at"`
	Metadata       map[string]any `json:"metadata"`
}

// EngagementOutcome is a non-actuable advisory describing what MEROPS reports
// happened to a tracked threat. WILL records it on the picture; WILL does not
// task or actuate anything from it.
type EngagementOutcome string

const (
	OutcomeNone    EngagementOutcome = "NONE"
	OutcomeJamming EngagementOutcome = "JAMMING_APPLIED"
	OutcomeKinetic EngagementOutcome = "KINETIC_APPLIED"
	OutcomeNeutral EngagementOutcome = "TARGET_NEUTRALISED"
	OutcomeLost    EngagementOutcome = "TRACK_LOST"
)

// Detection is a MEROPS-reported hostile drone track + its AI-classifier
// label (e.g. "SHAHED", "DJI_MAVIC") and optional engagement outcome.
type Detection struct {
	ID            string
	Lat, Lon      float64
	AltitudeM     float64
	HeadingDeg    float64
	SpeedMps      float64
	AIClassifier  string // "SHAHED" | "DJI_MAVIC" | "FIXED_WING" | "UNKNOWN"
	AIConfidence  float64
	Outcome       EngagementOutcome
	OutcomeSensor string // "MEROPS-EW" | "MEROPS-KINETIC" | ""
	ObservedAt    time.Time
}

// Build renders a MEROPS detection as a hostile-UAS advisory track in the
// OSINT layer. classificationBase is the operational base marking (e.g.
// "NESECRET"); the OSINT caveat is forced regardless.
func Build(d Detection, tenantID, classificationBase, sourcePrefix string) Track {
	cls := forceOSINTCaveat(classificationBase)
	return Track{
		Schema:         Schema,
		TrackID:        d.ID,
		TenantID:       tenantID,
		Source:         sourcePrefix + "/" + d.ID,
		Geometry:       Geometry{Type: "Point", Coordinates: []float64{d.Lon, d.Lat}},
		AltitudeM:      d.AltitudeM,
		HeadingDeg:     d.HeadingDeg,
		SpeedMps:       d.SpeedMps,
		Classification: cls,
		APP6DSIDC:      hostileUASSIDC(d.AIClassifier),
		ObservedAt:     orNow(d.ObservedAt).UTC().Format(time.RFC3339Nano),
		Metadata: map[string]any{
			"plugin":                      "merops-osint",
			"version":                     "0.1.0",
			"direction":                   "ingress",
			"osint":                       true,
			"confidence":                  "low", // OSINT advisory; AI confidence is reported separately
			"layer":                       "merops",
			"threat":                      true,
			"cuas":                        true,
			"ai_classifier":               d.AIClassifier,
			"ai_confidence":               d.AIConfidence,
			"engagement_outcome":          string(d.Outcome),
			"engagement_sensor":           d.OutcomeSensor,
			"engagement_actuable_by_will": false, // WILL does not actuate MEROPS
		},
	}
}

func (t Track) JSON() ([]byte, error) { return json.Marshal(t) }

// hostileUASSIDC: hostile · air · present · unmanned, with the AI classifier
// folded into metadata. The APP-6D library will refine these codes.
func hostileUASSIDC(classifier string) string {
	switch classifier {
	case "SHAHED":
		return "SHAPMFL----------" // hostile · air · loitering munition (placeholder)
	case "FIXED_WING":
		return "SHAPMFQ----------"
	case "DJI_MAVIC", "QUADCOPTER":
		return "SHAPMFR----------" // hostile · air · rotary (placeholder)
	default:
		return "SHAP-------------"
	}
}

// forceOSINTCaveat: identical contract to mmpv90-naval. Appends OSINT to a
// base marking; idempotent on already-caveated markings.
func forceOSINTCaveat(base string) string {
	base = strings.TrimSpace(base)
	if base == "" {
		return "NESECRET // OSINT"
	}
	if strings.Contains(strings.ToUpper(base), "OSINT") {
		return base
	}
	if strings.Contains(base, "//") {
		return base + " / OSINT"
	}
	return base + " // OSINT"
}

func orNow(t time.Time) time.Time {
	if t.IsZero() {
		return time.Now()
	}
	return t
}
