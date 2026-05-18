// ownship — Naval / Own-Ship integration service. ADR-011.
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/will-platform/ownship/internal/api"
	"github.com/will-platform/ownship/internal/store"
)

func main() {
	addr := envOr("HTTP_ADDR", ":8086")
	srv := &http.Server{
		Addr:              addr,
		Handler:           api.New(store.New()),
		ReadHeaderTimeout: 5 * time.Second,
	}
	go func() {
		log.Printf("[ownship] http listening on %s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[ownship] http: %v", err)
		}
	}()
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
	log.Println("[ownship] shutting down")
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
