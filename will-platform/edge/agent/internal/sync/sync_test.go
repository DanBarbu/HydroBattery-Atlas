package sync

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/will-platform/edge/agent/internal/cache"
)

type fakeCache struct {
	tracks       []cache.Track
	pending      []cache.OutboxEntry
	pushedUpTo   int64
	sentIDs      []int64
}

func (f *fakeCache) UnpushedTracks(_ context.Context, limit int) ([]cache.Track, error) {
	if limit > len(f.tracks) {
		limit = len(f.tracks)
	}
	return f.tracks[:limit], nil
}
func (f *fakeCache) MarkTracksPushed(_ context.Context, lastID int64) error {
	f.pushedUpTo = lastID
	for i := range f.tracks {
		if f.tracks[i].ID <= lastID {
			f.tracks[i].Pushed = true
		}
	}
	return nil
}
func (f *fakeCache) Pending(_ context.Context, limit int) ([]cache.OutboxEntry, error) {
	if limit > len(f.pending) {
		limit = len(f.pending)
	}
	return f.pending[:limit], nil
}
func (f *fakeCache) MarkSent(_ context.Context, id int64, _ time.Time) error {
	f.sentIDs = append(f.sentIDs, id)
	return nil
}

func TestIterateNoOpWhenEmpty(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		t.Fatal("server should not be called when there is nothing to sync")
	}))
	defer srv.Close()
	c := &fakeCache{}
	s := New(Config{CoreURL: srv.URL, EdgeID: "e1", TenantID: "t1"}, c)
	if err := s.iterate(context.Background()); err != nil {
		t.Fatal(err)
	}
}

func TestIterateUploadsAndMarks(t *testing.T) {
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		var req uploadRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatal(err)
		}
		if req.EdgeID != "e1" || req.TenantID != "t1" {
			t.Fatalf("bad header fields: %+v", req)
		}
		w.Header().Set("content-type", "application/json")
		_ = json.NewEncoder(w).Encode(uploadResponse{
			AcceptedTracks:   len(req.Tracks),
			AcceptedCommands: len(req.Commands),
			LastTrackHWM:     999,
		})
	}))
	defer srv.Close()

	c := &fakeCache{
		tracks: []cache.Track{
			{ID: 1, Source: "s1", Payload: "{}", ObservedAt: time.Now(), Classification: "NESECRET"},
			{ID: 2, Source: "s2", Payload: "{}", ObservedAt: time.Now(), Classification: "NESECRET"},
		},
		pending: []cache.OutboxEntry{
			{ID: 11, Kind: "promote", Payload: "{}", ObservedAt: time.Now()},
		},
	}
	s := New(Config{CoreURL: srv.URL, EdgeID: "e1", TenantID: "t1"}, c)
	if err := s.iterate(context.Background()); err != nil {
		t.Fatal(err)
	}
	if calls != 1 {
		t.Fatalf("expected 1 call, got %d", calls)
	}
	if c.pushedUpTo != 2 {
		t.Fatalf("expected mark up to 2, got %d", c.pushedUpTo)
	}
	if len(c.sentIDs) != 1 || c.sentIDs[0] != 11 {
		t.Fatalf("expected outbox 11 marked, got %v", c.sentIDs)
	}
}

func TestIterateBubblesServerError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "boom", http.StatusInternalServerError)
	}))
	defer srv.Close()
	c := &fakeCache{tracks: []cache.Track{{ID: 1, Source: "s1", Payload: "{}", ObservedAt: time.Now()}}}
	s := New(Config{CoreURL: srv.URL, EdgeID: "e1", TenantID: "t1"}, c)
	if err := s.iterate(context.Background()); err == nil {
		t.Fatal("expected error from 500")
	}
	if c.pushedUpTo != 0 {
		t.Fatalf("expected nothing marked pushed, got %d", c.pushedUpTo)
	}
}
