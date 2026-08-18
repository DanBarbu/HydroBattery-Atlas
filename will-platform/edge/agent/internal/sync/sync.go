// Package sync drains the edge cache outbox and pushes unpushed tracks to
// the core-sync HTTP API. Failures are tolerated: the next iteration retries.
//
// Sprint 5 design notes:
//   - At-least-once delivery. Server is idempotent on (edge_node_id, edge_local_id).
//   - Batch up to BatchSize tracks/commands per iteration; small enough for HF/SATCOM.
//   - On error, sleep RetryAfter and retry. No exponential backoff in Sprint 5;
//     edge engineers requested deterministic timing for field tests.
package sync

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/will-platform/edge/agent/internal/cache"
)

type Cache interface {
	UnpushedTracks(ctx context.Context, limit int) ([]cache.Track, error)
	MarkTracksPushed(ctx context.Context, lastID int64) error
	Pending(ctx context.Context, limit int) ([]cache.OutboxEntry, error)
	MarkSent(ctx context.Context, id int64, when time.Time) error
}

type Config struct {
	CoreURL    string        // e.g., http://core-sync:8083
	EdgeID     string        // e.g., "br2vm-edge-01"
	TenantID   string        // tenant UUID
	BatchSize  int
	Interval   time.Duration
	RetryAfter time.Duration
	HTTPClient *http.Client
}

func (c *Config) defaults() {
	if c.BatchSize == 0 {
		c.BatchSize = 256
	}
	if c.Interval == 0 {
		c.Interval = 5 * time.Second
	}
	if c.RetryAfter == 0 {
		c.RetryAfter = 5 * time.Second
	}
	if c.HTTPClient == nil {
		c.HTTPClient = &http.Client{Timeout: 10 * time.Second}
	}
}

type Syncer struct {
	cfg   Config
	cache Cache
}

func New(cfg Config, c Cache) *Syncer {
	cfg.defaults()
	return &Syncer{cfg: cfg, cache: c}
}

type uploadRequest struct {
	EdgeID    string             `json:"edge_id"`
	TenantID  string             `json:"tenant_id"`
	Tracks    []uploadTrack      `json:"tracks,omitempty"`
	Commands  []uploadCommand    `json:"commands,omitempty"`
}

type uploadTrack struct {
	Source         string    `json:"source"`
	Payload        string    `json:"payload"`
	ObservedAt     time.Time `json:"observed_at"`
	Classification string    `json:"classification"`
}

type uploadCommand struct {
	EdgeLocalID int64     `json:"edge_local_id"`
	Kind        string    `json:"kind"`
	Payload     string    `json:"payload"`
	ObservedAt  time.Time `json:"observed_at"`
}

type uploadResponse struct {
	AcceptedTracks    int   `json:"accepted_tracks"`
	AcceptedCommands  int   `json:"accepted_commands"`
	LastTrackHWM      int64 `json:"last_track_hwm"`
}

// Run blocks until ctx is cancelled. Each iteration: collect a batch from the
// cache, push to the core, mark sent on success.
func (s *Syncer) Run(ctx context.Context) {
	t := time.NewTicker(s.cfg.Interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if err := s.iterate(ctx); err != nil {
				log.Printf("[edge-sync] %v; retry in %s", err, s.cfg.RetryAfter)
				select {
				case <-ctx.Done():
					return
				case <-time.After(s.cfg.RetryAfter):
				}
			}
		}
	}
}

func (s *Syncer) iterate(ctx context.Context) error {
	tracks, err := s.cache.UnpushedTracks(ctx, s.cfg.BatchSize)
	if err != nil {
		return fmt.Errorf("read tracks: %w", err)
	}
	cmds, err := s.cache.Pending(ctx, s.cfg.BatchSize)
	if err != nil {
		return fmt.Errorf("read commands: %w", err)
	}
	if len(tracks) == 0 && len(cmds) == 0 {
		return nil
	}

	req := uploadRequest{
		EdgeID:   s.cfg.EdgeID,
		TenantID: s.cfg.TenantID,
	}
	for _, t := range tracks {
		req.Tracks = append(req.Tracks, uploadTrack{
			Source: t.Source, Payload: t.Payload,
			ObservedAt: t.ObservedAt, Classification: t.Classification,
		})
	}
	for _, c := range cmds {
		req.Commands = append(req.Commands, uploadCommand{
			EdgeLocalID: c.ID, Kind: c.Kind, Payload: c.Payload, ObservedAt: c.ObservedAt,
		})
	}

	resp, err := s.post(ctx, req)
	if err != nil {
		return err
	}
	if len(tracks) > 0 {
		lastID := tracks[len(tracks)-1].ID
		if err := s.cache.MarkTracksPushed(ctx, lastID); err != nil {
			return fmt.Errorf("mark tracks pushed: %w", err)
		}
	}
	for _, c := range cmds {
		if err := s.cache.MarkSent(ctx, c.ID, time.Now().UTC()); err != nil {
			return fmt.Errorf("mark cmd sent %d: %w", c.ID, err)
		}
	}
	log.Printf("[edge-sync] flushed %d tracks, %d commands (server hwm=%d)",
		resp.AcceptedTracks, resp.AcceptedCommands, resp.LastTrackHWM)
	return nil
}

func (s *Syncer) post(ctx context.Context, req uploadRequest) (uploadResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return uploadResponse{}, err
	}
	url := s.cfg.CoreURL + "/v1/sync/upload"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return uploadResponse{}, err
	}
	httpReq.Header.Set("content-type", "application/json")
	res, err := s.cfg.HTTPClient.Do(httpReq)
	if err != nil {
		return uploadResponse{}, fmt.Errorf("post: %w", err)
	}
	defer func() { _ = res.Body.Close() }()
	if res.StatusCode/100 != 2 {
		buf, _ := io.ReadAll(res.Body)
		return uploadResponse{}, fmt.Errorf("server %d: %s", res.StatusCode, string(buf))
	}
	var out uploadResponse
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		return uploadResponse{}, fmt.Errorf("decode: %w", err)
	}
	return out, nil
}
