// Package api implements the Sprint 4 KMS stub.
//
// One key per tenant. Random 32-byte material on first call; in-memory
// only — Vault wiring with HSM-backed unsealing arrives in Sprint 10.
// The API surface here matches what the production Vault wrapper will
// expose so callers (tenant-admin, plugin-loader) do not need to change.
package api

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

type Key struct {
	TenantID    string    `json:"tenant_id"`
	Version     int       `json:"version"`
	MaterialB64 string    `json:"material_b64"`
	CreatedAt   time.Time `json:"created_at"`
}

type Store struct {
	mu   sync.Mutex
	keys map[string]Key
}

func NewStore() *Store {
	return &Store{keys: map[string]Key{}}
}

func (s *Store) GetOrCreate(tenantID string) (Key, error) {
	if tenantID == "" {
		return Key{}, errors.New("tenant_id required")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if k, ok := s.keys[tenantID]; ok {
		return k, nil
	}
	mat := make([]byte, 32)
	if _, err := rand.Read(mat); err != nil {
		return Key{}, fmt.Errorf("rand: %w", err)
	}
	k := Key{
		TenantID:    tenantID,
		Version:     1,
		MaterialB64: base64.StdEncoding.EncodeToString(mat),
		CreatedAt:   time.Now().UTC(),
	}
	s.keys[tenantID] = k
	return k, nil
}

func (s *Store) Rotate(tenantID string) (Key, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	prev, ok := s.keys[tenantID]
	if !ok {
		return Key{}, errors.New("no key to rotate")
	}
	mat := make([]byte, 32)
	if _, err := rand.Read(mat); err != nil {
		return Key{}, fmt.Errorf("rand: %w", err)
	}
	next := Key{
		TenantID:    tenantID,
		Version:     prev.Version + 1,
		MaterialB64: base64.StdEncoding.EncodeToString(mat),
		CreatedAt:   time.Now().UTC(),
	}
	s.keys[tenantID] = next
	return next, nil
}

func New(s *Store) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "component": "kms-stub"})
	})

	mux.HandleFunc("/v1/keys/", func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/v1/keys/")
		parts := strings.Split(path, "/")
		tenantID := parts[0]
		if tenantID == "" {
			http.NotFound(w, r)
			return
		}
		switch {
		case len(parts) == 1 && r.Method == http.MethodGet:
			k, err := s.GetOrCreate(tenantID)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, k)
		case len(parts) == 2 && parts[1] == "rotate" && r.Method == http.MethodPost:
			k, err := s.Rotate(tenantID)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, k)
		default:
			http.Error(w, "not found", http.StatusNotFound)
		}
	})

	return mux
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
