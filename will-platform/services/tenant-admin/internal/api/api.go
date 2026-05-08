// Package api exposes the tenant-admin HTTP surface.
//
// Sprint 2 shipped tenant CRUD. Sprint 4 adds: sensor registry routes
// (S4-02), RBAC routes (S4-03), and a header-driven authorisation
// middleware (X-Will-User / X-Will-Role) — replaced by NPKI / OIDC at
// the gateway in Sprint 10.
//
// CORS is permissive in dev; production deployments restrict it via the
// gateway in front of this service.
package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/will-platform/tenant-admin/internal/rbac"
	"github.com/will-platform/tenant-admin/internal/sensors"
	"github.com/will-platform/tenant-admin/internal/store"
)

type Service interface {
	List(ctx context.Context) ([]store.Tenant, error)
	Get(ctx context.Context, id string) (store.Tenant, error)
	Create(ctx context.Context, in store.CreateInput) (store.Tenant, error)
	Update(ctx context.Context, id string, in store.UpdateInput) (store.Tenant, error)
}

type SensorService interface {
	ListByTenant(ctx context.Context, tenantID string) ([]sensors.Sensor, error)
	BulkRegister(ctx context.Context, tenantID string, in []sensors.RegisterInput) ([]sensors.Sensor, error)
}

type RBACService interface {
	MembershipsByTenant(ctx context.Context, tenantID string) ([]rbac.Membership, error)
	Grant(ctx context.Context, userID, tenantID string, role rbac.Role, grantedBy string) error
	Revoke(ctx context.Context, userID, tenantID string, role rbac.Role) error
}

type Deps struct {
	Tenants Service
	Sensors SensorService
	RBAC    RBACService
}

// authorise reads X-Will-Role and X-Will-User from the request and applies
// the in-process RBAC policy. Sprint 10 replaces this with NPKI / OIDC at
// the gateway and a richer middleware here.
func authorise(action rbac.Action) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role := rbac.Role(r.Header.Get("X-Will-Role"))
			if role == "" {
				role = rbac.RoleAdmin // dev convenience; lock down in prod
			}
			if err := rbac.Allow(role, action); err != nil {
				writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func New(d Deps) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "component": "tenant-admin"})
	})

	mux.Handle("/v1/tenants", authorise(rbac.ActionListTenants)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		setCORS(w)
		switch r.Method {
		case http.MethodGet:
			list, err := d.Tenants.List(r.Context())
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
			t, err := d.Tenants.Create(r.Context(), in)
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
	})))

	mux.HandleFunc("/v1/tenants/", func(w http.ResponseWriter, r *http.Request) {
		setCORS(w)
		path := strings.TrimPrefix(r.URL.Path, "/v1/tenants/")
		parts := strings.Split(path, "/")
		if parts[0] == "" {
			http.NotFound(w, r)
			return
		}
		tenantID := parts[0]

		// Sub-routes (sensors, members) — Sprint 4.
		if len(parts) >= 2 {
			switch parts[1] {
			case "sensors":
				handleSensors(w, r, d, tenantID)
				return
			case "members":
				handleMembers(w, r, d, tenantID)
				return
			}
			http.NotFound(w, r)
			return
		}

		// Single-tenant CRUD (Sprint 2 surface).
		switch r.Method {
		case http.MethodGet:
			authorise(rbac.ActionListTenants)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				t, err := d.Tenants.Get(r.Context(), tenantID)
				if errors.Is(err, store.ErrNotFound) {
					http.NotFound(w, r)
					return
				}
				if err != nil {
					writeError(w, http.StatusInternalServerError, err)
					return
				}
				writeJSON(w, http.StatusOK, t)
			})).ServeHTTP(w, r)
		case http.MethodPatch, http.MethodPut:
			authorise(rbac.ActionUpdateTenant)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				var in store.UpdateInput
				if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
					writeError(w, http.StatusBadRequest, err)
					return
				}
				t, err := d.Tenants.Update(r.Context(), tenantID, in)
				if errors.Is(err, store.ErrNotFound) {
					http.NotFound(w, r)
					return
				}
				if err != nil {
					writeError(w, http.StatusBadRequest, err)
					return
				}
				writeJSON(w, http.StatusOK, t)
			})).ServeHTTP(w, r)
		case http.MethodOptions:
			w.WriteHeader(http.StatusNoContent)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	return mux
}

func handleSensors(w http.ResponseWriter, r *http.Request, d Deps, tenantID string) {
	switch r.Method {
	case http.MethodGet:
		authorise(rbac.ActionListSensors)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			list, err := d.Sensors.ListByTenant(r.Context(), tenantID)
			if err != nil {
				writeError(w, http.StatusInternalServerError, err)
				return
			}
			writeJSON(w, http.StatusOK, list)
		})).ServeHTTP(w, r)
	case http.MethodPost:
		authorise(rbac.ActionRegisterSensor)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var in []sensors.RegisterInput
			if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
				writeError(w, http.StatusBadRequest, err)
				return
			}
			out, err := d.Sensors.BulkRegister(r.Context(), tenantID, in)
			if err != nil {
				writeError(w, http.StatusBadRequest, err)
				return
			}
			writeJSON(w, http.StatusCreated, out)
		})).ServeHTTP(w, r)
	case http.MethodOptions:
		w.WriteHeader(http.StatusNoContent)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func handleMembers(w http.ResponseWriter, r *http.Request, d Deps, tenantID string) {
	switch r.Method {
	case http.MethodGet:
		authorise(rbac.ActionListTenants)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			list, err := d.RBAC.MembershipsByTenant(r.Context(), tenantID)
			if err != nil {
				writeError(w, http.StatusInternalServerError, err)
				return
			}
			writeJSON(w, http.StatusOK, list)
		})).ServeHTTP(w, r)
	case http.MethodPost:
		authorise(rbac.ActionUpdateTenant)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var in struct {
				UserID    string    `json:"user_id"`
				Role      rbac.Role `json:"role"`
				GrantedBy string    `json:"granted_by,omitempty"`
			}
			if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
				writeError(w, http.StatusBadRequest, err)
				return
			}
			if err := d.RBAC.Grant(r.Context(), in.UserID, tenantID, in.Role, in.GrantedBy); err != nil {
				writeError(w, http.StatusBadRequest, err)
				return
			}
			writeJSON(w, http.StatusCreated, map[string]string{"status": "granted"})
		})).ServeHTTP(w, r)
	case http.MethodDelete:
		authorise(rbac.ActionUpdateTenant)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var in struct {
				UserID string    `json:"user_id"`
				Role   rbac.Role `json:"role"`
			}
			if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
				writeError(w, http.StatusBadRequest, err)
				return
			}
			if err := d.RBAC.Revoke(r.Context(), in.UserID, tenantID, in.Role); err != nil {
				writeError(w, http.StatusBadRequest, err)
				return
			}
			writeJSON(w, http.StatusOK, map[string]string{"status": "revoked"})
		})).ServeHTTP(w, r)
	case http.MethodOptions:
		w.WriteHeader(http.StatusNoContent)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
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
	w.Header().Set("access-control-allow-methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS")
	w.Header().Set("access-control-allow-headers", "content-type,x-will-role,x-will-user")
}
