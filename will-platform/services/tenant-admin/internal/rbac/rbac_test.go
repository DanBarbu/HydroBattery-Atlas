package rbac

import "testing"

func TestRoleValid(t *testing.T) {
	for _, r := range []Role{RoleViewer, RoleOperator, RoleAdmin, RoleAuditor, RoleCrossTenantAuditor} {
		if !r.Valid() {
			t.Errorf("expected %q to be valid", r)
		}
	}
	if Role("nope").Valid() {
		t.Error("expected invalid role to be rejected")
	}
}

func TestAllow(t *testing.T) {
	cases := []struct {
		role   Role
		action Action
		want   error
	}{
		{RoleViewer, ActionViewTracks, nil},
		{RoleViewer, ActionUpdateTenant, ErrForbidden},
		{RoleOperator, ActionListSensors, nil},
		{RoleOperator, ActionRegisterSensor, ErrForbidden},
		{RoleAdmin, ActionRegisterSensor, nil},
		{RoleAdmin, ActionRotateKey, nil},
		{RoleAuditor, ActionExportAudit, nil},
		{RoleAuditor, ActionUpdateTenant, ErrForbidden},
		{RoleCrossTenantAuditor, ActionExportAudit, nil},
		{Role("nope"), ActionViewTracks, ErrForbidden},
	}
	for _, c := range cases {
		got := Allow(c.role, c.action)
		if got != c.want {
			t.Errorf("Allow(%q, %q) = %v; want %v", c.role, c.action, got, c.want)
		}
	}
}
