// legacy-c2 — BC2A / ICIS interoperability bridge. ADR-014.
// Northbound: JC3IEDM / AdatP-3 -> canonical tracks (BC2A as a sensor
// source). Southbound: canonical -> MIL-STD-2525D + AdatP-3 (advisory,
// backwards-compat). WILL never writes BC2A's DB or commands BC2A.
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/will-platform/legacy-c2/internal/api"
	"github.com/will-platform/legacy-c2/internal/store"
)

func main() {
	addr := envOr("HTTP_ADDR", ":8089")
	srv := &http.Server{
		Addr:              addr,
		Handler:           api.New(store.New()),
		ReadHeaderTimeout: 5 * time.Second,
	}
	go func() {
		log.Printf("[legacy-c2] http listening on %s (BC2A/ICIS bridge, ADR-014)", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[legacy-c2] http: %v", err)
		}
	}()
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
	log.Println("[legacy-c2] shutting down")
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
