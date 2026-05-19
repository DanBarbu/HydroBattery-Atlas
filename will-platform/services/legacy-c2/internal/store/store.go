// Package store holds the normalised legacy tracks and the southbound
// (2525D + AdatP-3) render log. ADR-014: WILL never writes BC2A's DB;
// this is WILL's own normalised view + a southbound feed the customer's
// ICIS gateway pulls. Tenant-isolated, in-memory (pgx swap in prod).
package store

import (
	"sort"
	"sync"
	"time"
)

type Track struct {
	ID             string         `json:"id"`
	TenantID       string         `json:"tenant_id"`
	ExternalID     string         `json:"external_id"`
	SourceFormat   string         `json:"source_format"` // jc3iedm | adatp3
	Callsign       string         `json:"callsign"`
	Hostility      string         `json:"hostility"`
	Dimension      string         `json:"dimension"`
	Echelon        string         `json:"echelon"`
	Lat            float64        `json:"lat"`
	Lon            float64        `json:"lon"`
	AltitudeM      float64        `json:"altitude_m"`
	APP6SIDC       string         `json:"app6_sidc"`
	Classification string         `json:"classification"`
	ObservedAt     time.Time      `json:"observed_at"`
	ReceivedAt     time.Time      `json:"received_at"`
	Metadata       map[string]any `json:"metadata"`
}

type Southbound struct {
	ID              string    `json:"id"`
	TenantID        string    `json:"tenant_id"`
	TrackExternalID string    `json:"track_external_id"`
	APP6SIDC        string    `json:"app6_sidc"`
	AdatP3          string    `json:"adatp3"`
	Classification  string    `json:"classification"`
	RenderedAt      time.Time `json:"rendered_at"`
}

type Store struct {
	mu     sync.Mutex
	tracks map[string]map[string]*Track // tenant -> ext -> track
	south  map[string][]Southbound      // tenant -> rolling log (capped)
	seq    int
}

const southCap = 200

func New() *Store {
	return &Store{tracks: map[string]map[string]*Track{}, south: map[string][]Southbound{}}
}

func (s *Store) id(p string) string {
	s.seq++
	const d = "0123456789abcdefghijklmnopqrstuvwxyz"
	n, out := s.seq, ""
	for n > 0 {
		out = string(d[n%36]) + out
		n /= 36
	}
	return p + "-" + out
}

// UpsertTrack stores/refreshes a normalised legacy track (BC2A as a
// sensor source).
func (s *Store) UpsertTrack(t Track) Track {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.tracks[t.TenantID] == nil {
		s.tracks[t.TenantID] = map[string]*Track{}
	}
	cur := s.tracks[t.TenantID][t.ExternalID]
	if cur == nil {
		cur = &Track{ID: s.id("lt"), TenantID: t.TenantID, ExternalID: t.ExternalID}
		s.tracks[t.TenantID][t.ExternalID] = cur
	}
	t.ID = cur.ID
	t.ReceivedAt = time.Now().UTC()
	*cur = t
	return *cur
}

func (s *Store) ListTracks(tenantID string) []Track {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]Track, 0, len(s.tracks[tenantID]))
	for _, t := range s.tracks[tenantID] {
		out = append(out, *t)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ObservedAt.After(out[j].ObservedAt) })
	return out
}

// AppendSouthbound records a rendered backwards-compat message (display
// only — the customer ICIS gateway, not WILL, injects it into BC2A).
func (s *Store) AppendSouthbound(m Southbound) Southbound {
	s.mu.Lock()
	defer s.mu.Unlock()
	m.ID = s.id("sb")
	m.RenderedAt = time.Now().UTC()
	lst := append(s.south[m.TenantID], m)
	if len(lst) > southCap {
		lst = lst[len(lst)-southCap:]
	}
	s.south[m.TenantID] = lst
	return m
}

func (s *Store) ListSouthbound(tenantID string) []Southbound {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := append([]Southbound{}, s.south[tenantID]...)
	sort.Slice(out, func(i, j int) bool { return out[i].RenderedAt.After(out[j].RenderedAt) })
	return out
}
