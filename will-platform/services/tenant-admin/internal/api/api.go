// Package api exposes a small HTTP surface for the tenant-admin service.
// CORS is permissive in dev; production deployments restrict it via the
// gateway in front of this service.
package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/will-platform/tenant-admin/internal/store"
)

// Service is the abstraction over the persistence layer that the HTTP layer
// requires. It is satisfied by *store.Store and by the fakes in api_test.
type Service interface {
	List(ctx context.Context) ([]store.Tenant, error)
	Get(ctx context.Context, id string) (store.Tenant, error)
	Create(ctx context.Context, in store.CreateInput) (store.Tenant, error)
	Update(ctx context.Context, id string, in store.UpdateInput) (store.Tenant, error)
}

func New(svc Service) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{
			"status":    "ok",
			"component": "tenant-admin",
		})
	})

	mux.HandleFunc("/v1/tenants", func(w http.ResponseWriter, r *http.Request) {
		setCORS(w)
		switch r.Method {
		case http.MethodGet:
			list, err := svc.List(r.Context())
			if err != nil {
				writeError(w, http.StatusInternalServerError, err)
				return
			}
			writeJSON(w, http.StatusOK, list)
		case http.MethodPost:
			var in store.CreateInput
			if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
				writeError(w, http.StatusBadRequest, err)
				return
			}
			t, err := svc.Create(r.Context(), in)
			if err != nil {
				writeError(w, http.StatusBadRequest, err)
				return
			}
			writeJSON(w, http.StatusCreated, t)
		case http.MethodOptions:
			w.WriteHeader(http.StatusNoContent)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	mux.HandleFunc("/v1/tenants/", func(w http.ResponseWriter, r *http.Request) {
		setCORS(w)
		id := strings.TrimPrefix(r.URL.Path, "/v1/tenants/")
		if id == "" {
			http.NotFound(w, r)
			return
		}
		switch r.Method {
		case http.MethodGet:
			t, err := svc.Get(r.Context(), id)
			if errors.Is(err, store.ErrNotFound) {
				http.NotFound(w, r)
				return
			}
			if err != nil {
				writeError(w, http.StatusInternalServerError, err)
				return
			}
			writeJSON(w, http.StatusOK, t)
		case http.MethodPatch, http.MethodPut:
			var in store.UpdateInput
			if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
				writeError(w, http.StatusBadRequest, err)
				return
			}
			t, err := svc.Update(r.Context(), id, in)
			if errors.Is(err, store.ErrNotFound) {
				http.NotFound(w, r)
				return
			}
			if err != nil {
				writeError(w, http.StatusBadRequest, err)
				return
			}
			writeJSON(w, http.StatusOK, t)
		case http.MethodOptions:
			w.WriteHeader(http.StatusNoContent)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	return mux
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]string{"error": err.Error()})
}

func setCORS(w http.ResponseWriter) {
	w.Header().Set("access-control-allow-origin", "*")
	w.Header().Set("access-control-allow-methods", "GET,POST,PATCH,PUT,OPTIONS")
	w.Header().Set("access-control-allow-headers", "content-type")
}
