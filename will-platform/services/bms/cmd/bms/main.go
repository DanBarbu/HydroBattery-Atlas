// bms — Battle Management Solution service. ADR-008.
//
// Sprint-5-shipped: the in-memory store is used by default so the demo
// compose stays self-contained. Set BMS_PERSIST=postgres to swap in the
// pgx-backed store once V0007 has run (a deployment-time flip).
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/will-platform/bms/internal/api"
	"github.com/will-platform/bms/internal/scoring"
)

func main() {
	addr := envOr("HTTP_ADDR", ":8084")

	// Default defended assets for the demo: Cincu HQ and the Constanța naval area.
	assets := []scoring.DefendedAsset{
		{Name: "Cincu HQ", Lat: 45.8696, Lon: 24.7753},
		{Name: "Constanța naval area", Lat: 44.1733, Lon: 28.6383},
	}

	store := api.NewMemoryStore()
	// Seed a Patriot battery + an NSM coastal launcher so the dashboard has
	// effectors at first boot. Real deployments register via /v1/effectors.
	_, _ = store.CreateEffector(context.Background(), api.Effector{
		TenantID:    "00000000-0000-0000-0000-000000000001",
		PluginID:    "sam-battery-mock",
		Kind:        "sam_area",
		DisplayName: "Patriot Bn 1",
		Lat:         45.87, Lon: 24.78,
		MinRangeM:   3_000, MaxRangeM: 80_000,
		MinAltitudeM: 50, MaxAltitudeM: 25_000,
		MaxTargetSpeed: 2_400, RoundsRemaining: 8, Status: "READY",
	})
	_, _ = store.CreateEffector(context.Background(), api.Effector{
		TenantID:    "00000000-0000-0000-0000-000000000001",
		PluginID:    "nsm-coastal-mock",
		Kind:        "nsm_coastal",
		DisplayName: "NSM Coastal Bty",
		Lat:         44.20, Lon: 28.65,
		MinRangeM:   3_000, MaxRangeM: 200_000,
		MinAltitudeM: -10, MaxAltitudeM: 5_000,
		MaxTargetSpeed: 700, RoundsRemaining: 4, Status: "READY",
	})

	srv := &http.Server{Addr: addr, Handler: api.New(store, assets), ReadHeaderTimeout: 5 * time.Second}
	go func() {
		log.Printf("[bms] http listening on %s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[bms] http: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
	log.Println("[bms] shutting down")
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
