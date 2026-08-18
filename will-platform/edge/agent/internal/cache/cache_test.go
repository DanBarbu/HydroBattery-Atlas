package cache

import (
	"context"
	"path/filepath"
	"testing"
	"time"
)

func newDB(t *testing.T) *DB {
	t.Helper()
	d, err := Open(filepath.Join(t.TempDir(), "cache.db"))
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { _ = d.Close() })
	return d
}

func TestAppendAndPushTracks(t *testing.T) {
	d := newDB(t)
	ctx := context.Background()
	for i := 0; i < 3; i++ {
		if _, err := d.AppendTrack(ctx, Track{Source: "s1", Payload: "{}", ObservedAt: time.Now()}); err != nil {
			t.Fatal(err)
		}
	}
	pending, err := d.UnpushedTracks(ctx, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(pending) != 3 {
		t.Fatalf("expected 3 pending, got %d", len(pending))
	}
	if err := d.MarkTracksPushed(ctx, pending[len(pending)-1].ID); err != nil {
		t.Fatal(err)
	}
	n, err := d.UnpushedCount(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("expected 0 unpushed after mark, got %d", n)
	}
}

func TestOutboxEnqueueAndDrain(t *testing.T) {
	d := newDB(t)
	ctx := context.Background()
	for i := 0; i < 5; i++ {
		if _, err := d.Enqueue(ctx, OutboxEntry{Kind: "promote", Payload: "{}", ObservedAt: time.Now()}); err != nil {
			t.Fatal(err)
		}
	}
	n, err := d.PendingCount(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if n != 5 {
		t.Fatalf("expected 5 pending, got %d", n)
	}
	entries, err := d.Pending(ctx, 100)
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range entries {
		if err := d.MarkSent(ctx, e.ID, time.Now()); err != nil {
			t.Fatal(err)
		}
	}
	n, _ = d.PendingCount(ctx)
	if n != 0 {
		t.Fatalf("expected 0 pending after drain, got %d", n)
	}
}

func TestOpenRejectsEmptyPath(t *testing.T) {
	if _, err := Open(""); err == nil {
		t.Fatal("expected error on empty path")
	}
}
