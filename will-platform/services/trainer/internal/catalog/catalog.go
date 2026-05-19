// Package catalog is the curated war-games scenario library and the
// prerequisite-gated curriculum. The progression model is borrowed from
// wargame-nexus (tiers + prerequisite gating + badges) and applied to
// WILL C2-operator training. Scenarios map onto the modules already built
// (BMS, BFT, naval/own-ship, fires, edge).
//
// Catalogue content is deliberately code (not DB-seeded) so it is
// reviewable and versioned; the API can still expose it per tenant.
package catalog

type Objective struct {
	ID     string  `json:"id"`
	Title  string  `json:"title"`
	Weight float64 `json:"weight"` // weights within a scenario sum to 100
	Kind   string  `json:"kind"`   // "graded" | "pass_fail"
	Target string  `json:"target"`
}

type Scenario struct {
	Slug          string      `json:"slug"`
	Title         string      `json:"title"`
	Description   string      `json:"description"`
	Difficulty    int         `json:"difficulty"` // 1..4 tier
	Domains       []string    `json:"domains"`
	Objectives    []Objective `json:"objectives"`
	Prerequisites []string    `json:"prerequisites"` // scenario slugs
	Badge         string      `json:"badge"`
	EstimatedMin  int         `json:"estimated_min"`
}

