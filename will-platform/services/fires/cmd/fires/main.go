// fires — Fires Coordination Measure awareness service. ADR-012.
// READ-ONLY w.r.t. fires: ingest FSCM + fire-mission STATUS from the
// authoritative fires C2 for deconfliction. No tasking, no solutions.
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/will-platform/fires/internal/api"
	"github.com/will-platform/fires/internal/store"
)

func main() {
	addr := envOr("HTTP_ADDR", ":8087")
	srv := &http.Server{
		Addr:              addr,
		Handler:           api.New(store.New()),
		ReadHeaderTimeout: 5 * time.Second,
	}
	go func() {
		log.Printf("[fires] http listening on %s (read-only awareness, ADR-012)", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[fires] http: %v", err)
		}
	}()
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
	log.Println("[fires] shutting down")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
