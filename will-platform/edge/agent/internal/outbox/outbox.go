// Package outbox is a thin policy layer over cache.OutboxEntry. It encodes
// the Sprint 5 conflict-resolution policy: last-writer-wins by edge-observed
// timestamp; ties broken by the higher edge_local_id (which is monotonic per
// edge).
//
// docs/edge/conflict-resolution.md is the user-facing description.
package outbox

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/will-platform/edge/agent/internal/cache"
)

type Cache interface {
	Enqueue(ctx context.Context, e cache.OutboxEntry) (int64, error)
	Pending(ctx context.Context, limit int) ([]cache.OutboxEntry, error)
	MarkSent(ctx context.Context, id int64, when time.Time) error
}

// Command is the public domain shape; the cache stores it as JSON in payload.
type Command struct {
	Kind        string         `json:"kind"`        // promote-affiliation | mark-stale | …
	TargetID    string         `json:"target_id"`   // track or sensor id
	Payload     map[string]any `json:"payload"`     // kind-specific
	ObservedAt  time.Time      `json:"observed_at"` // time the operator issued it
}

func (c Command) Validate() error {
	if c.Kind == "" {
		return errors.New("command: kind required")
	}
	if c.TargetID == "" {
		return errors.New("command: target_id required")
	}
	if c.ObservedAt.IsZero() {
		return errors.New("command: observed_at required")
	}
	return nil
}

type Outbox struct {
	cache Cache
}

func New(c Cache) *Outbox { return &Outbox{cache: c} }

func (o *Outbox) Enqueue(ctx context.Context, cmd Command) (int64, error) {
	if err := cmd.Validate(); err != nil {
		return 0, err
	}
	body, err := json.Marshal(cmd)
	if err != nil {
		return 0, fmt.Errorf("marshal: %w", err)
	}
	return o.cache.Enqueue(ctx, cache.OutboxEntry{
		Kind:       cmd.Kind,
		Payload:    string(body),
		ObservedAt: cmd.ObservedAt,
	})
}

// Resolve applies the conflict-resolution policy when two commands target
// the same TargetID and Kind. last-writer-wins by ObservedAt; ties broken
// by the larger edge-local id (the second argument).
func Resolve(a, b Command, aLocalID, bLocalID int64) (winner Command, winnerLocal int64) {
	switch {
	case a.ObservedAt.After(b.ObservedAt):
		return a, aLocalID
	case b.ObservedAt.After(a.ObservedAt):
		return b, bLocalID
	default:
		if aLocalID >= bLocalID {
			return a, aLocalID
		}
		return b, bLocalID
	}
}
