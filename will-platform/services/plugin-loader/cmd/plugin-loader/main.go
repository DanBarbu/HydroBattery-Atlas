// plugin-loader entrypoint.
//
// Reads a static config from env vars (Sprint 1) and dials each plugin's gRPC
// endpoint. Real gRPC dialer wiring lands when the generated stubs are
// available in the contracts module; for Sprint 1 this binary serves the
// Registry HTTP API and acts as the integration seam the loader package is
// already tested against.
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/will-platform/plugin-loader/internal/api"
	"github.com/will-platform/plugin-loader/internal/registry"
)

func main() {
	addr := envOr("HTTP_ADDR", ":8080")
	reg := registry.New()

	srv := &http.Server{
		Addr:              addr,
		Handler:           api.New(reg),
		ReadHeaderTimeout: 5 * time.Second,
	}

	// Sprint 1: pre-populate from PLUGIN_BOOTSTRAP env so the frontend has
	// something to show even before the gRPC dialer is wired.
	if name := os.Getenv("PLUGIN_BOOTSTRAP_NAME"); name != "" {
		reg.Upsert(registry.Entry{
			ID:              "bootstrap",
			Name:            name,
			Version:         envOr("PLUGIN_BOOTSTRAP_VERSION", "0.1.0"),
			Vendor:          envOr("PLUGIN_BOOTSTRAP_VENDOR", "WILL Romania"),
			ContractVersion: "v1.0",
			Capabilities:    []string{"sensor.track"},
			Description:     "Bootstrap plugin entry — replaced once gRPC dialer is wired.",
			Status:          "UNKNOWN",
			LastSeen:        time.Now().UTC(),
		})
	}

	go func() {
		log.Printf("[plugin-loader] http listening on %s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("http: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
	log.Println("[plugin-loader] shutting down")

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
