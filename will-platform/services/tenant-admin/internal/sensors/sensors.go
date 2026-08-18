// Package sensors implements the Sprint 4 sensor registry.
//
// One row per registered sensor; bulk register accepts a list. Telemetry
// emitted by plugins is matched against this registry by `external_id`.
package sensors

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Family string

const (
	FamilyLora    Family = "lora"
	FamilyGMTI    Family = "gmti"
	FamilyCoT     Family = "cot"
	FamilyMAVLink Family = "mavlink"
	FamilyOther   Family = "other"
)

func (f Family) Valid() bool {
	switch f {
	case FamilyLora, FamilyGMTI, FamilyCoT, FamilyMAVLink, FamilyOther:
		return true
	}
	return false
}

type Sensor struct {
	ID             string         `json:"id"`
	TenantID       string         `json:"tenant_id"`
	ExternalID     string         `json:"external_id"`
	Family         Family         `json:"family"`
	DisplayName    string         `json:"display_name"`
	HomeLat        *float64       `json:"home_lat,omitempty"`
	HomeLon        *float64       `json:"home_lon,omitempty"`
	Classification string         `json:"classification"`
	Enabled        bool           `json:"enabled"`
	Metadata       map[string]any `json:"metadata"`
	CreatedAt      time.Time      `json:"created_at"`
}

type RegisterInput struct {
	ExternalID     string         `json:"external_id"`
	Family         Family         `json:"family"`
	DisplayName    string         `json:"display_name"`
	HomeLat        *float64       `json:"home_lat,omitempty"`
	HomeLon        *float64       `json:"home_lon,omitempty"`
	Classification string         `json:"classification,omitempty"`
	Metadata       map[string]any `json:"metadata,omitempty"`
}

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

func (s *Store) ListByTenant(ctx context.Context, tenantID string) ([]Sensor, error) {
	rows, err := s.pool.Query(ctx, `
SELECT id::text, tenant_id::text, external_id, family, display_name,
       home_lat, home_lon, classification, enabled, metadata, created_at
FROM sensors WHERE tenant_id::text = $1
ORDER BY family, display_name`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Sensor
	for rows.Next() {
		var sn Sensor
		var family string
		var meta []byte
		if err := rows.Scan(&sn.ID, &sn.TenantID, &sn.ExternalID, &family, &sn.DisplayName,
			&sn.HomeLat, &sn.HomeLon, &sn.Classification, &sn.Enabled, &meta, &sn.CreatedAt); err != nil {
			return nil, err
		}
		sn.Family = Family(family)
		sn.Metadata = jsonToMap(meta)
		out = append(out, sn)
	}
	return out, rows.Err()
}

// BulkRegister inserts up to MaxBulk sensors atomically. Returns the slice of
// inserted sensors. Conflicting (tenant, external_id) rows are silently
// skipped — the caller diff-checks via the returned IDs.
const MaxBulk = 1000

func (s *Store) BulkRegister(ctx context.Context, tenantID string, in []RegisterInput) ([]Sensor, error) {
	if len(in) == 0 {
		return nil, nil
	}
	if len(in) > MaxBulk {
		return nil, fmt.Errorf("bulk register exceeds max %d", MaxBulk)
	}
	for i, r := range in {
		if r.ExternalID == "" || r.DisplayName == "" {
			return nil, fmt.Errorf("entry %d: external_id and display_name are required", i)
		}
		if !r.Family.Valid() {
			return nil, fmt.Errorf("entry %d: invalid family %q", i, r.Family)
		}
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	out := make([]Sensor, 0, len(in))
	for _, r := range in {
		classification := r.Classification
		if classification == "" {
			classification = "NESECRET"
		}
		md := r.Metadata
		if md == nil {
			md = map[string]any{}
		}
		mdBytes, _ := json.Marshal(md)

		var sn Sensor
		var family string
		var meta []byte
		err := tx.QueryRow(ctx, `
INSERT INTO sensors (tenant_id, external_id, family, display_name, home_lat, home_lon, classification, metadata)
VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::jsonb)
ON CONFLICT (tenant_id, external_id) DO NOTHING
RETURNING id::text, tenant_id::text, external_id, family, display_name,
          home_lat, home_lon, classification, enabled, metadata, created_at
`, tenantID, r.ExternalID, string(r.Family), r.DisplayName, r.HomeLat, r.HomeLon, classification, string(mdBytes)).
			Scan(&sn.ID, &sn.TenantID, &sn.ExternalID, &family, &sn.DisplayName,
				&sn.HomeLat, &sn.HomeLon, &sn.Classification, &sn.Enabled, &meta, &sn.CreatedAt)
		if err != nil {
			// ON CONFLICT DO NOTHING + RETURNING returns no rows on conflict;
			// silently skip those.
			if errors.Is(err, errNoRows) {
				continue
			}
			if err.Error() == "no rows in result set" {
				continue
			}
			return nil, err
		}
		sn.Family = Family(family)
		sn.Metadata = jsonToMap(meta)
		out = append(out, sn)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return out, nil
}

var errNoRows = errors.New("no rows in result set")

func jsonToMap(b []byte) map[string]any {
	if len(b) == 0 {
		return map[string]any{}
	}
	out := map[string]any{}
	_ = json.Unmarshal(b, &out)
	return out
}
