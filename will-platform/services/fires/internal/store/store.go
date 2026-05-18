// Package store holds the in-memory FSCM + fire-mission-status registry.
// READ-ONLY w.r.t. fires (ADR-012): there is no create-fire-mission, no
// tasking, no solution. Ingest methods accept data that ORIGINATES in the
// authoritative fires C2; they do not author it.
package store

import (
	"sort"
	"sync"
	"time"

	"github.com/will-platform/fires/internal/deconflict"
)

type FSCM struct {
	ID            string           `json:"id"`
	TenantID      string           `json:"tenant_id"`
	ExternalID    string           `json:"external_id"`
	MeasureType   string           `json:"measure_type"`
	Name          string           `json:"name"`
	Polygon       [][2]float64     `json:"polygon"`
	MinAltM       *float64         `json:"min_alt_m,omitempty"`
	MaxAltM       *float64         `json:"max_alt_m,omitempty"`
	EffectiveFrom *time.Time       `json:"effective_from,omitempty"`
	EffectiveTo   *time.Time       `json:"effective_to,omitempty"`
	Source        string           `json:"source"`
	Classification string          `json:"classification"`
	ReceivedAt    time.Time        `json:"received_at"`
}

type FireMissionStatus struct {
	ID             string     `json:"id"`
	TenantID       string     `json:"tenant_id"`
	ExternalID     string     `json:"external_id"`
	Status         string     `json:"status"`
	TargetLat      *float64   `json:"target_lat,omitempty"`
	TargetLon      *float64   `json:"target_lon,omitempty"`
	ACARef         string     `json:"aca_ref,omitempty"`
	FiringUnit     string     `json:"firing_unit"`
	ETASplash      *time.Time `json:"eta_splash,omitempty"`
	Source         string     `json:"source"`
	Classification string     `json:"classification"`
	ObservedAt     time.Time  `json:"observed_at"`
	ReceivedAt     time.Time  `json:"received_at"`
}

type Store struct {
	mu   sync.Mutex
	fscm map[string]map[string]*FSCM              // tenant -> ext -> measure
	fms  map[string]map[string]*FireMissionStatus // tenant -> ext -> status
	seq  int
}

func New() *Store {
	return &Store{
		fscm: map[string]map[string]*FSCM{},
		fms:  map[string]map[string]*FireMissionStatus{},
	}
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

// IngestFSCM upserts a coordination measure received from the fires C2.
func (s *Store) IngestFSCM(tenantID string, m FSCM) FSCM {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.fscm[tenantID] == nil {
		s.fscm[tenantID] = map[string]*FSCM{}
	}
	cur := s.fscm[tenantID][m.ExternalID]
	if cur == nil {
		cur = &FSCM{ID: s.id("fscm"), TenantID: tenantID, ExternalID: m.ExternalID}
		s.fscm[tenantID][m.ExternalID] = cur
	}
	m.ID, m.TenantID, m.ExternalID = cur.ID, tenantID, m.ExternalID
	if m.Source == "" {
		m.Source = "afatds"
	}
	if m.Classification == "" {
		m.Classification = "NESECRET"
	}
	m.ReceivedAt = time.Now().UTC()
	*cur = m
	return *cur
}

func (s *Store) ListFSCM(tenantID string) []FSCM {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]FSCM, 0, len(s.fscm[tenantID]))
	for _, m := range s.fscm[tenantID] {
		out = append(out, *m)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func (s *Store) ActiveFSCM(tenantID string, at time.Time) []FSCM {
	out := []FSCM{}
	for _, m := range s.ListFSCM(tenantID) {
		dm := deconflict.Measure{EffectiveFrom: m.EffectiveFrom, EffectiveTo: m.EffectiveTo}
		if dm.Active(at) {
			out = append(out, m)
		}
	}
	return out
}

// IngestFireMissionStatus upserts a fire-mission STATUS received from the
// fires C2. Status only — never a fire mission, target tasking, or solution.
func (s *Store) IngestFireMissionStatus(tenantID string, f FireMissionStatus) FireMissionStatus {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.fms[tenantID] == nil {
		s.fms[tenantID] = map[string]*FireMissionStatus{}
	}
	cur := s.fms[tenantID][f.ExternalID]
	if cur == nil {
		cur = &FireMissionStatus{ID: s.id("fms"), TenantID: tenantID, ExternalID: f.ExternalID}
		s.fms[tenantID][f.ExternalID] = cur
	}
	f.ID, f.TenantID = cur.ID, tenantID
	if f.Source == "" {
		f.Source = "afatds"
	}
	if f.Classification == "" {
		f.Classification = "NESECRET"
	}
	if f.ObservedAt.IsZero() {
		f.ObservedAt = time.Now().UTC()
	}
	f.ReceivedAt = time.Now().UTC()
	*cur = f
	return *cur
}

func (s *Store) ListFireMissions(tenantID string) []FireMissionStatus {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]FireMissionStatus, 0, len(s.fms[tenantID]))
	for _, f := range s.fms[tenantID] {
		out = append(out, *f)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ObservedAt.After(out[j].ObservedAt) })
	return out
}

// ToDeconflictMeasures adapts the active FSCM for the advisory checker.
func (s *Store) ToDeconflictMeasures(tenantID string, at time.Time) []deconflict.Measure {
	var out []deconflict.Measure
	for _, m := range s.ActiveFSCM(tenantID, at) {
		ring := make(deconflict.Ring, len(m.Polygon))
		copy(ring, m.Polygon)
		out = append(out, deconflict.Measure{
			ExternalID: m.ExternalID, MeasureType: m.MeasureType, Name: m.Name,
			Polygon: ring, MinAltM: m.MinAltM, MaxAltM: m.MaxAltM,
			EffectiveFrom: m.EffectiveFrom, EffectiveTo: m.EffectiveTo,
		})
	}
	return out
}
