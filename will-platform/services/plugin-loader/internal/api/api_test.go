package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/will-platform/plugin-loader/internal/registry"
)

func TestHealthz(t *testing.T) {
	h := New(registry.New())
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d", rec.Code)
	}
}

func TestListPlugins(t *testing.T) {
	reg := registry.New()
	reg.Upsert(registry.Entry{ID: "p1", Name: "atak-mil", Version: "0.1.0"})
	h := New(reg)

	req := httptest.NewRequest(http.MethodGet, "/v1/plugins", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d", rec.Code)
	}
	var out []registry.Entry
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(out) != 1 || out[0].Name != "atak-mil" {
		t.Fatalf("got %+v", out)
	}
}

func TestListPluginsRejectsPost(t *testing.T) {
	h := New(registry.New())
	req := httptest.NewRequest(http.MethodPost, "/v1/plugins", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status=%d", rec.Code)
	}
}
