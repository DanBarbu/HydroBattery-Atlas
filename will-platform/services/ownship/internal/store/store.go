// Package store is the in-memory own-ship registry. Production swaps it for
// a pgx-backed store against the V0011 schema; the API depends on the
// methods, not the implementation.
package store

import (
	"sort"
	"sync"
	"time"
)

type CommsLink struct {
	Channel       string    `json:"channel"` // voip|roip|hf|vuhf|satcom
	Bearer        string    `json:"bearer"`
	Status        string    `json:"status"`  // UP|DEGRADED|DOWN
	LatencyMs     int       `json:"latency_ms"`
	LastCheckedAt time.Time `json:"last_checked_at"`
}

type Payload struct {
	Name        string         `json:"name"`
	Kind        string         `json:"kind"` // sensor|effector
	PayloadType string         `json:"payload_type"`
	Status      string         `json:"status"` // READY|DEGRADED|OFFLINE
	ArcStartDeg *float64       `json:"arc_start_deg,omitempty"`
	ArcEndDeg   *float64       `json:"arc_end_deg,omitempty"`
	Metadata    map[string]any `json:"metadata,omitempty"`
}

type Platform struct {
	ID             string         `json:"id"`
	TenantID       string         `json:"tenant_id"`
	ExternalID     string         `json:"external_id"`
	Name           string         `json:"name"`
	HullClass      string         `json:"hull_class"`
	Lat            float64        `json:"lat"`
	Lon            float64        `json:"lon"`
	HeadingDeg     float64        `json:"heading_deg"`
	SpeedMps       float64        `json:"speed_mps"`
	Status         string         `json:"status"`
	EmconState     string         `json:"emcon_state"`
	Classification string         `json:"classification"`
	LastReportAt   time.Time      `json:"last_report_at"`
	Comms          []CommsLink    `json:"comms"`
	Payloads       []Payload      `json:"payloads"`
	Metadata       map[string]any `json:"metadata"`
}

// StateReport is the own-ship kinematic + posture report a vessel posts.
type StateReport struct {
	ExternalID     string         `json:"external_id"`
	Name           string         `json:"name"`
	HullClass      string         `json:"hull_class"`
	Lat            float64        `json:"lat"`
	Lon            float64        `json:"lon"`
	HeadingDeg     float64        `json:"heading_deg"`
	SpeedMps       float64        `json:"speed_mps"`
	Status         string         `json:"status"`
	EmconState     string         `json:"emcon_state"`
	Classification string         `json:"classification"`
	ObservedAt     time.Time      `json:"observed_at"`
	Metadata       map[string]any `json:"metadata"`
}

type Store struct {
	mu  sync.Mutex
	byT map[string]map[string]*Platform // tenant -> externalID -> platform
	seq int
}

func New() *Store { return &Store{byT: map[string]map[string]*Platform{}} }

func (s *Store) next() int { s.seq++; return s.seq }

func id(prefix string, n int) string {
	const d = "0123456789abcdefghijklmnopqrstuvwxyz"
	out := ""
	if n == 0 {
		out = "0"
	}
	for n > 0 {
		out = string(d[n%36]) + out
		n /= 36
	}
	return prefix + "-" + out
}

func defEmcon(s string) string {
	switch s {
	case "FULL", "RESTRICTED", "SILENT":
		return s
	}
	return "FULL"
}

func defStatus(s string) string {
	switch s {
	case "UNDERWAY", "ANCHORED", "ACTION_STATIONS", "MAINTENANCE":
		return s
	}
	return "UNDERWAY"
}

func defHull(s string) string {
	switch s {
	case "mmpv_90_corvette", "hisar_opv":
		return s
	}
	return "other"
}

// UpsertState applies an own-ship state report (keyed on external_id).
func (s *Store) UpsertState(tenantID string, r StateReport) Platform {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.byT[tenantID] == nil {
		s.byT[tenantID] = map[string]*Platform{}
	}
	p := s.byT[tenantID][r.ExternalID]
	if p == nil {
		p = &Platform{ID: id("plt", s.next()), TenantID: tenantID, ExternalID: r.ExternalID}
		s.byT[tenantID][r.ExternalID] = p
	}
	p.Name = r.Name
	p.HullClass = defHull(r.HullClass)
	p.Lat = r.Lat
	p.Lon = r.Lon
	p.HeadingDeg = r.HeadingDeg
	p.SpeedMps = r.SpeedMps
	p.Status = defStatus(r.Status)
	p.EmconState = defEmcon(r.EmconState)
	if r.Classification != "" {
		p.Classification = r.Classification
	} else if p.Classification == "" {
		p.Classification = "NESECRET"
	}
	if !r.ObservedAt.IsZero() {
		p.LastReportAt = r.ObservedAt
	} else {
		p.LastReportAt = time.Now().UTC()
	}
	if r.Metadata != nil {
		p.Metadata = r.Metadata
	}
	return *p
}

func (s *Store) List(tenantID string) []Platform {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]Platform, 0, len(s.byT[tenantID]))
	for _, p := range s.byT[tenantID] {
		out = append(out, *p)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func (s *Store) Get(tenantID, pid string) (Platform, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, p := range s.byT[tenantID] {
		if p.ID == pid {
			return *p, true
		}
	}
	return Platform{}, false
}

func (s *Store) SetComms(tenantID, pid string, links []CommsLink) (Platform, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, p := range s.byT[tenantID] {
		if p.ID == pid {
			p.Comms = links
			return *p, true
		}
	}
	return Platform{}, false
}

func (s *Store) SetPayloads(tenantID, pid string, payloads []Payload) (Platform, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, p := range s.byT[tenantID] {
		if p.ID == pid {
			p.Payloads = payloads
			return *p, true
		}
	}
	return Platform{}, false
}

// CommsDegraded returns platforms with at least one DEGRADED or DOWN link
// (the offline-first / EMCON-SILENT picture).
func (s *Store) CommsDegraded(tenantID string) []Platform {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []Platform
	for _, p := range s.byT[tenantID] {
		for _, l := range p.Comms {
			if l.Status == "DEGRADED" || l.Status == "DOWN" {
				out = append(out, *p)
				break
			}
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}
