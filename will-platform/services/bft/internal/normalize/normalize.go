// Package normalize converts friendly-force position reports from several
// formats into one canonical Report. WILL implements a defensive minimal
// profile of each format (same approach as the STANAG 4607 decoder): only
// the fields the BFT picture needs, hostile inputs never crash.
//
// Implemented: CoT (friendly affiliation), NFFI (NATO Friendly Force
// Information, SIP3 minimal), and the WILL-native JSON shape (used by the
// simulator and by simple integrators). VMF K05.1 and Link-16 PPLI are
// declared in the schema and documented as additive next profiles —
// kept out of code until a real feed is available, exactly as STANAG 4607
// HRR was deferred.
package normalize

import (
	"bytes"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"strings"
	"time"
)

const MaxMessageBytes = 64 * 1024

var (
	ErrEmpty      = errors.New("normalize: empty message")
	ErrTooLarge   = errors.New("normalize: message exceeds max size")
	ErrMalformed  = errors.New("normalize: malformed message")
	ErrNotFriendly = errors.New("normalize: report is not a friendly affiliation")
	ErrRange      = errors.New("normalize: coordinate out of range")
)

// Report is the canonical friendly-asset position report.
type Report struct {
	ExternalID     string
	Callsign       string
	PlatformType   string
	Branch         string
	Echelon        string
	Lat            float64
	Lon            float64
	HeadingDeg     float64
	SpeedMps       float64
	Status         string
	Classification string
	SourceFormat   string
	ObservedAt     time.Time
	Metadata       map[string]any
}

func guard(buf []byte) error {
	if len(buf) == 0 {
		return ErrEmpty
	}
	if len(buf) > MaxMessageBytes {
		return ErrTooLarge
	}
	return nil
}

func checkRange(lat, lon float64) error {
	if lat < -90 || lat > 90 || lon < -180 || lon > 180 {
		return ErrRange
	}
	return nil
}

func defaultStatus(s string) string {
	s = strings.ToUpper(strings.TrimSpace(s))
	switch s {
	case "OPERATIONAL", "DEGRADED", "MAINTENANCE", "NO_COMMS", "BINGO", "WINCHESTER":
		return s
	}
	return "OPERATIONAL"
}

func defaultBranch(b string) string {
	b = strings.ToLower(strings.TrimSpace(b))
	switch b {
	case "land", "air", "naval", "sof", "joint":
		return b
	}
	return "land"
}

// ---------- WILL-native JSON ----------

type willNative struct {
	ExternalID   string         `json:"external_id"`
	Callsign     string         `json:"callsign"`
	PlatformType string         `json:"platform_type"`
	Branch       string         `json:"branch"`
	Echelon      string         `json:"echelon"`
	Lat          float64        `json:"lat"`
	Lon          float64        `json:"lon"`
	HeadingDeg   float64        `json:"heading_deg"`
	SpeedMps     float64        `json:"speed_mps"`
	Status       string         `json:"status"`
	Classification string       `json:"classification"`
	ObservedAt   string         `json:"observed_at"`
	Metadata     map[string]any `json:"metadata"`
}

func FromWILLNative(buf []byte) (Report, error) {
	if err := guard(buf); err != nil {
		return Report{}, err
	}
	var w willNative
	if err := json.Unmarshal(buf, &w); err != nil {
		return Report{}, fmt.Errorf("%w: %v", ErrMalformed, err)
	}
	if w.ExternalID == "" || w.Callsign == "" {
		return Report{}, fmt.Errorf("%w: missing external_id or callsign", ErrMalformed)
	}
	if err := checkRange(w.Lat, w.Lon); err != nil {
		return Report{}, err
	}
	obs := time.Now().UTC()
	if w.ObservedAt != "" {
		if t, err := time.Parse(time.RFC3339, w.ObservedAt); err == nil {
			obs = t.UTC()
		}
	}
	md := w.Metadata
	if md == nil {
		md = map[string]any{}
	}
	return Report{
		ExternalID: w.ExternalID, Callsign: w.Callsign,
		PlatformType: orDefault(w.PlatformType, "other"),
		Branch: defaultBranch(w.Branch), Echelon: orDefault(w.Echelon, "unknown"),
		Lat: w.Lat, Lon: w.Lon, HeadingDeg: w.HeadingDeg, SpeedMps: w.SpeedMps,
		Status: defaultStatus(w.Status), Classification: orDefault(w.Classification, "NESECRET"),
		SourceFormat: "will_native", ObservedAt: obs, Metadata: md,
	}, nil
}

// ---------- CoT (friendly affiliation) ----------

