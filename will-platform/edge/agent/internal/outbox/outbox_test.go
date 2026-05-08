package outbox

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/will-platform/edge/agent/internal/cache"
)

type stubCache struct {
	enqueued []cache.OutboxEntry
	enqErr   error
}

func (s *stubCache) Enqueue(_ context.Context, e cache.OutboxEntry) (int64, error) {
	if s.enqErr != nil {
		return 0, s.enqErr
	}
	s.enqueued = append(s.enqueued, e)
	return int64(len(s.enqueued)), nil
}
func (s *stubCache) Pending(_ context.Context, _ int) ([]cache.OutboxEntry, error) {
	return s.enqueued, nil
}
func (s *stubCache) MarkSent(_ context.Context, _ int64, _ time.Time) error { return nil }

func TestEnqueueValidates(t *testing.T) {
	o := New(&stubCache{})
	if _, err := o.Enqueue(context.Background(), Command{}); err == nil {
		t.Fatal("expected validation error on empty Command")
	}
}

func TestEnqueueWritesJSON(t *testing.T) {
	c := &stubCache{}
	o := New(c)
	cmd := Command{
		Kind:       "promote-affiliation",
		TargetID:   "atak-mil/tablet-7",
		Payload:    map[string]any{"affiliation": "F"},
		ObservedAt: time.Now(),
	}
	id, err := o.Enqueue(context.Background(), cmd)
	if err != nil {
		t.Fatal(err)
	}
	if id != 1 {
		t.Fatalf("id=%d", id)
	}
	if len(c.enqueued) != 1 || c.enqueued[0].Kind != "promote-affiliation" {
		t.Fatalf("got %+v", c.enqueued)
	}
}

func TestEnqueueBubblesError(t *testing.T) {
	o := New(&stubCache{enqErr: errors.New("boom")})
	if _, err := o.Enqueue(context.Background(), Command{Kind: "x", TargetID: "y", ObservedAt: time.Now()}); err == nil {
		t.Fatal("expected enqueue error")
	}
}

func TestResolveByTimestamp(t *testing.T) {
	a := Command{Kind: "k", TargetID: "t", ObservedAt: time.Unix(100, 0)}
	b := Command{Kind: "k", TargetID: "t", ObservedAt: time.Unix(200, 0)}
	w, _ := Resolve(a, b, 1, 2)
	if !w.ObservedAt.Equal(b.ObservedAt) {
		t.Fatal("expected newer command to win")
	}
}

func TestResolveTieBreaksOnLocalID(t *testing.T) {
	now := time.Unix(100, 0)
	a := Command{Kind: "k", TargetID: "t", ObservedAt: now}
	b := Command{Kind: "k", TargetID: "t", ObservedAt: now}
	_, idA := Resolve(a, b, 5, 3)
	if idA != 5 {
		t.Fatalf("expected aLocalID=5 to win the tie, got %d", idA)
	}
	_, idB := Resolve(a, b, 1, 9)
	if idB != 9 {
		t.Fatalf("expected bLocalID=9 to win the tie, got %d", idB)
	}
}
