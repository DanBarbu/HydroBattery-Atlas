// metoc — METOC advisory service. ADR-015.
// Ingests weather observations/forecasts + ocean/wind flow fields and answers
// operational-impact (GO/CAUTION/NO_GO) and Lagrangian parcel-drift questions.
// Advisory only: no tasking, no launch, no command, no sensor write-back.
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/will-platform/metoc/internal/api"
	"github.com/will-platform/metoc/internal/store"
)

func main() {
	addr := envOr("HTTP_ADDR", ":8090")
	srv := &http.Server{
		Addr:              addr,
		Handler:           api.New(store.New()),
		ReadHeaderTimeout: 5 * time.Second,
	}
	go func() {
		log.Printf("[metoc] http listening on %s (advisory only, ADR-015)", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[metoc] http: %v", err)
		}
	}()
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
	log.Println("[metoc] shutting down")
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