type cotEvent struct {
	XMLName xml.Name `xml:"event"`
	UID     string   `xml:"uid,attr"`
	Type    string   `xml:"type,attr"`
	Time    string   `xml:"time,attr"`
	Point   struct {
		Lat float64 `xml:"lat,attr"`
		Lon float64 `xml:"lon,attr"`
	} `xml:"point"`
	Detail struct {
		Contact struct {
			Callsign string `xml:"callsign,attr"`
		} `xml:"contact"`
		Group struct {
			Name string `xml:"name,attr"`
		} `xml:"__group"`
		Track struct {
			Course float64 `xml:"course,attr"`
			Speed  float64 `xml:"speed,attr"`
		} `xml:"track"`
	} `xml:"detail"`
}

// FromCoTFriendly accepts a CoT atom event whose affiliation char is 'f'
// (a-f-...). Anything not friendly is rejected — this is the *friendly*
// force tracker, not the threat picture.
func FromCoTFriendly(buf []byte) (Report, error) {
	if err := guard(buf); err != nil {
		return Report{}, err
	}
	dec := xml.NewDecoder(bytes.NewReader(buf))
	dec.Strict = true
	dec.Entity = nil // XXE defence
	var e cotEvent
	if err := dec.Decode(&e); err != nil {
		return Report{}, fmt.Errorf("%w: %v", ErrMalformed, err)
	}
	if e.UID == "" || !strings.HasPrefix(e.Type, "a-") || len(e.Type) < 3 {
		return Report{}, fmt.Errorf("%w: missing uid or non-atom type", ErrMalformed)
	}
	if e.Type[2] != 'f' {
		return Report{}, ErrNotFriendly
	}
	if err := checkRange(e.Point.Lat, e.Point.Lon); err != nil {
		return Report{}, err
	}
	obs := time.Now().UTC()
	if t, err := time.Parse(time.RFC3339, e.Time); err == nil {
		obs = t.UTC()
	}
	branch := "land"
	if len(e.Type) >= 5 {
		switch e.Type[4] {
		case 'A':
			branch = "air"
		case 'S', 'U':
			branch = "naval"
		}
	}
	return Report{
		ExternalID: e.UID, Callsign: orDefault(e.Detail.Contact.Callsign, e.UID),
		PlatformType: "other", Branch: branch, Echelon: "unknown",
		Lat: e.Point.Lat, Lon: e.Point.Lon,
		HeadingDeg: e.Detail.Track.Course, SpeedMps: e.Detail.Track.Speed,
		Status: "OPERATIONAL", Classification: "NESECRET",
		SourceFormat: "cot_friendly", ObservedAt: obs,
		Metadata: map[string]any{"cot_type": e.Type, "group": e.Detail.Group.Name},
	}, nil
}

// ---------- NFFI (NATO Friendly Force Information — minimal SIP3) ----------

type nffiTrack struct {
	XMLName    xml.Name `xml:"track"`
	ID         string   `xml:"id,attr"`
	Callsign   string   `xml:"callsign"`
	Symbol     string   `xml:"symbol"`     // APP-6 SIDC; second char must be friendly
	Latitude   float64  `xml:"latitude"`
	Longitude  float64  `xml:"longitude"`
	Course     float64  `xml:"course"`
	Speed      float64  `xml:"speed"`
	Timestamp  string   `xml:"timestamp"`
}

func FromNFFI(buf []byte) (Report, error) {
	if err := guard(buf); err != nil {
		return Report{}, err
	}
	dec := xml.NewDecoder(bytes.NewReader(buf))
	dec.Strict = true
	dec.Entity = nil
	var n nffiTrack
	if err := dec.Decode(&n); err != nil {
		return Report{}, fmt.Errorf("%w: %v", ErrMalformed, err)
	}
	if n.ID == "" {
		return Report{}, fmt.Errorf("%w: missing track id", ErrMalformed)
	}
	// APP-6 SIDC pos 2: F=friend, A=assumed friend. Reject hostile/unknown.
	if len(n.Symbol) >= 2 && n.Symbol[1] != 'F' && n.Symbol[1] != 'A' {
		return Report{}, ErrNotFriendly
	}
	if err := checkRange(n.Latitude, n.Longitude); err != nil {
		return Report{}, err
	}
	obs := time.Now().UTC()
	if t, err := time.Parse(time.RFC3339, n.Timestamp); err == nil {
		obs = t.UTC()
	}
	return Report{
		ExternalID: n.ID, Callsign: orDefault(n.Callsign, n.ID),
		PlatformType: "other", Branch: "land", Echelon: "unknown",
		Lat: n.Latitude, Lon: n.Longitude, HeadingDeg: n.Course, SpeedMps: n.Speed,
		Status: "OPERATIONAL", Classification: "NESECRET",
		SourceFormat: "nffi", ObservedAt: obs,
		Metadata: map[string]any{"sidc": n.Symbol},
	}, nil
}

func orDefault(s, def string) string {
	if strings.TrimSpace(s) == "" {
		return def
	}
	return s
}
