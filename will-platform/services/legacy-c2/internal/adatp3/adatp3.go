// Package adatp3 implements a WILL minimal profile of an AdatP-3 (Allied
// Data Publication 3) line-oriented track report: a message-identifier
// line plus slash-delimited sets. Parse and Render are round-trippable.
// Public standard; full message catalogue is a declared additive
// follow-up (ADR-014), mirroring the STANAG 4607 minimal-profile approach.
//
// WILL minimal track-report form (one message):
//   MSGID/TRACKREP/WILL//
//   TRACKNO/<id>//
//   AMPN/<callsign>//
//   POSIT/<lat>/<lon>/<altM>//
//   IDENT/<hostility>/<dimension>//
//   CLASS/<class>//
//   TIMEPOS/<RFC3339>//
package adatp3

import (
	"bufio"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
)

const MaxMessageBytes = 16 * 1024

var (
	ErrEmpty     = errors.New("adatp3: empty message")
	ErrTooLarge  = errors.New("adatp3: message exceeds max size")
	ErrMalformed = errors.New("adatp3: malformed message")
	ErrRange     = errors.New("adatp3: coordinate out of range")
)

type TrackReport struct {
	TrackNo        string
	Callsign       string
	Lat            float64
	Lon            float64
	AltitudeM      float64
	Hostility      string
	Dimension      string
	Classification string
	TimePos        time.Time
}

func Parse(buf []byte) (TrackReport, error) {
	if len(buf) == 0 {
		return TrackReport{}, ErrEmpty
	}
	if len(buf) > MaxMessageBytes {
		return TrackReport{}, ErrTooLarge
	}
	var tr TrackReport
	sc := bufio.NewScanner(strings.NewReader(string(buf)))
	sawMsgID := false
	for sc.Scan() {
		line := strings.TrimRight(strings.TrimSpace(sc.Text()), "/")
		if line == "" {
			continue
		}
		parts := strings.Split(line, "/")
		switch parts[0] {
		case "MSGID":
			if len(parts) < 2 || parts[1] != "TRACKREP" {
				return TrackReport{}, fmt.Errorf("%w: MSGID not TRACKREP", ErrMalformed)
			}
			sawMsgID = true
		case "TRACKNO":
			if len(parts) >= 2 {
				tr.TrackNo = parts[1]
			}
		case "AMPN":
			if len(parts) >= 2 {
				tr.Callsign = parts[1]
			}
		case "POSIT":
			if len(parts) < 4 {
				return TrackReport{}, fmt.Errorf("%w: POSIT needs lat/lon/alt", ErrMalformed)
			}
			lat, e1 := strconv.ParseFloat(parts[1], 64)
			lon, e2 := strconv.ParseFloat(parts[2], 64)
			alt, _ := strconv.ParseFloat(parts[3], 64)
			if e1 != nil || e2 != nil {
				return TrackReport{}, fmt.Errorf("%w: POSIT not numeric", ErrMalformed)
			}
			if lat < -90 || lat > 90 || lon < -180 || lon > 180 {
				return TrackReport{}, ErrRange
			}
			tr.Lat, tr.Lon, tr.AltitudeM = lat, lon, alt
		case "IDENT":
			if len(parts) >= 3 {
				tr.Hostility = strings.ToUpper(parts[1])
				tr.Dimension = strings.ToUpper(parts[2])
			}
		case "CLASS":
			if len(parts) >= 2 {
				tr.Classification = parts[1]
			}
		case "TIMEPOS":
			if len(parts) >= 2 {
				if t, err := time.Parse(time.RFC3339, parts[1]); err == nil {
					tr.TimePos = t.UTC()
				}
			}
		}
	}
	if !sawMsgID || tr.TrackNo == "" {
		return TrackReport{}, fmt.Errorf("%w: missing MSGID/TRACKREP or TRACKNO", ErrMalformed)
	}
	if tr.Hostility == "" {
		tr.Hostility = "UK"
	}
	if tr.Dimension == "" {
		tr.Dimension = "LAND"
	}
	if tr.TimePos.IsZero() {
		tr.TimePos = time.Now().UTC()
	}
	return tr, nil
}

// Render produces the WILL minimal AdatP-3 track-report text. Render∘Parse
// is the identity for the fields the profile covers (proved by the test).
func Render(tr TrackReport) string {
	cls := tr.Classification
	if cls == "" {
		cls = "NU"
	}
	host := tr.Hostility
	if host == "" {
		host = "UK"
	}
	dim := tr.Dimension
	if dim == "" {
		dim = "LAND"
	}
	tp := tr.TimePos
	if tp.IsZero() {
		tp = time.Now().UTC()
	}
	var b strings.Builder
	b.WriteString("MSGID/TRACKREP/WILL//\n")
	fmt.Fprintf(&b, "TRACKNO/%s//\n", tr.TrackNo)
	fmt.Fprintf(&b, "AMPN/%s//\n", tr.Callsign)
	fmt.Fprintf(&b, "POSIT/%.6f/%.6f/%.1f//\n", tr.Lat, tr.Lon, tr.AltitudeM)
	fmt.Fprintf(&b, "IDENT/%s/%s//\n", host, dim)
	fmt.Fprintf(&b, "CLASS/%s//\n", cls)
	fmt.Fprintf(&b, "TIMEPOS/%s//\n", tp.UTC().Format(time.RFC3339))
	return b.String()
}
