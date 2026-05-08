package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGetOrCreateIsIdempotent(t *testing.T) {
	s := NewStore()
	a, err := s.GetOrCreate("t1")
	if err != nil {
		t.Fatal(err)
	}
	b, err := s.GetOrCreate("t1")
	if err != nil {
		t.Fatal(err)
	}
	if a.MaterialB64 != b.MaterialB64 {
		t.Fatal("expected idempotent key material on repeated GetOrCreate")
	}
	if a.Version != 1 {
		t.Fatalf("expected version 1, got %d", a.Version)
	}
}

func TestRotateIncrementsVersion(t *testing.T) {
	s := NewStore()
	if _, err := s.GetOrCreate("t1"); err != nil {
		t.Fatal(err)
	}
	r, err := s.Rotate("t1")
	if err != nil {
		t.Fatal(err)
	}
	if r.Version != 2 {
		t.Fatalf("rotated version=%d", r.Version)
	}
}

func TestRotateUnknown(t *testing.T) {
	s := NewStore()
	if _, err := s.Rotate("nope"); err == nil {
		t.Fatal("expected error rotating unknown tenant")
	}
}

func TestHTTPGet(t *testing.T) {
	h := New(NewStore())
	r := httptest.NewRequest(http.MethodGet, "/v1/keys/tenant-x", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	var k Key
	if err := json.Unmarshal(w.Body.Bytes(), &k); err != nil {
		t.Fatal(err)
	}
	if k.TenantID != "tenant-x" {
		t.Fatalf("tenant=%s", k.TenantID)
	}
}

func TestHTTPRotate(t *testing.T) {
	store := NewStore()
	if _, err := store.GetOrCreate("t1"); err != nil {
		t.Fatal(err)
	}
	h := New(store)
	r := httptest.NewRequest(http.MethodPost, "/v1/keys/t1/rotate", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("status=%d", w.Code)
	}
}

func TestHTTPNotFound(t *testing.T) {
	h := New(NewStore())
	r := httptest.NewRequest(http.MethodGet, "/v1/keys/", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != http.StatusNotFound {
		t.Fatalf("status=%d", w.Code)
	}
}
