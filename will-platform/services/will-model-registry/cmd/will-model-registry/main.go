// will-model-registry — sovereign AI model registry service (ADR-020).
//
// Stores signed model artefacts, enforces classification-ceiling and
// foreign-origin routing on read, and holds the load-bearing "no foreign
// model in operational path" and "revoked stays revoked" invariants.
//
// Fail-closed posture:
//   - empty trust store => admission refuses every signed card
//   - unrecognised ceiling => 400 on artefact read
//   - marking above ceiling / foreign to OPERATIONAL / revoked => refused
//
// Signing key custody today is a filesystem trust-anchors JSON; the KMS
// / Vault path (ADR-007 successor) plugs in behind this same interface
// later without changing the API surface.
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/will-platform/will-model-registry/internal/api"
	"github.com/will-platform/will-model-registry/internal/store"
)

func main() {
	httpAddr := envOr("HTTP_ADDR", ":8093")
	dataDir := envOr("DATA_DIR", "/var/lib/will/model-registry")
	trustAnchorsPath := envOr("TRUST_ANCHORS", "/etc/will/model-registry/trust-anchors.json")

	anchors, err := store.LoadTrustAnchors(trustAnchorsPath)
	if err != nil {
		log.Fatalf("[will-model-registry] load trust anchors: %v", err)
	}
	if len(anchors) == 0 {
		log.Printf("[will-model-registry] WARNING: trust store is empty; admission will refuse every card (fail-closed)")
	} else {
		log.Printf("[will-model-registry] loaded %d trust anchor(s) from %s", len(anchors), trustAnchorsPath)
	}

	s, err := store.New(dataDir, anchors)
	if err != nil {
		log.Fatalf("[will-model-registry] init store: %v", err)
	}

	srv := &http.Server{
		Addr:              httpAddr,
		Handler:           api.New(s),
		ReadHeaderTimeout: 5 * time.Second,
	}
	go func() {
		log.Printf("[will-model-registry] http listening on %s (ADR-020, sovereign registry)", httpAddr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[will-model-registry] http: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
	log.Println("[will-model-registry] shutting down")
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
