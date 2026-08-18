// Package app6 maps NATO hostility + battle dimension to a MIL-STD-2525C /
// APP-6 15-character Symbol Identification Code (SIDC) — the form BC2A's
// symbology engine and WILL's existing symbology layer both consume.
// Public standard; no proprietary content.
//
// SIDC layout used (positions 1..15):
//   1  Coding scheme    : 'S' (warfighting)
//   2  Affiliation      : F H N U S A (friend/hostile/neutral/unknown/suspect/assumed-friend)
//   3  Battle dimension : G A S U P (ground/air/sea-surface/subsurface/space)
//   4  Status           : 'P' (present)
//   5..15 function id    : '-----------'
package app6

// Hostility codes as they appear in JC3IEDM / AdatP-3 (subset).
const (
	HostFriend        = "FR"
	HostHostile       = "HO"
	HostNeutral       = "NE"
	HostUnknown       = "UK"
	HostSuspect       = "SU"
	HostAssumedFriend = "AF"
)

// Dimension codes (JC3IEDM-ish).
const (
	DimLand       = "LAND"
	DimAir        = "AIR"
	DimSeaSurface = "SEA_SURFACE"
	DimSubsurface = "SUBSURFACE"
	DimSpace      = "SPACE"
)

func affiliationChar(host string) byte {
	switch host {
	case HostFriend:
		return 'F'
	case HostHostile:
		return 'H'
	case HostNeutral:
		return 'N'
	case HostSuspect:
		return 'S'
	case HostAssumedFriend:
		return 'A'
	default: // UK and anything unrecognised
		return 'U'
	}
}

func dimensionChar(dim string) byte {
	switch dim {
	case DimAir:
		return 'A'
	case DimSeaSurface:
		return 'S'
	case DimSubsurface:
		return 'U'
	case DimSpace:
		return 'P'
	default: // LAND and anything unrecognised
		return 'G'
	}
}

// SIDC returns the 15-char MIL-STD-2525C / APP-6 code.
func SIDC(hostility, dimension string) string {
	b := []byte("S--P-----------")
	b[1] = affiliationChar(hostility)
	b[2] = dimensionChar(dimension)
	return string(b)
}

// AffiliationChar exposes just the single affiliation character (used by
// the canonical-track app6d_sidc field and the demo colour mapping).
func AffiliationChar(hostility string) string {
	return string(affiliationChar(hostility))
}