// Library — the curated progression. Tiers gate via prerequisites.
var Library = []Scenario{
	{
		Slug: "first-light", Title: "First Light — Operator Basics",
		Description: "Read the common operating picture at Cincu: CoT, MAVLink and GMTI tracks, the classification banner, layer toggles.",
		Difficulty: 1, Domains: []string{"cop"}, EstimatedMin: 15,
		Objectives: []Objective{
			{ID: "classify", Title: "Correctly classify 8 of 10 tracks by affiliation", Weight: 60, Kind: "graded", Target: ">=0.8 correct"},
			{ID: "layers", Title: "Use layer toggles to isolate the GMTI picture", Weight: 20, Kind: "pass_fail", Target: "demonstrated"},
			{ID: "banner", Title: "State the active classification correctly", Weight: 20, Kind: "pass_fail", Target: "correct"},
		},
		Badge: "WILL Operator Basic",
	},
	{
		Slug: "cincu-gmti-drill", Title: "Cincu GMTI Drill",
		Description: "Maintain a STANAG 4607 ground picture of a moving convoy through clutter.",
		Difficulty: 1, Domains: []string{"gmti"}, Prerequisites: []string{"first-light"}, EstimatedMin: 20,
		Objectives: []Objective{
			{ID: "track-hold", Title: "Hold continuous track on the convoy for 5 min", Weight: 70, Kind: "graded", Target: "track continuity"},
			{ID: "radial", Title: "Read radial velocity sign + magnitude", Weight: 30, Kind: "pass_fail", Target: "correct"},
		},
		Badge: "",
	},
	{
		Slug: "black-sea-swarm", Title: "Black Sea Swarm",
		Description: "A UAV swarm plus a cruise threat approach a defended asset; pair and approve engagements, avoid friendly fire, respect the active ACA.",
		Difficulty: 2, Domains: []string{"air-defence", "bft", "fires"},
		Prerequisites: []string{"cincu-gmti-drill"}, EstimatedMin: 30,
		Objectives: []Objective{
			{ID: "leakers", Title: "No more than 1 leaker reaches the defended asset", Weight: 40, Kind: "graded", Target: "<=1 leaker"},
			{ID: "friendly-fire", Title: "Zero friendly-fire incidents (BFT cross-check)", Weight: 30, Kind: "pass_fail", Target: "0 incidents"},
			{ID: "aca", Title: "Zero engagements violating the active ACA (fires deconfliction)", Weight: 30, Kind: "pass_fail", Target: "0 violations"},
		},
		Badge: "Air Defence Operator",
	},
	{
		Slug: "bmd-intercept", Title: "BMD Intercept",
		Description: "A ballistic threat tracks toward Cincu HQ; achieve a Patriot PAC-3 MSE pairing inside the engagement window.",
		Difficulty: 2, Domains: []string{"air-defence"},
		Prerequisites: []string{"cincu-gmti-drill"}, EstimatedMin: 20,
		Objectives: []Objective{
			{ID: "pairing", Title: "Patriot paired to the ballistic threat", Weight: 50, Kind: "pass_fail", Target: "correct effector"},
			{ID: "window", Title: "Approve within the engagement window", Weight: 50, Kind: "graded", Target: "time-to-approve"},
		},
		Badge: "",
	},
	{
		Slug: "emcon-silent", Title: "EMCON SILENT",
		Description: "The corvette loses SATCOM and goes EMCON SILENT; keep the picture coherent offline and resync cleanly on reconnection.",
		Difficulty: 3, Domains: []string{"maritime", "edge"},
		Prerequisites: []string{"black-sea-swarm"}, EstimatedMin: 25,
		Objectives: []Objective{
			{ID: "offline", Title: "Maintain own-ship + COP through the comms-out window", Weight: 50, Kind: "pass_fail", Target: "no loss of plot"},
			{ID: "resync", Title: "Edge outbox drains within SLA on reconnection", Weight: 50, Kind: "graded", Target: "drain time"},
		},
		Badge: "Maritime Operator",
	},
	{
		Slug: "tst-under-pressure", Title: "TST Lane Under Pressure",
		Description: "Multiple time-sensitive targets simultaneously; use the TST fast lane within SLA and produce a clean after-action review.",
		Difficulty: 3, Domains: []string{"air-defence", "fires"},
		Prerequisites: []string{"bmd-intercept", "black-sea-swarm"}, EstimatedMin: 30,
		Objectives: []Objective{
			{ID: "tst-sla", Title: "All TSTs approved within the fast-lane SLA", Weight: 60, Kind: "graded", Target: "median approve time"},
			{ID: "aar", Title: "AAR has no unexplained ABORT/REJECT", Weight: 40, Kind: "pass_fail", Target: "clean AAR"},
		},
		Badge: "",
	},
	{
		Slug: "excon-controller", Title: "EXCON Controller",
		Description: "Run a scenario for a trainee cohort as the white cell: start, inject, pause, debrief.",
		Difficulty: 4, Domains: []string{"excon"},
		Prerequisites: []string{"tst-under-pressure", "emcon-silent"}, EstimatedMin: 45,
		Objectives: []Objective{
			{ID: "control", Title: "Drive the scenario through all phases without desync", Weight: 60, Kind: "pass_fail", Target: "demonstrated"},
			{ID: "debrief", Title: "Deliver a structured debrief mapped to objectives", Weight: 40, Kind: "graded", Target: "rubric"},
		},
		Badge: "EXCON Controller",
	},
}

// BySlug returns a scenario and whether it exists.
func BySlug(slug string) (Scenario, bool) {
	for _, s := range Library {
		if s.Slug == slug {
			return s, true
		}
	}
	return Scenario{}, false
}

// Unlocked returns scenarios whose prerequisites are all satisfied by the
// trainee's completed-slug set. wargame-nexus-style gating: tier N opens
// only when its prerequisites are done.
func Unlocked(completed []string) []Scenario {
	done := map[string]bool{}
	for _, c := range completed {
		done[c] = true
	}
	var out []Scenario
	for _, s := range Library {
		ok := true
		for _, p := range s.Prerequisites {
			if !done[p] {
				ok = false
				break
			}
		}
		if ok {
			out = append(out, s)
		}
	}
	return out
}

// Locked is the complement of Unlocked — useful for the catalogue UI.
func Locked(completed []string) []Scenario {
	unlocked := map[string]bool{}
	for _, s := range Unlocked(completed) {
		unlocked[s.Slug] = true
	}
	var out []Scenario
	for _, s := range Library {
		if !unlocked[s.Slug] {
			out = append(out, s)
		}
	}
	return out
}
