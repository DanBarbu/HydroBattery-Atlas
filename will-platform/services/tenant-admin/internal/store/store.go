// Package store wraps PostgreSQL access for the tenant-admin service.
//
// Sprint 2 ships shared-DB / tenant-column isolation. Sprint 3 will add the
// per-tenant DB compartment option for high-classification deployments.
package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("tenant not found")

type Tenant struct {
	ID          string         `json:"id"`
	Slug        string         `json:"slug"`
	DisplayName string         `json:"display_name"`
	Theme       map[string]any `json:"theme"`
	Features    map[string]any `json:"features"`
	Terminology map[string]any `json:"terminology"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

// CreateInput / UpdateInput intentionally separate from Tenant so the API
// layer does not accept server-managed fields (id/created_at/updated_at).
type CreateInput struct {
	Slug        string         `json:"slug"`
	DisplayName string         `json:"display_name"`
	Theme       map[string]any `json:"theme,omitempty"`
	Features    map[string]any `json:"features,omitempty"`
	Terminology map[string]any `json:"terminology,omitempty"`
}

type UpdateInput struct {
	DisplayName *string         `json:"display_name,omitempty"`
	Theme       *map[string]any `json:"theme,omitempty"`
	Features    *map[string]any `json:"features,omitempty"`
	Terminology *map[string]any `json:"terminology,omitempty"`
}

type Store struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

func (s *Store) List(ctx context.Context) ([]Tenant, error) {
	rows, err := s.pool.Query(ctx, `
SELECT id::text, slug, display_name, theme, features, terminology, created_at, updated_at
FROM tenants ORDER BY display_name`)
	if err != nil {
		return nil, fmt.Errorf("query: %w", err)
	}
	defer rows.Close()
	return scanTenants(rows)
}

func (s *Store) Get(ctx context.Context, id string) (Tenant, error) {
	row := s.pool.QueryRow(ctx, `
SELECT id::text, slug, display_name, theme, features, terminology, created_at, updated_at
FROM tenants WHERE id::text = $1`, id)
	t, err := scanTenant(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return Tenant{}, ErrNotFound
	}
	return t, err
}

func (s *Store) Create(ctx context.Context, in CreateInput) (Tenant, error) {
	if in.Slug == "" || in.DisplayName == "" {
		return Tenant{}, errors.New("slug and display_name are required")
	}
	theme, _ := json.Marshal(orEmpty(in.Theme))
	features, _ := json.Marshal(orEmpty(in.Features))
	term, _ := json.Marshal(orEmpty(in.Terminology))
	row := s.pool.QueryRow(ctx, `
INSERT INTO tenants (slug, display_name, theme, features, terminology)
VALUES ($1, $2, $3, $4, $5)
RETURNING id::text, slug, display_name, theme, features, terminology, created_at, updated_at
`, in.Slug, in.DisplayName, theme, features, term)
	return scanTenant(row)
}

func (s *Store) Update(ctx context.Context, id string, in UpdateInput) (Tenant, error) {
	current, err := s.Get(ctx, id)
	if err != nil {
		return Tenant{}, err
	}
	if in.DisplayName != nil {
		current.DisplayName = *in.DisplayName
	}
	if in.Theme != nil {
		current.Theme = *in.Theme
	}
	if in.Features != nil {
		current.Features = *in.Features
	}
	if in.Terminology != nil {
		current.Terminology = *in.Terminology
	}
	theme, _ := json.Marshal(orEmpty(current.Theme))
	features, _ := json.Marshal(orEmpty(current.Features))
	term, _ := json.Marshal(orEmpty(current.Terminology))
	row := s.pool.QueryRow(ctx, `
UPDATE tenants SET display_name = $2, theme = $3, features = $4, terminology = $5
WHERE id::text = $1
RETURNING id::text, slug, display_name, theme, features, terminology, created_at, updated_at
`, id, current.DisplayName, theme, features, term)
	return scanTenant(row)
}

func scanTenant(row pgx.Row) (Tenant, error) {
	var t Tenant
	var theme, features, term []byte
	if err := row.Scan(&t.ID, &t.Slug, &t.DisplayName, &theme, &features, &term, &t.CreatedAt, &t.UpdatedAt); err != nil {
		return Tenant{}, err
	}
	t.Theme = jsonToMap(theme)
	t.Features = jsonToMap(features)
	t.Terminology = jsonToMap(term)
	return t, nil
}

func scanTenants(rows pgx.Rows) ([]Tenant, error) {
	var out []Tenant
	for rows.Next() {
		t, err := scanTenant(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func jsonToMap(b []byte) map[string]any {
	if len(b) == 0 {
		return map[string]any{}
	}
	out := map[string]any{}
	_ = json.Unmarshal(b, &out)
	return out
}

func orEmpty(m map[string]any) map[string]any {
	if m == nil {
		return map[string]any{}
	}
	return m
}
