// Package egress is the classification gate on the WILL -> TAK path (ADR-017).
//
// Every track considered for egress passes Policy.Decide. The gate is the
// reason TAK integration is an ADR: uncontrolled egress of marked data to a
// TAK federation is a classification spill. The gate is fail-closed — an
// unmarked, malformed, or above-ceiling track is dropped, never downgraded.
package egress

import (
	"strings"

	"github.com/will-platform/tak-gateway/internal/classification"
	"github.com/will-platform/tak-gateway/internal/forward"
)

// Policy is the per-connection egress configuration. Ceiling is the
// accreditation ceiling of the TAK federation this gateway connects to.
type Policy struct {
	Ceiling    string // e.g. "NESECRET"; the federation's accreditation ceiling
	AllowOSINT bool   // OSINT tracks egress only when the tenant opts in
}

// Decision is the outcome of evaluating one track against the policy.
type Decision struct {
	Allowed bool
	Reason  string
}

// Decide reports whether a track may leave WILL toward TAK.
func (p Policy) Decide(t forward.Track) Decision {
	if strings.TrimSpace(t.Classification) == "" {
		return Decision{false, "no classification marking (fail-closed)"}
	}
	if !classification.Valid(t.Classification) {
		return Decision{false, "unrecognised classification marking (fail-closed)"}
	}
	if isOSINT(t) && !p.AllowOSINT {
		return Decision{false, "OSINT track and OSINT egress not enabled for tenant"}
	}
	if !classification.AtOrBelowCeiling(t.Classification, p.Ceiling) {
		return Decision{false, "marking above federation accreditation ceiling"}
	}
	return Decision{true, "at or below ceiling"}
}

// Allows is the boolean convenience wrapper.
func (p Policy) Allows(t forward.Track) bool { return p.Decide(t).Allowed }

func isOSINT(t forward.Track) bool {
	if v, ok := t.Metadata["osint"].(bool); ok && v {
		return true
	}
	for _, c := range classification.Caveats(t.Classification) {
		if c == "OSINT" {
			return true
		}
	}
	return false
}
