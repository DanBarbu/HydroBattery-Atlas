// Package classification implements STANAG-4774 marking comparison used to
// gate model reads against a caller's declared ceiling (ADR-005, ADR-020).
//
// Guarantee: a model artefact may only be served to a caller whose ceiling
// is at or above the model's classification, within the same scheme. Every
// comparison is fail-closed — an unrecognised, empty, or cross-scheme
// marking is NEVER considered "at or below" a ceiling. This is the same
// primitive as tak-gateway's egress gate (ADR-017), duplicated here rather
// than shared because Go's internal-package rule forbids cross-module
// imports.
package classification

import "strings"

type scheme int

const (
	schemeUnknown scheme = iota
	schemeRO
	schemeNATO
)

var roLevels = map[string]int{
	"NESECRET":                              0,
	"SECRET_DE_SERVICIU":                    1,
	"SECRET":                                2,
	"STRICT_SECRET":                         3,
	"STRICT_SECRET_DE_IMPORTANTA_DEOSEBITA": 4,
}

var natoLevels = map[string]int{
	"NATO_UNCLASSIFIED": 0,
	"NATO_RESTRICTED":   1,
	"NATO_CONFIDENTIAL": 2,
	"NATO_SECRET":       3,
}

// Base strips any caveat portion ("NESECRET // OSINT" -> "NESECRET").
func Base(marking string) string {
	m := marking
	if i := strings.Index(m, "//"); i >= 0 {
		m = m[:i]
	}
	return strings.ToUpper(strings.TrimSpace(m))
}

func parse(marking string) (scheme, int, bool) {
	b := Base(marking)
	if b == "" {
		return schemeUnknown, 0, false
	}
	if lvl, ok := roLevels[b]; ok {
		return schemeRO, lvl, true
	}
	if lvl, ok := natoLevels[b]; ok {
		return schemeNATO, lvl, true
	}
	return schemeUnknown, 0, false
}

// Valid reports whether marking's base label is a recognised value.
func Valid(marking string) bool {
	_, _, ok := parse(marking)
	return ok
}

// AtOrBelowCeiling reports whether a model marked `marking` may be served
// to a caller whose ceiling is `ceiling`. Fail-closed on unrecognised or
// cross-scheme comparisons.
func AtOrBelowCeiling(marking, ceiling string) bool {
	ms, ml, mok := parse(marking)
	cs, cl, cok := parse(ceiling)
	if !mok || !cok {
		return false
	}
	if ms != cs {
		return false
	}
	return ml <= cl
}
