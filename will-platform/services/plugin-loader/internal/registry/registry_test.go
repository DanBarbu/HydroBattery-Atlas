package registry

import (
	"sync"
	"testing"
)

func TestUpsertAndList(t *testing.T) {
	r := New()
	r.Upsert(Entry{ID: "p1", Name: "p1"})
	r.Upsert(Entry{ID: "p2", Name: "p2"})
	if got := len(r.List()); got != 2 {
		t.Fatalf("expected 2 entries, got %d", got)
	}
}

func TestUpsertReplaces(t *testing.T) {
	r := New()
	r.Upsert(Entry{ID: "p1", Name: "old"})
	r.Upsert(Entry{ID: "p1", Name: "new"})
	if got := len(r.List()); got != 1 {
		t.Fatalf("expected 1 entry after replace, got %d", got)
	}
	if r.List()[0].Name != "new" {
		t.Fatalf("expected name=new, got %s", r.List()[0].Name)
	}
}

func TestTouchUnknown(t *testing.T) {
	r := New()
	if r.Touch("nope", StatusServing, 0) {
		t.Fatal("expected Touch on unknown id to return false")
	}
}

func TestTouchUpdatesStatus(t *testing.T) {
	r := New()
	r.Upsert(Entry{ID: "p1"})
	if !r.Touch("p1", StatusDegraded, 42) {
		t.Fatal("expected Touch to return true")
	}
	got := r.List()[0]
	if got.Status != "DEGRADED" || got.LatencyMs != 42 {
		t.Fatalf("got %+v", got)
	}
}

func TestRemove(t *testing.T) {
	r := New()
	r.Upsert(Entry{ID: "p1"})
	r.Remove("p1")
	if got := len(r.List()); got != 0 {
		t.Fatalf("expected 0 entries, got %d", got)
	}
}

func TestConcurrentAccess(t *testing.T) {
	r := New()
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			r.Upsert(Entry{ID: "p"})
			r.Touch("p", StatusServing, int64(i))
			_ = r.List()
		}(i)
	}
	wg.Wait()
}
