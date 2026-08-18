// Package impact is the METOC operational-impact decision-support engine.
// Given conditions + an asset class it returns GO / CAUTION / NO_GO with
// explicit reasons. Advisory only (ADR-015) — it changes nothing; the
// operator decides. Thresholds are public-doctrine-style and illustrative;
// integrators tune per platform.
package impact

type Status string

const (
	GO      Status = "GO"
	CAUTION Status = "CAUTION"
	NOGO    Status = "NO_GO"
)

// rank lets us escalate (take the worst of several findings).
func rank(s Status) int {
	switch s {
	case NOGO:
		return 2
	case CAUTION:
		return 1
	default:
		return 0
	}
}

func worst(a, b Status) Status {
	if rank(b) > rank(a) {
		return b
	}
	return a
}

type Conditions struct {
	CeilingM     float64 // 0 = unlimited/none reported
	VisibilityM  float64 // 0 treated as unknown -> ignored
	WindSpeedMps float64
	GustMps      float64
	TempC        float64
	Precip       string // none|light|moderate|heavy
	SeaState     int     // Douglas 0..9
	WaveHeightM  float64
}

type Result struct {
	AssetKind string   `json:"asset_kind"`
	Status    Status   `json:"status"`
	Reasons   []string `json:"reasons"`
}

func icingRisk(c Conditions) bool {
	return c.TempC <= 2 && c.TempC >= -10 && (c.Precip == "moderate" || c.Precip == "heavy")
}

// Assess returns the advisory for a given asset kind.
func Assess(c Conditions, assetKind string) Result {
	st := GO
	var reasons []string
	add := func(s Status, why string) {
		st = worst(st, s)
		reasons = append(reasons, why)
	}
	vis := c.VisibilityM
	ceil := c.CeilingM

	switch assetKind {
	case "air_intercept": // CAP fighter
		if ceil > 0 && ceil < 150 {
			add(NOGO, "ceiling below recovery minima")
		} else if ceil > 0 && ceil < 450 {
			add(CAUTION, "low ceiling")
		}
		if vis > 0 && vis < 1600 {
			add(NOGO, "visibility below minima")
		} else if vis > 0 && vis < 5000 {
			add(CAUTION, "reduced visibility")
		}
		if c.GustMps >= 18 {
			add(CAUTION, "strong gusts (crosswind risk)")
		}
		if icingRisk(c) {
			add(CAUTION, "airframe icing risk")
		}
	case "uav": // MAVLink / Watchkeeper
		if c.WindSpeedMps >= 15 || c.GustMps >= 18 {
			add(NOGO, "wind/gust exceeds UAV launch-recovery limit")
		} else if c.WindSpeedMps >= 10 {
			add(CAUTION, "elevated wind")
		}
		if icingRisk(c) {
			add(NOGO, "icing — UAV not cleared")
		}
		if vis > 0 && vis < 800 {
			add(CAUTION, "low visibility for visual recovery")
		}
	case "eo_ir", "c_uas": // electro-optic dependent
		if vis > 0 && vis < 1000 {
			add(NOGO, "EO/IR ineffective in low visibility")
		} else if vis > 0 && vis < 4000 {
			add(CAUTION, "EO/IR degraded")
		}
		if ceil > 0 && ceil < 300 {
			add(CAUTION, "low cloud limits EO/IR slant range")
		}
		if c.Precip == "heavy" {
			add(CAUTION, "heavy precipitation attenuates EO/IR")
		}
	case "gmti_radar": // STANAG 4607 ground radar
		if c.Precip == "heavy" {
			add(CAUTION, "heavy precipitation attenuates radar")
		}
	case "gun_shorad": // Skynex / C-RAM gun, radar + EO mix
		if vis > 0 && vis < 1000 {
			add(CAUTION, "EO tracking degraded; radar mode advised")
		}
		if c.Precip == "heavy" {
			add(CAUTION, "heavy precipitation")
		}
	case "nsm_coastal", "naval":
		if c.SeaState >= 6 || c.WaveHeightM >= 4 {
			add(NOGO, "sea state exceeds safe operating limit")
		} else if c.SeaState >= 4 || c.WaveHeightM >= 2.5 {
			add(CAUTION, "elevated sea state")
		}
	case "sam_area": // Patriot — largely all-weather
		if c.Precip == "heavy" {
			add(CAUTION, "heavy precipitation (minor radar effect)")
		}
	default:
		// Unknown asset class — be conservative but non-blocking.
		if vis > 0 && vis < 1000 {
			add(CAUTION, "low visibility")
		}
	}

	if len(reasons) == 0 {
		reasons = []string{"within operating limits"}
	}
	return Result{AssetKind: assetKind, Status: st, Reasons: reasons}
}

// AllAssetKinds is the set the demo/impact-matrix iterates.
var AllAssetKinds = []string{
	"air_intercept", "uav", "eo_ir", "c_uas", "gmti_radar", "gun_shorad",
	"nsm_coastal", "naval", "sam_area",
}
