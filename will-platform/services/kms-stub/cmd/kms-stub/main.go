// kms-stub entrypoint. Sprint 4.
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/will-platform/kms-stub/internal/api"
)

func main() {
	addr := os.Getenv("HTTP_ADDR")
	if addr == "" {
		addr = ":8082"
	}

	srv := &http.Server{
		Addr:              addr,
		Handler:           api.New(api.NewStore()),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("[kms-stub] listening %s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[kms-stub] http: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
	log.Println("[kms-stub] shutting down")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}
