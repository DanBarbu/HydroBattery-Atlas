// Package cot decodes and encodes Cursor on Target (CoT) 2.0 XML messages.
//
// Reference: MITRE TR-04W0000345. The tak-gateway speaks CoT XML over the
// TAK Server's TLS streaming port for both directions; TAK Protocol v1
// (length-prefixed protobuf) is a declared follow-up (ADR-017a) and is not
// implemented here. Decode is hostile-input-safe: oversize, malformed, and
// XXE inputs are rejected without panicking.
//
// This mirrors plugins/atak-mil/internal/cot — Go's internal-package rule
// forbids importing that package across module boundaries, so the defensive
// decoder is duplicated rather than shared.
package cot

import (
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"
)

// MaxMessageBytes guards against pathological inputs.
const MaxMessageBytes = 64 * 1024

// Event is the decoder-friendly view of a CoT message.
type Event struct {
	UID      string
	Type     string
	Time     time.Time
	Start    time.Time
	Stale    time.Time
	How      string
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

// Affiliation returns the affiliation character of the CoT type (a-f-... etc.).
func (e Event) Affiliation() string {
	if !strings.HasPrefix(e.Type, "a-") || len(e.Type) < 3 {
		return ""
	}
	return string(e.Type[2])
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
	return raw.toEvent()
}

func (raw rawEvent) toEvent() (Event, error) {
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
		How:      raw.How,
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

// Encode renders an Event as a CoT 2.0 XML document for egress to TAK.
func (e Event) Encode() ([]byte, error) {
	now := time.Now().UTC()
	evTime := e.Time
	if evTime.IsZero() {
		evTime = now
	}
	stale := e.Stale
	if stale.IsZero() {
		stale = evTime.Add(5 * time.Minute)
	}
	how := e.How
	if how == "" {
		how = "m-g" // machine-generated
	}
	raw := rawEvent{
		Version: "2.0",
		UID:     e.UID,
		Type:    e.Type,
		Time:    evTime.Format(time.RFC3339Nano),
		Start:   evTime.Format(time.RFC3339Nano),
		Stale:   stale.Format(time.RFC3339Nano),
		How:     how,
		Point:   rawPoint{Lat: e.Lat, Lon: e.Lon, Hae: e.Hae, Ce: e.Ce, Le: e.Le},
		Detail: rawDetail{
			Contact: rawContact{Callsign: e.Callsign},
			Group:   rawGroup{Name: e.Group},
			Track:   rawTrack{Course: e.Course, Speed: e.Speed},
		},
	}
	return xml.Marshal(raw)
}

// StreamDecoder reads successive CoT <event> documents from a TLS stream
// (the TAK Server's CoT-over-TLS port). Inputs come from a mutually
// authenticated peer; entity expansion is still disabled as defence in depth.
type StreamDecoder struct{ dec *xml.Decoder }

// NewStreamDecoder wraps r. The caller is responsible for bounding r's total
// throughput at the transport layer if a hostile peer is in scope.
func NewStreamDecoder(r io.Reader) *StreamDecoder {
	d := xml.NewDecoder(r)
	d.Strict = true
	d.Entity = nil
	return &StreamDecoder{dec: d}
}

// Next decodes the next CoT event. It returns io.EOF when the stream ends.
func (s *StreamDecoder) Next() (Event, error) {
	var raw rawEvent
	if err := s.dec.Decode(&raw); err != nil {
		return Event{}, err
	}
	return raw.toEvent()
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
	Version string    `xml:"version,attr,omitempty"`
	UID     string    `xml:"uid,attr"`
	Type    string    `xml:"type,attr"`
	Time    string    `xml:"time,attr"`
	Start   string    `xml:"start,attr"`
	Stale   string    `xml:"stale,attr"`
	How     string    `xml:"how,attr,omitempty"`
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
	Callsign string `xml:"callsign,attr,omitempty"`
}

type rawGroup struct {
	Name string `xml:"name,attr,omitempty"`
}

type rawTrack struct {
	Course float64 `xml:"course,attr"`
	Speed  float64 `xml:"speed,attr"`
}
