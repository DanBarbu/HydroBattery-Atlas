// Package dal holds the in-memory Defended Asset List and Engagement Zones.
// The production deployment swaps the *MemoryStore for a pgx-backed
// implementation against the V0008 schema.
package dal

import (
	"context"
	"errors"
	"sync"
	"time"
)

type DefendedAsset struct {
	ID             string    `json:"id"`
	TenantID       string    `json:"tenant_id"`
	ExternalID     string    `json:"external_id"`
	DisplayName    string    `json:"display_name"`
	Lat            float64   `json:"lat"`
	Lon            float64   `json:"lon"`
	Criticality    int       `json:"criticality"` // 1..5
	Classification string    `json:"classification"`
	CreatedAt      time.Time `json:"created_at"`
}

type EngagementZoneKind string

const (
	KindWEZ     EngagementZoneKind = "WEZ"
	KindHIDACZ  EngagementZoneKind = "HIDACZ"
	KindJEZ     EngagementZoneKind = "JEZ"
	KindMEZ     EngagementZoneKind = "MEZ"
	KindFEZ     EngagementZoneKind = "FEZ"
	KindROZ     EngagementZoneKind = "ROZ"
)

// Polygon is GeoJSON [[[lon, lat], ...]] (one outer ring; no holes in Sprint 5+).
type Polygon [][][2]float64

type EngagementZone struct {
	ID             string             `json:"id"`
	TenantID       string             `json:"tenant_id"`
	ExternalID     string             `json:"external_id"`
	Name           string             `json:"name"`
	Kind           EngagementZoneKind `json:"kind"`
	Polygon        Polygon            `json:"polygon"`
	ActiveFrom     *time.Time         `json:"active_from,omitempty"`
	ActiveTo       *time.Time         `json:"active_to,omitempty"`
	Classification string             `json:"classification"`
	CreatedAt      time.Time          `json:"created_at"`
}

var (
	ErrNotFound = errors.New("dal: not found")
)

type MemoryStore struct {
	mu     sync.Mutex
	assets map[string][]DefendedAsset
	zones  map[string][]EngagementZone
	seq    int
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{assets: map[string][]DefendedAsset{}, zones: map[string][]EngagementZone{}}
}

func (s *MemoryStore) nextID(prefix string) string {
	s.seq++
	return prefix + "-" + intToBase36(s.seq)
}

func intToBase36(n int) string {
	if n == 0 {
		return "0"
	}
	const digits = "0123456789abcdefghijklmnopqrstuvwxyz"
	out := ""
	for n > 0 {
		out = string(digits[n%36]) + out
		n /= 36
	}
	return out
}

// ---- DAL ----

func (s *MemoryStore) ListAssets(_ context.Context, tenantID string) ([]DefendedAsset, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]DefendedAsset{}, s.assets[tenantID]...), nil
}

func (s *MemoryStore) UpsertAsset(_ context.Context, a DefendedAsset) (DefendedAsset, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	existing := s.assets[a.TenantID]
	for i := range existing {
		if existing[i].ExternalID == a.ExternalID {
			a.ID = existing[i].ID
			a.CreatedAt = existing[i].CreatedAt
			existing[i] = a
			s.assets[a.TenantID] = existing
			return a, nil
		}
	}
	if a.ID == "" {
		a.ID = s.nextID("dal")
	}
	if a.CreatedAt.IsZero() {
		a.CreatedAt = time.Now().UTC()
	}
	s.assets[a.TenantID] = append(existing, a)
	return a, nil
}

// ---- Engagement zones ----

func (s *MemoryStore) ListZones(_ context.Context, tenantID string) ([]EngagementZone, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]EngagementZone{}, s.zones[tenantID]...), nil
}

func (s *MemoryStore) UpsertZone(_ context.Context, z EngagementZone) (EngagementZone, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	existing := s.zones[z.TenantID]
	for i := range existing {
		if existing[i].ExternalID == z.ExternalID {
			z.ID = existing[i].ID
			z.CreatedAt = existing[i].CreatedAt
			existing[i] = z
			s.zones[z.TenantID] = existing
			return z, nil
		}
	}
	if z.ID == "" {
		z.ID = s.nextID("ez")
	}
	if z.CreatedAt.IsZero() {
		z.CreatedAt = time.Now().UTC()
	}
	s.zones[z.TenantID] = append(existing, z)
	return z, nil
}

// PointInPolygon — simple ray casting on the first ring. Used to gate
// "is this engagement zone applicable to this target?".
func PointInPolygon(lon, lat float64, poly Polygon) bool {
	if len(poly) == 0 || len(poly[0]) < 3 {
		return false
	}
	ring := poly[0]
	inside := false
	j := len(ring) - 1
	for i := range ring {
		xi, yi := ring[i][0], ring[i][1]
		xj, yj := ring[j][0], ring[j][1]
		intersect := ((yi > lat) != (yj > lat)) &&
			(lon < (xj-xi)*(lat-yi)/(yj-yi)+xi)
		if intersect {
			inside = !inside
		}
		j = i
	}
	return inside
}
