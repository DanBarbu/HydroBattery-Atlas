// Package rbac models the WILL role catalogue and the tenant-scoped
// user→tenant→role mapping. Sprint 4 ships the schema and the in-process
// authoriser; NPKI / smart-card binding lands in Sprint 10.
package rbac

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Role string

const (
	RoleViewer              Role = "viewer"
	RoleOperator            Role = "operator"
	RoleAdmin               Role = "admin"
	RoleAuditor             Role = "auditor"
	RoleCrossTenantAuditor  Role = "cross_tenant_auditor"
)

func (r Role) Valid() bool {
	switch r {
	case RoleViewer, RoleOperator, RoleAdmin, RoleAuditor, RoleCrossTenantAuditor:
		return true
	}
	return false
}

// Policy is the in-process authoriser. It is intentionally tiny: deny by
// default, explicit allow for each (role, action) pair. Sprint 4 covers the
// admin-UI and plugin-loader surfaces; Sprint 10 layers NPKI authentication
// on top.
type Action string

const (
	ActionListTenants    Action = "tenants.list"
	ActionUpdateTenant   Action = "tenants.update"
	ActionListSensors    Action = "sensors.list"
	ActionRegisterSensor Action = "sensors.register"
	ActionViewTracks     Action = "tracks.view"
	ActionExportAudit    Action = "audit.export"
	ActionRotateKey      Action = "kms.rotate"
)

var allowed = map[Role]map[Action]struct{}{
	RoleViewer: {
		ActionViewTracks: {},
	},
	RoleOperator: {
		ActionViewTracks:     {},
		ActionListSensors:    {},
	},
	RoleAdmin: {
		ActionListTenants:    {},
		ActionUpdateTenant:   {},
		ActionListSensors:    {},
		ActionRegisterSensor: {},
		ActionViewTracks:     {},
		ActionRotateKey:      {},
	},
	RoleAuditor: {
		ActionListTenants: {},
		ActionListSensors: {},
		ActionViewTracks:  {},
		ActionExportAudit: {},
	},
	RoleCrossTenantAuditor: {
		ActionListTenants: {},
		ActionListSensors: {},
		ActionViewTracks:  {},
		ActionExportAudit: {},
	},
}

// Allow returns nil if `role` may perform `action`. Otherwise ErrForbidden.
func Allow(role Role, action Action) error {
	if !role.Valid() {
		return ErrForbidden
	}
	if _, ok := allowed[role][action]; ok {
		return nil
	}
	return ErrForbidden
}

var ErrForbidden = errors.New("rbac: forbidden")

// Store reads role assignments from PostgreSQL.
type Store struct {
	pool *pgxpool.Pool
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

type Membership struct {
	UserID   string `json:"user_id"`
	TenantID string `json:"tenant_id"`
	Role     Role   `json:"role"`
}

func (s *Store) MembershipsByTenant(ctx context.Context, tenantID string) ([]Membership, error) {
	rows, err := s.pool.Query(ctx, `
SELECT user_id::text, tenant_id::text, role::text
FROM user_tenants WHERE tenant_id::text = $1
ORDER BY role, user_id`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Membership
	for rows.Next() {
		var m Membership
		var roleStr string
		if err := rows.Scan(&m.UserID, &m.TenantID, &roleStr); err != nil {
			return nil, err
		}
		m.Role = Role(roleStr)
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *Store) Grant(ctx context.Context, userID, tenantID string, role Role, grantedBy string) error {
	if !role.Valid() {
		return errors.New("invalid role")
	}
	_, err := s.pool.Exec(ctx, `
INSERT INTO user_tenants (user_id, tenant_id, role, granted_by)
VALUES ($1::uuid, $2::uuid, $3::user_role, NULLIF($4,'')::uuid)
ON CONFLICT DO NOTHING`, userID, tenantID, string(role), grantedBy)
	return err
}

func (s *Store) Revoke(ctx context.Context, userID, tenantID string, role Role) error {
	_, err := s.pool.Exec(ctx, `
DELETE FROM user_tenants
WHERE user_id::text = $1 AND tenant_id::text = $2 AND role::text = $3`,
		userID, tenantID, string(role))
	return err
}
