// Package auth is the Sprint 5 interface skeleton for ADR-007.
//
// The real OIDC binder lands in Sprint 6; the NPKI binder lands in Sprint 10.
// Both implement the Binder interface defined here so the call sites in
// the api package never change.
package auth

import (
	"context"
	"errors"

	"github.com/will-platform/tenant-admin/internal/rbac"
)

// Identity is what a Binder produces from a request.
type Identity struct {
	UserID string
	Role   rbac.Role
	Tenant string
	Method string // "oidc" | "npki" | "header" (Sprint 4 default)
}

// Binder authenticates a request and returns the bound Identity. The
// concrete implementation (header reader for Sprint 4, OIDC for Sprint 6,
// NPKI for Sprint 10) is selected at startup time per deployment profile.
type Binder interface {
	Bind(ctx context.Context, hdr Headers) (Identity, error)
}

// Headers is the minimal interface a Binder needs from the inbound HTTP
// request. Pass `r.Header.Get` and friends as a small adapter from the api
// layer; this keeps the package importable without net/http coupling so
// that NPKI (which terminates in PKCS#11) can implement it without
// pretending to be an HTTP middleware.
type Headers interface {
	Get(name string) string
}

// HeaderBinder is the Sprint 4 default: read X-Will-Role and X-Will-User
// directly. Used until ADR-007 OIDC ships in Sprint 6.
type HeaderBinder struct{}

func (HeaderBinder) Bind(_ context.Context, h Headers) (Identity, error) {
	role := rbac.Role(h.Get("X-Will-Role"))
	if !role.Valid() {
		return Identity{}, ErrUnauthenticated
	}
	return Identity{
		UserID: h.Get("X-Will-User"),
		Role:   role,
		Tenant: h.Get("X-Will-Tenant"),
		Method: "header",
	}, nil
}

var ErrUnauthenticated = errors.New("auth: unauthenticated")
