// Package metar parses a WILL-minimal profile of a METAR aviation weather
// observation (public WMO/ICAO format): station, time, wind, visibility,
// cloud/ceiling, temp/dew, QNH. Defensive — hostile input never panics;
// unparseable groups are skipped. Full TAF / remarks are additive
// follow-ups (same discipline as the other minimal-profile decoders).
package metar

import (
	"errors"
	"strconv"
	"strings"
	"time"
)

const MaxMessageBytes = 8 * 1024

var (
	ErrEmpty    = errors.New("metar: empty message")
	ErrTooLarge = errors.New("metar: message exceeds max size")
	ErrNoTokens = errors.New("metar: no usable tokens")
)

type Observation struct {
	Station      string
	ObservedAt   time.Time
	WindDirDeg   float64
	WindSpeedMps float64
	GustMps      float64
	VisibilityM  float64
	CeilingM     float64 // lowest BKN/OVC base; 0 = none reported
	TempC        float64
	DewC         float64
	QNHhPa       float64
	HasTemp      bool
}

func ktToMps(kt float64) float64 { return kt * 0.514444 }

// Parse decodes one METAR line. `now` anchors the ddhhmmZ day/time group.
func Parse(buf []byte, now time.Time) (Observation, error) {
	if len(buf) == 0 {
		return Observation{}, ErrEmpty
	}
	if len(buf) > MaxMessageBytes {
		return Observation{}, ErrTooLarge
	}
	toks := strings.Fields(strings.ToUpper(strings.TrimSpace(string(buf))))
	if len(toks) == 0 {
		return Observation{}, ErrNoTokens
	}
	o := Observation{ObservedAt: now.UTC()}
	i := 0
	// Optional "METAR"/"SPECI" prefix.
	if toks[0] == "METAR" || toks[0] == "SPECI" {
		i++
	}
	if i < len(toks) && isStation(toks[i]) {
		o.Station = toks[i]
		i++
	}
	for ; i < len(toks); i++ {
		t := toks[i]
		switch {
		case isDayTime(t):
			o.ObservedAt = parseDayTime(t, now)
		case isWind(t):
			parseWind(t, &o)
		case t == "CAVOK":
			o.VisibilityM = 10000
		case isVisibilityMeters(t):
			v, _ := strconv.Atoi(t)
			if v == 9999 {
				o.VisibilityM = 10000
			} else {
				o.VisibilityM = float64(v)
			}
		case isCloud(t):
			parseCloud(t, &o)
		case isTempDew(t):
			parseTempDew(t, &o)
		case len(t) == 5 && t[0] == 'Q':
			if q, err := strconv.Atoi(t[1:]); err == nil {
				o.QNHhPa = float64(q)
			}
		}
	}
	return o, nil
}

func isStation(t string) bool {
	if len(t) != 4 {
		return false
	}
	for _, c := range t {
		if c < 'A' || c > 'Z' {
			return false
		}
	}
	return true
}

func isDayTime(t string) bool {
	return len(t) == 7 && t[6] == 'Z' && allDigits(t[:6])
}

func parseDayTime(t string, now time.Time) time.Time {
	day, _ := strconv.Atoi(t[0:2])
	hh, _ := strconv.Atoi(t[2:4])
	mm, _ := strconv.Atoi(t[4:6])
	y, m := now.Year(), now.Month()
	if day < 1 || day > 31 {
		day = now.Day()
	}
	return time.Date(y, m, day, hh, mm, 0, 0, time.UTC)
}

func isWind(t string) bool {
	// dddffKT or dddffGggKT or VRBffKT; dir 3, speed 2+, optional Ggg, "KT"
	if !strings.HasSuffix(t, "KT") {
		return false
	}
	body := strings.TrimSuffix(t, "KT")
	return len(body) >= 5 && (allDigits(body[:3]) || strings.HasPrefix(body, "VRB"))
}

func parseWind(t string, o *Observation) {
	body := strings.TrimSuffix(t, "KT")
	if strings.HasPrefix(body, "VRB") {
		o.WindDirDeg = -1
		body = body[3:]
	} else {
		d, _ := strconv.Atoi(body[:3])
		o.WindDirDeg = float64(d)
		body = body[3:]
	}
	gust := ""
	if g := strings.IndexByte(body, 'G'); g >= 0 {
		gust = body[g+1:]
		body = body[:g]
	}
	if sp, err := strconv.Atoi(body); err == nil {
		o.WindSpeedMps = ktToMps(float64(sp))
	}
	if gust != "" {
		if gg, err := strconv.Atoi(gust); err == nil {
			o.GustMps = ktToMps(float64(gg))
		}
	}
}

func isVisibilityMeters(t string) bool { return len(t) == 4 && allDigits(t) }

func isCloud(t string) bool {
	for _, p := range []string{"FEW", "SCT", "BKN", "OVC"} {
		if strings.HasPrefix(t, p) && len(t) >= 6 && allDigits(t[3:6]) {
			return true
		}
	}
	return false
}

func parseCloud(t string, o *Observation) {
	base, _ := strconv.Atoi(t[3:6])
	baseM := float64(base) * 100 * 0.3048 // hundreds of feet -> metres
	if strings.HasPrefix(t, "BKN") || strings.HasPrefix(t, "OVC") {
		if o.CeilingM == 0 || baseM < o.CeilingM {
			o.CeilingM = baseM
		}
	}
}

func isTempDew(t string) bool {
	// TT/DD with optional M (minus). e.g. 18/12, M03/M05
	parts := strings.SplitN(t, "/", 2)
	return len(parts) == 2 && looksTemp(parts[0]) && looksTemp(parts[1])
}

func looksTemp(s string) bool {
	s = strings.TrimPrefix(s, "M")
	return len(s) >= 1 && len(s) <= 2 && allDigits(s)
}

func parseTempDew(t string, o *Observation) {
	parts := strings.SplitN(t, "/", 2)
	o.TempC = tempVal(parts[0])
	o.DewC = tempVal(parts[1])
	o.HasTemp = true
}

func tempVal(s string) float64 {
	neg := strings.HasPrefix(s, "M")
	s = strings.TrimPrefix(s, "M")
	v, _ := strconv.Atoi(s)
	if neg {
		return -float64(v)
	}
	return float64(v)
}

func allDigits(s string) bool {
	if s == "" {
		return false
	}
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}
