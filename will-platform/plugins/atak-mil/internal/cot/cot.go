// Package cot decodes Cursor on Target (CoT) XML messages.
//
// Reference: MITRE TR-04W0000345 (CoT 2.0 schema). We intentionally implement
// only the subset needed for ATAK-MIL track reports: <event> + <point> +
// <detail/contact|callsign|takv|track>. Hostile inputs must not crash the
// decoder; everything that can be malformed is bounded.
package cot

import (
	"encoding/xml"
	"errors"
	"fmt"
	"strings"
	"time"
)

// MaxMessageBytes guards against pathological inputs.
const MaxMessageBytes = 64 * 1024

// Event is the public, decoder-friendly view of a CoT message.
type Event struct {
	UID      string
	Type     string
	Time     time.Time
	Start    time.Time
	Stale    time.Time
	Lat      float64
	Lon      float64
	Hae      float64 // Height above ellipsoid, metres
	Ce       float64 // Circular error, metres
	Le       float64 // Linear error, metres
	Callsign string
	Group    string
	Course   float64
	Speed    float64
}

// Affiliation returns the second character of the CoT type (a-f-G-U-C-I etc.).
// 'f' is friendly, 'h' is hostile, 'n' is neutral, 'u' is unknown, 'p' is pending.
// Empty string if the type does not start with 'a-' (atom).
func (e Event) Affiliation() string {
	if !strings.HasPrefix(e.Type, "a-") || len(e.Type) < 3 {
		return ""
	}
	return string(e.Type[2])
}

// SIDC returns a best-effort APP-6D Symbol Identification Code derived from
// the CoT type. Sprint 1 mapping is intentionally narrow: friendly/hostile/
// neutral/unknown affiliation × ground/air dimension. The full mapping lands
// with the APP-6D library in Sprint 9.
func (e Event) SIDC() string {
	aff := e.Affiliation()
	dim := "G" // default ground
	if strings.HasPrefix(e.Type, "a-") && len(e.Type) >= 5 {
		switch e.Type[4] {
		case 'A':
			dim = "A"
		case 'S':
			dim = "S"
		case 'U':
			dim = "U"
		}
	}
	affMap := map[string]byte{"f": 'F', "h": 'H', "n": 'N', "u": 'U', "p": 'P'}
	a, ok := affMap[aff]
	if !ok {
		a = 'P'
	}
	return fmt.Sprintf("S%c%cP-----------", a, dim[0])
}

// Decode parses a single CoT XML message. It rejects oversize input, missing
// required attributes, and out-of-range coordinates.
func Decode(buf []byte) (Event, error) {
	if len(buf) == 0 {
		return Event{}, errors.New("cot: empty message")
	}
	if len(buf) > MaxMessageBytes {
		return Event{}, fmt.Errorf("cot: message %d bytes exceeds %d", len(buf), MaxMessageBytes)
	}

	var raw rawEvent
	dec := xml.NewDecoder(strings.NewReader(string(buf)))
	dec.Strict = true
	dec.Entity = nil // disable entity expansion (XXE defence)
	if err := dec.Decode(&raw); err != nil {
		return Event{}, fmt.Errorf("cot: decode: %w", err)
	}

	if raw.UID == "" || raw.Type == "" {
		return Event{}, errors.New("cot: missing required uid or type")
	}

	t, err := parseTime(raw.Time)
	if err != nil {
		return Event{}, fmt.Errorf("cot: time: %w", err)
	}
	start, _ := parseTimeOrZero(raw.Start)
	stale, _ := parseTimeOrZero(raw.Stale)

	if raw.Point.Lat < -90 || raw.Point.Lat > 90 {
		return Event{}, fmt.Errorf("cot: lat out of range: %f", raw.Point.Lat)
	}
	if raw.Point.Lon < -180 || raw.Point.Lon > 180 {
		return Event{}, fmt.Errorf("cot: lon out of range: %f", raw.Point.Lon)
	}

	return Event{
		UID:      raw.UID,
		Type:     raw.Type,
		Time:     t,
		Start:    start,
		Stale:    stale,
		Lat:      raw.Point.Lat,
		Lon:      raw.Point.Lon,
		Hae:      raw.Point.Hae,
		Ce:       raw.Point.Ce,
		Le:       raw.Point.Le,
		Callsign: raw.Detail.Contact.Callsign,
		Group:    raw.Detail.Group.Name,
		Course:   raw.Detail.Track.Course,
		Speed:    raw.Detail.Track.Speed,
	}, nil
}

func parseTime(s string) (time.Time, error) {
	if s == "" {
		return time.Time{}, errors.New("empty")
	}
	for _, layout := range []string{time.RFC3339Nano, time.RFC3339, "2006-01-02T15:04:05Z"} {
		if t, err := time.Parse(layout, s); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("unrecognised time %q", s)
}

func parseTimeOrZero(s string) (time.Time, error) {
	if s == "" {
		return time.Time{}, nil
	}
	return parseTime(s)
}

type rawEvent struct {
	XMLName xml.Name  `xml:"event"`
	UID     string    `xml:"uid,attr"`
	Type    string    `xml:"type,attr"`
	Time    string    `xml:"time,attr"`
	Start   string    `xml:"start,attr"`
	Stale   string    `xml:"stale,attr"`
	Point   rawPoint  `xml:"point"`
	Detail  rawDetail `xml:"detail"`
}

type rawPoint struct {
	Lat float64 `xml:"lat,attr"`
	Lon float64 `xml:"lon,attr"`
	Hae float64 `xml:"hae,attr"`
	Ce  float64 `xml:"ce,attr"`
	Le  float64 `xml:"le,attr"`
}

type rawDetail struct {
	Contact rawContact `xml:"contact"`
	Group   rawGroup   `xml:"__group"`
	Track   rawTrack   `xml:"track"`
}

type rawContact struct {
	Callsign string `xml:"callsign,attr"`
}

type rawGroup struct {
	Name string `xml:"name,attr"`
}

type rawTrack struct {
	Course float64 `xml:"course,attr"`
	Speed  float64 `xml:"speed,attr"`
}
