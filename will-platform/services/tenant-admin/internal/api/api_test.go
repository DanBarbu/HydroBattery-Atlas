package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/will-platform/tenant-admin/internal/rbac"
	"github.com/will-platform/tenant-admin/internal/sensors"
	"github.com/will-platform/tenant-admin/internal/store"
)

type fakeTenants struct {
	tenants map[string]store.Tenant
	listErr error
}

func newFakeTenants() *fakeTenants { return &fakeTenants{tenants: map[string]store.Tenant{}} }

func (f *fakeTenants) List(_ context.Context) ([]store.Tenant, error) {
	if f.listErr != nil {
		return nil, f.listErr
	}
	out := make([]store.Tenant, 0, len(f.tenants))
	for _, t := range f.tenants {
		out = append(out, t)
	}
	return out, nil
}
func (f *fakeTenants) Get(_ context.Context, id string) (store.Tenant, error) {
	t, ok := f.tenants[id]
	if !ok {
		return store.Tenant{}, store.ErrNotFound
	}
	return t, nil
}
func (f *fakeTenants) Create(_ context.Context, in store.CreateInput) (store.Tenant, error) {
	t := store.Tenant{ID: in.Slug, Slug: in.Slug, DisplayName: in.DisplayName, Theme: in.Theme}
	f.tenants[t.ID] = t
	return t, nil
}
func (f *fakeTenants) Update(_ context.Context, id string, in store.UpdateInput) (store.Tenant, error) {
	t, ok := f.tenants[id]
	if !ok {
		return store.Tenant{}, store.ErrNotFound
	}
	if in.DisplayName != nil {
		t.DisplayName = *in.DisplayName
	}
	if in.Theme != nil {
		t.Theme = *in.Theme
	}
	f.tenants[id] = t
	return t, nil
}

type fakeSensors struct {
	byTenant map[string][]sensors.Sensor
}

func newFakeSensors() *fakeSensors { return &fakeSensors{byTenant: map[string][]sensors.Sensor{}} }
func (f *fakeSensors) ListByTenant(_ context.Context, t string) ([]sensors.Sensor, error) {
	return f.byTenant[t], nil
}
func (f *fakeSensors) BulkRegister(_ context.Context, t string, in []sensors.RegisterInput) ([]sensors.Sensor, error) {
	out := make([]sensors.Sensor, 0, len(in))
	for _, r := range in {
		s := sensors.Sensor{ID: r.ExternalID, TenantID: t, ExternalID: r.ExternalID, Family: r.Family, DisplayName: r.DisplayName, Enabled: true}
		f.byTenant[t] = append(f.byTenant[t], s)
		out = append(out, s)
	}
	return out, nil
}

type fakeRBAC struct {
	memberships map[string][]rbac.Membership
	grantErr    error
}

func newFakeRBAC() *fakeRBAC { return &fakeRBAC{memberships: map[string][]rbac.Membership{}} }
func (f *fakeRBAC) MembershipsByTenant(_ context.Context, t string) ([]rbac.Membership, error) {
	return f.memberships[t], nil
}
func (f *fakeRBAC) Grant(_ context.Context, u, t string, r rbac.Role, _ string) error {
	if f.grantErr != nil {
		return f.grantErr
	}
	f.memberships[t] = append(f.memberships[t], rbac.Membership{UserID: u, TenantID: t, Role: r})
	return nil
}
func (f *fakeRBAC) Revoke(_ context.Context, _, _ string, _ rbac.Role) error { return nil }

func handler() http.Handler {
	return New(Deps{Tenants: newFakeTenants(), Sensors: newFakeSensors(), RBAC: newFakeRBAC()})
}

func req(t *testing.T, h http.Handler, method, path string, body any, role rbac.Role) *httptest.ResponseRecorder {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	r := httptest.NewRequest(method, path, &buf)
	if role != "" {
		r.Header.Set("X-Will-Role", string(role))
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func TestHealthz(t *testing.T) {
	w := req(t, handler(), http.MethodGet, "/healthz", nil, "")
	if w.Code != http.StatusOK {
		t.Fatalf("status=%d", w.Code)
	}
}

func TestRBACForbidsViewerOnTenantUpdate(t *testing.T) {
	tenants := newFakeTenants()
	tenants.tenants["t1"] = store.Tenant{ID: "t1", Slug: "t1", DisplayName: "old"}
	h := New(Deps{Tenants: tenants, Sensors: newFakeSensors(), RBAC: newFakeRBAC()})
	dn := "new"
	w := req(t, h, http.MethodPatch, "/v1/tenants/t1", store.UpdateInput{DisplayName: &dn}, rbac.RoleViewer)
	if w.Code != http.StatusForbidden {
		t.Fatalf("status=%d", w.Code)
	}
}

func TestRBACAllowsAdminOnTenantUpdate(t *testing.T) {
	tenants := newFakeTenants()
	tenants.tenants["t1"] = store.Tenant{ID: "t1", Slug: "t1", DisplayName: "old"}
	h := New(Deps{Tenants: tenants, Sensors: newFakeSensors(), RBAC: newFakeRBAC()})
	dn := "new"
	w := req(t, h, http.MethodPatch, "/v1/tenants/t1", store.UpdateInput{DisplayName: &dn}, rbac.RoleAdmin)
	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
}

func TestSensorsBulkRegister(t *testing.T) {
	h := handler()
	in := []sensors.RegisterInput{
		{ExternalID: "node-001", Family: sensors.FamilyLora, DisplayName: "Cincu N1"},
		{ExternalID: "node-002", Family: sensors.FamilyLora, DisplayName: "Cincu N2"},
	}
	w := req(t, h, http.MethodPost, "/v1/tenants/t1/sensors", in, rbac.RoleAdmin)
	if w.Code != http.StatusCreated {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	var out []sensors.Sensor
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if len(out) != 2 {
		t.Fatalf("got %d sensors", len(out))
	}
}

func TestSensorsListForbidsViewerThenAllowsOperator(t *testing.T) {
	h := handler()
	w := req(t, h, http.MethodGet, "/v1/tenants/t1/sensors", nil, rbac.RoleViewer)
	if w.Code != http.StatusForbidden {
		t.Fatalf("viewer status=%d", w.Code)
	}
	w = req(t, h, http.MethodGet, "/v1/tenants/t1/sensors", nil, rbac.RoleOperator)
	if w.Code != http.StatusOK {
		t.Fatalf("operator status=%d", w.Code)
	}
}

func TestMembersGrant(t *testing.T) {
	h := handler()
	w := req(t, h, http.MethodPost, "/v1/tenants/t1/members",
		map[string]any{"user_id": "u1", "role": "operator"}, rbac.RoleAdmin)
	if w.Code != http.StatusCreated {
		t.Fatalf("status=%d", w.Code)
	}
}

func TestUnknownEndpoint(t *testing.T) {
	w := req(t, handler(), http.MethodGet, "/v1/tenants/t1/unknown", nil, rbac.RoleAdmin)
	if w.Code != http.StatusNotFound {
		t.Fatalf("status=%d", w.Code)
	}
}

// Ensure ErrForbidden is exposed for callers that wrap it.
func TestErrForbiddenIsUsable(t *testing.T) {
	if !errors.Is(rbac.ErrForbidden, rbac.ErrForbidden) {
		t.Fatal("ErrForbidden should be usable with errors.Is")
	}
}
