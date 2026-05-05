package store

import (
	"encoding/json"
	"testing"
)

// Sprint 2 carries pure-function tests; the database round-trip is exercised
// in the api package's integration test against a Testcontainers Postgres.

func TestJsonToMapEmpty(t *testing.T) {
	m := jsonToMap(nil)
	if len(m) != 0 {
		t.Fatalf("expected empty map, got %v", m)
	}
}

func TestJsonToMapValid(t *testing.T) {
	raw, _ := json.Marshal(map[string]any{"primaryColor": "#3273dc"})
	m := jsonToMap(raw)
	if m["primaryColor"] != "#3273dc" {
		t.Fatalf("expected primaryColor key, got %v", m)
	}
}

func TestJsonToMapInvalid(t *testing.T) {
	m := jsonToMap([]byte("not json"))
	if len(m) != 0 {
		t.Fatalf("expected empty map on invalid input, got %v", m)
	}
}

func TestOrEmpty(t *testing.T) {
	if got := orEmpty(nil); len(got) != 0 {
		t.Fatalf("nil should map to empty, got %v", got)
	}
	in := map[string]any{"k": 1}
	if got := orEmpty(in); got["k"] != 1 {
		t.Fatalf("non-nil should pass through, got %v", got)
	}
}
