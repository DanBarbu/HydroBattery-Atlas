// core-sync entrypoint. Sprint 5.
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/will-platform/core-sync/internal/api"
)

func main() {
	addr := envOr("HTTP_ADDR", ":8083")
	dsn := envOr("DATABASE_URL", "postgres://will:will-dev@postgres:5432/will?sslmode=disable")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		log.Fatalf("[core-sync] pgx: %v", err)
	}
	defer pool.Close()

	srv := &http.Server{
		Addr:              addr,
		Handler:           api.New(pool),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("[core-sync] http listening on %s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[core-sync] http: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
	log.Println("[core-sync] shutting down")
	shutdownCtx, sc := context.WithTimeout(context.Background(), 5*time.Second)
	defer sc()
	_ = srv.Shutdown(shutdownCtx)
}

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
