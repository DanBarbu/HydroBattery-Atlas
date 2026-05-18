// Package store is the in-memory friendly-asset registry. Production swaps
// it for a pgx-backed store against the V0009 schema; the API depends on
// the interface, not the implementation.
package store

import (
	"sort"
	"sync"
	"time"

	"github.com/will-platform/bft/internal/normalize"
)

type Asset struct {
	ID             string         `json:"id"`
	TenantID       string         `json:"tenant_id"`
	ExternalID     string         `json:"external_id"`
	Callsign       string         `json:"callsign"`
	PlatformType   string         `json:"platform_type"`
	Branch         string         `json:"branch"`
	Echelon        string         `json:"echelon"`
	Lat            float64        `json:"lat"`
	Lon            float64        `json:"lon"`
	HeadingDeg     float64        `json:"heading_deg"`
	SpeedMps       float64        `json:"speed_mps"`
	Status         string         `json:"status"`
	Classification string         `json:"classification"`
	SourceFormat   string         `json:"source_format"`
	LastReportAt   time.Time      `json:"last_report_at"`
	Metadata       map[string]any `json:"metadata"`
}

type Store struct {
	mu     sync.Mutex
	byT    map[string]map[string]*Asset // tenant -> externalID -> asset
	seq    int
}

func New() *Store {
	return &Store{byT: map[string]map[string]*Asset{}}
}

func (s *Store) next() int { s.seq++; return s.seq }

// Ingest upserts an asset from a normalized report (keyed on external_id).
func (s *Store) Ingest(tenantID string, r normalize.Report) Asset {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.byT[tenantID] == nil {
		s.byT[tenantID] = map[string]*Asset{}
	}
	a := s.byT[tenantID][r.ExternalID]
	if a == nil {
		a = &Asset{ID: idFor(s.next()), TenantID: tenantID, ExternalID: r.ExternalID}
		s.byT[tenantID][r.ExternalID] = a
	}
	a.Callsign = r.Callsign
	a.PlatformType = r.PlatformType
	a.Branch = r.Branch
	a.Echelon = r.Echelon
	a.Lat = r.Lat
	a.Lon = r.Lon
	a.HeadingDeg = r.HeadingDeg
	a.SpeedMps = r.SpeedMps
	a.Status = r.Status
	a.Classification = r.Classification
	a.SourceFormat = r.SourceFormat
	a.LastReportAt = r.ObservedAt
	a.Metadata = r.Metadata
	return *a
}

func (s *Store) List(tenantID string) []Asset {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]Asset, 0, len(s.byT[tenantID]))
	for _, a := range s.byT[tenantID] {
		out = append(out, *a)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Branch != out[j].Branch {
			return out[i].Branch < out[j].Branch
		}
		return out[i].Callsign < out[j].Callsign
	})
	return out
}

func (s *Store) Get(tenantID, id string) (Asset, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, a := range s.byT[tenantID] {
		if a.ID == id {
			return *a, true
		}
	}
	return Asset{}, false
}

// Stale returns assets whose last report is older than `age`. Drives the
// NO_COMMS detection in the operator UI.
func (s *Store) Stale(tenantID string, age time.Duration, now time.Time) []Asset {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []Asset
	for _, a := range s.byT[tenantID] {
		if now.Sub(a.LastReportAt) > age {
			out = append(out, *a)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].LastReportAt.Before(out[j].LastReportAt) })
	return out
}

func idFor(n int) string {
	const d = "0123456789abcdefghijklmnopqrstuvwxyz"
	s := ""
	if n == 0 {
		s = "0"
	}
	for n > 0 {
		s = string(d[n%36]) + s
		n /= 36
	}
	return "fa-" + s
}
