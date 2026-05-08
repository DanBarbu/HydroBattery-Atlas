// edge-agent — Sprint 5.
//
// Runs on rugged hardware in a tactical edge cluster (K3s). Responsibilities:
//   - Append local plugin telemetry into an SQLite cache.
//   - Maintain the command outbox.
//   - Periodically sync to the core-sync service when reachable; queue when not.
//
// HTTP surface (lightweight; loadbearing for the admin UI on the edge):
//   GET  /healthz
//   GET  /v1/edge/status            — high-water-marks, pending counts
//   POST /v1/edge/tracks            — append a track (used by edge-side plugins)
//   POST /v1/edge/commands          — enqueue an operator command
package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/will-platform/edge/agent/internal/cache"
	"github.com/will-platform/edge/agent/internal/outbox"
	"github.com/will-platform/edge/agent/internal/sync"
)

func main() {
	addr := envOr("HTTP_ADDR", ":8090")
	cachePath := envOr("CACHE_PATH", "/var/lib/will-edge/cache.db")
	coreURL := envOr("CORE_SYNC_URL", "http://core-sync:8083")
	edgeID := envOr("EDGE_ID", "edge-default-01")
	tenantID := envOr("TENANT_ID", "00000000-0000-0000-0000-000000000001")

	if err := os.MkdirAll(filepath.Dir(cachePath), 0o755); err != nil {
		log.Fatalf("[edge-agent] mkdir cache dir: %v", err)
	}

	db, err := cache.Open(cachePath)
	if err != nil {
		log.Fatalf("[edge-agent] cache: %v", err)
	}
	defer func() { _ = db.Close() }()

	ob := outbox.New(db)

	syncer := sync.New(sync.Config{
		CoreURL: coreURL, EdgeID: edgeID, TenantID: tenantID,
		BatchSize: 256, Interval: 5 * time.Second, RetryAfter: 5 * time.Second,
	}, db)

	ctx, cancel := context.WithCancel(context.Background())
	go syncer.Run(ctx)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "component": "edge-agent", "edge_id": edgeID})
	})
	mux.HandleFunc("/v1/edge/status", func(w http.ResponseWriter, r *http.Request) {
		pending, _ := db.PendingCount(r.Context())
		unpushed, _ := db.UnpushedCount(r.Context())
		writeJSON(w, http.StatusOK, map[string]any{
			"edge_id":          edgeID,
			"tenant_id":        tenantID,
			"core_sync_url":    coreURL,
			"pending_commands": pending,
			"unpushed_tracks":  unpushed,
		})
	})
	mux.HandleFunc("/v1/edge/tracks", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var t cache.Track
		if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if t.ObservedAt.IsZero() {
			t.ObservedAt = time.Now().UTC()
		}
		if t.Classification == "" {
			t.Classification = "NESECRET"
		}
		id, err := db.AppendTrack(r.Context(), t)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"id": id})
	})
	mux.HandleFunc("/v1/edge/commands", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var c outbox.Command
		if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if c.ObservedAt.IsZero() {
			c.ObservedAt = time.Now().UTC()
		}
		id, err := ob.Enqueue(r.Context(), c)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"id": id})
	})

	srv := &http.Server{Addr: addr, Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		log.Printf("[edge-agent] http listening on %s; cache=%s; core=%s", addr, cachePath, coreURL)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[edge-agent] http: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
	log.Println("[edge-agent] shutting down")
	cancel()
	shutdownCtx, sc := context.WithTimeout(context.Background(), 5*time.Second)
	defer sc()
	_ = srv.Shutdown(shutdownCtx)
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
