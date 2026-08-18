// trainer — war-games training service. ADR-013. EXERCISE-isolated:
// no route injects into the live BMS/BFT/fires/ownship pipeline.
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/will-platform/trainer/internal/api"
	"github.com/will-platform/trainer/internal/store"
)

func main() {
	addr := envOr("HTTP_ADDR", ":8088")
	srv := &http.Server{
		Addr:              addr,
		Handler:           api.New(store.New()),
		ReadHeaderTimeout: 5 * time.Second,
	}
	go func() {
		log.Printf("[trainer] http listening on %s (exercise-isolated, ADR-013)", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[trainer] http: %v", err)
		}
	}()
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
	log.Println("[trainer] shutting down")
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
