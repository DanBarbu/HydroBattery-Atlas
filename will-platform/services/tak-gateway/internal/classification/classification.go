// Package classification implements the STANAG-4774 marking comparison used to
// gate egress toward a TAK federation (ADR-005, ADR-017).
//
// The single guarantee this package exists to provide: a track may only leave
// WILL toward TAK if its marking is at or below the configured accreditation
// ceiling. Everything here is therefore fail-closed — an unrecognised,
// empty, or cross-scheme marking is NEVER considered "at or below" a ceiling.
// Markings are not downgraded; they are compared and the caller drops.
package classification

import "strings"

type scheme int

const (
	schemeUnknown scheme = iota
	schemeRO             // Romanian national, Law 182/2002 + HG 585/2002
	schemeNATO           // NATO AC/35
)

// roLevels and natoLevels are sensitivity ladders within a single scheme.
// We deliberately do NOT assert a cross-scheme equivalence table: mapping
// RO national markings onto NATO markings is a compliance decision, not an
// engineering one, and getting it wrong is a classification spill. Until that
// table is signed off (ADR-017 co-sign), comparison across schemes fails closed.
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

// Base strips any caveat portion ("NESECRET // OSINT" -> "NESECRET") and
// normalises whitespace/case so lookups are stable.
func Base(marking string) string {
	m := marking
	if i := strings.Index(m, "//"); i >= 0 {
		m = m[:i]
	}
	return strings.ToUpper(strings.TrimSpace(m))
}

// Caveats returns the upper-cased caveat tokens after "//", if any.
func Caveats(marking string) []string {
	i := strings.Index(marking, "//")
	if i < 0 {
		return nil
	}
	var out []string
	for _, c := range strings.Split(marking[i+2:], "/") {
		if c = strings.ToUpper(strings.TrimSpace(c)); c != "" {
			out = append(out, c)
		}
	}
	return out
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

// Valid reports whether marking's base label is a recognised STANAG-4774 /
// RO-national value.
func Valid(marking string) bool {
	_, _, ok := parse(marking)
	return ok
}

// AtOrBelowCeiling reports whether a track carrying `marking` may egress to a
// federation accredited to `ceiling`. It is fail-closed:
//   - either side unrecognised/empty -> false
//   - the two markings are in different schemes -> false (no cross-scheme
//     equivalence is assumed)
//   - otherwise true iff marking's level <= ceiling's level
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
