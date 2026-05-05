package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/will-platform/tenant-admin/internal/store"
)

type fake struct {
	tenants map[string]store.Tenant
	listErr error
	getErr  error
	createE error
	updateE error
}

func newFake() *fake { return &fake{tenants: map[string]store.Tenant{}} }

func (f *fake) List(_ context.Context) ([]store.Tenant, error) {
	if f.listErr != nil {
		return nil, f.listErr
	}
	out := make([]store.Tenant, 0, len(f.tenants))
	for _, t := range f.tenants {
		out = append(out, t)
	}
	return out, nil
}
func (f *fake) Get(_ context.Context, id string) (store.Tenant, error) {
	if f.getErr != nil {
		return store.Tenant{}, f.getErr
	}
	t, ok := f.tenants[id]
	if !ok {
		return store.Tenant{}, store.ErrNotFound
	}
	return t, nil
}
func (f *fake) Create(_ context.Context, in store.CreateInput) (store.Tenant, error) {
	if f.createE != nil {
		return store.Tenant{}, f.createE
	}
	t := store.Tenant{ID: in.Slug, Slug: in.Slug, DisplayName: in.DisplayName, Theme: in.Theme}
	f.tenants[t.ID] = t
	return t, nil
}
func (f *fake) Update(_ context.Context, id string, in store.UpdateInput) (store.Tenant, error) {
	if f.updateE != nil {
		return store.Tenant{}, f.updateE
	}
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

func req(t *testing.T, h http.Handler, method, path string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	r := httptest.NewRequest(method, path, &buf)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func TestHealthz(t *testing.T) {
	w := req(t, New(newFake()), http.MethodGet, "/healthz", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status=%d", w.Code)
	}
}

func TestListEmpty(t *testing.T) {
	w := req(t, New(newFake()), http.MethodGet, "/v1/tenants", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
}

func TestCreateAndGet(t *testing.T) {
	h := New(newFake())
	w := req(t, h, http.MethodPost, "/v1/tenants", store.CreateInput{
		Slug:        "br2vm",
		DisplayName: "Brigada 2 Vânători de Munte",
		Theme:       map[string]any{"primaryColor": "#0b6e4f"},
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create status=%d body=%s", w.Code, w.Body.String())
	}
	w = req(t, h, http.MethodGet, "/v1/tenants/br2vm", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("get status=%d", w.Code)
	}
	var got store.Tenant
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.DisplayName == "" {
		t.Fatalf("display_name not preserved: %+v", got)
	}
}

func TestGetMissing(t *testing.T) {
	w := req(t, New(newFake()), http.MethodGet, "/v1/tenants/does-not-exist", nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("status=%d", w.Code)
	}
}

func TestPatch(t *testing.T) {
	f := newFake()
	f.tenants["t1"] = store.Tenant{ID: "t1", Slug: "t1", DisplayName: "old"}
	h := New(f)
	dn := "new"
	w := req(t, h, http.MethodPatch, "/v1/tenants/t1", store.UpdateInput{DisplayName: &dn})
	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	if f.tenants["t1"].DisplayName != "new" {
		t.Fatalf("display_name not updated: %v", f.tenants["t1"])
	}
}

func TestCreateBadJSON(t *testing.T) {
	r := httptest.NewRequest(http.MethodPost, "/v1/tenants", bytes.NewReader([]byte("not json")))
	w := httptest.NewRecorder()
	New(newFake()).ServeHTTP(w, r)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status=%d", w.Code)
	}
}

func TestListErrorBubbles(t *testing.T) {
	f := newFake()
	f.listErr = errors.New("boom")
	w := req(t, New(f), http.MethodGet, "/v1/tenants", nil)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status=%d", w.Code)
	}
}

func TestMethodNotAllowed(t *testing.T) {
	w := req(t, New(newFake()), http.MethodDelete, "/v1/tenants", nil)
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status=%d", w.Code)
	}
}
