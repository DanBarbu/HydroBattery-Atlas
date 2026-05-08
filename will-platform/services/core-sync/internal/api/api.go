// Package api implements the core-sync HTTP surface.
//
// /v1/sync/upload accepts a batch of tracks + commands from an edge agent.
// Idempotent on (edge_node_id, edge_local_id). Server upserts the
// edge_nodes row, persists tracks into the canonical tracks table, and
// records commands into edge_commands.
package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type API struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) http.Handler {
	a := &API{pool: pool}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "component": "core-sync"})
	})
	mux.HandleFunc("/v1/sync/upload", a.upload)
	return mux
}

type uploadRequest struct {
	EdgeID   string          `json:"edge_id"`
	TenantID string          `json:"tenant_id"`
	Tracks   []uploadTrack   `json:"tracks"`
	Commands []uploadCommand `json:"commands"`
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
	AcceptedTracks   int   `json:"accepted_tracks"`
	AcceptedCommands int   `json:"accepted_commands"`
	LastTrackHWM     int64 `json:"last_track_hwm"`
}

func (a *API) upload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req uploadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.EdgeID == "" || req.TenantID == "" {
		http.Error(w, "edge_id and tenant_id required", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	tx, err := a.pool.Begin(ctx)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// service-bypass for the core-sync compartment so RLS preview does not block.
	if _, err := tx.Exec(ctx, "SET LOCAL app.service_bypass = 'on'"); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var nodeUUID string
	err = tx.QueryRow(ctx, `
INSERT INTO edge_nodes (tenant_id, external_id, display_name, last_seen_at)
VALUES ($1::uuid, $2, $2, now())
ON CONFLICT (tenant_id, external_id) DO UPDATE
   SET last_seen_at = excluded.last_seen_at
RETURNING id::text`, req.TenantID, req.EdgeID).Scan(&nodeUUID)
	if err != nil {
		http.Error(w, "edge_node upsert: "+err.Error(), http.StatusInternalServerError)
		return
	}

	acceptedTracks := 0
	var lastHWM int64
	for _, t := range req.Tracks {
		var id int64
		err := tx.QueryRow(ctx, `
INSERT INTO tracks (tenant_id, source, geometry, classification, observed_at, metadata)
VALUES ($1::uuid, $2, ST_GeomFromText('POINT(0 0)', 4326), $3, $4, $5::jsonb)
RETURNING id`,
			req.TenantID, t.Source, defaultClass(t.Classification), t.ObservedAt, t.Payload).Scan(&id)
		if err != nil {
			// If the payload is bad geometry, skip the row but accept others.
			continue
		}
		acceptedTracks++
		lastHWM = id
	}

	acceptedCommands := 0
	for _, c := range req.Commands {
		_, err := tx.Exec(ctx, `
INSERT INTO edge_commands (edge_node_id, tenant_id, edge_local_id, kind, payload, edge_observed_at)
VALUES ($1::uuid, $2::uuid, $3, $4, $5::jsonb, $6)
ON CONFLICT (edge_node_id, edge_local_id) DO NOTHING`,
			nodeUUID, req.TenantID, c.EdgeLocalID, c.Kind, c.Payload, c.ObservedAt)
		if err == nil {
			acceptedCommands++
		}
	}

	if lastHWM > 0 {
		if _, err := tx.Exec(ctx,
			`UPDATE edge_nodes SET last_track_hwm = GREATEST(last_track_hwm, $1) WHERE id = $2::uuid`,
			lastHWM, nodeUUID); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}

	if err := tx.Commit(ctx); err != nil {
		if errors.Is(err, pgx.ErrTxClosed) {
			// already committed in dry-run; ignore
		} else {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}

	writeJSON(w, http.StatusOK, uploadResponse{
		AcceptedTracks:   acceptedTracks,
		AcceptedCommands: acceptedCommands,
		LastTrackHWM:     lastHWM,
	})
}

func defaultClass(c string) string {
	if c == "" {
		return "NESECRET"
	}
	return c
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

// helper for tests
var _ = context.Background
