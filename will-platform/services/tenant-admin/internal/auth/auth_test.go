package auth

import (
	"context"
	"errors"
	"testing"

	"github.com/will-platform/tenant-admin/internal/rbac"
)

type stubHeaders map[string]string

func (s stubHeaders) Get(k string) string { return s[k] }

func TestHeaderBinderHappyPath(t *testing.T) {
	id, err := HeaderBinder{}.Bind(context.Background(), stubHeaders{
		"X-Will-Role":   "admin",
		"X-Will-User":   "u1",
		"X-Will-Tenant": "t1",
	})
	if err != nil {
		t.Fatal(err)
	}
	if id.Role != rbac.RoleAdmin || id.UserID != "u1" || id.Tenant != "t1" || id.Method != "header" {
		t.Fatalf("got %+v", id)
	}
}

func TestHeaderBinderRejectsBadRole(t *testing.T) {
	_, err := HeaderBinder{}.Bind(context.Background(), stubHeaders{"X-Will-Role": "nope"})
	if !errors.Is(err, ErrUnauthenticated) {
		t.Fatalf("got %v", err)
	}
}

func TestHeaderBinderRejectsMissingRole(t *testing.T) {
	_, err := HeaderBinder{}.Bind(context.Background(), stubHeaders{})
	if !errors.Is(err, ErrUnauthenticated) {
		t.Fatalf("got %v", err)
	}
}
