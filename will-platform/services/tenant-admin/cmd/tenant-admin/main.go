// tenant-admin entrypoint. Sprint 4 wires Tenants + Sensors + RBAC.
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

	"github.com/will-platform/tenant-admin/internal/api"
	"github.com/will-platform/tenant-admin/internal/rbac"
	"github.com/will-platform/tenant-admin/internal/sensors"
	"github.com/will-platform/tenant-admin/internal/store"
)

func main() {
	addr := envOr("HTTP_ADDR", ":8081")
	dsn := envOr(
		"DATABASE_URL",
		"postgres://will:will-dev@postgres:5432/will?sslmode=disable",
	)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		log.Fatalf("[tenant-admin] pgx: %v", err)
	}
	defer pool.Close()

	// Sprint 4: tenant-admin runs with the service-bypass GUC so its own
	// reads can cross tenants. Application-layer enforcement still applies
	// (RBAC middleware in api.New). ADR-006 documents this exception.
	if _, err := pool.Exec(ctx, "SET app.service_bypass = 'on'"); err != nil {
		log.Printf("[tenant-admin] could not set service_bypass GUC (RLS preview not yet applied): %v", err)
	}

	deps := api.Deps{
		Tenants: store.New(pool),
		Sensors: sensors.NewStore(pool),
		RBAC:    rbac.NewStore(pool),
	}

	srv := &http.Server{
		Addr:              addr,
		Handler:           api.New(deps),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("[tenant-admin] http listening on %s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[tenant-admin] http: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
	log.Println("[tenant-admin] shutting down")
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
