// bms — Battle Management Solution service. ADR-008.
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
	"github.com/will-platform/bms/internal/dal"
	"github.com/will-platform/bms/internal/scoring"
)

func main() {
	addr := envOr("HTTP_ADDR", ":8084")

	store := api.NewMemoryStore()
	dalStore := dal.NewMemoryStore()
	ctx := context.Background()

	// Demo seeds.
	_, _ = store.CreateEffector(ctx, api.Effector{
		TenantID: "00000000-0000-0000-0000-000000000001",
		PluginID: "sam-battery-mock", Kind: "sam_area", DisplayName: "Patriot Bn 1",
		Lat: 45.87, Lon: 24.78,
		MinRangeM: 3_000, MaxRangeM: 80_000, MinAltitudeM: 50, MaxAltitudeM: 25_000,
		MaxTargetSpeed: 2_400, RoundsRemaining: 8, Status: "READY",
	})
	_, _ = store.CreateEffector(ctx, api.Effector{
		TenantID: "00000000-0000-0000-0000-000000000001",
		PluginID: "nsm-coastal-mock", Kind: "nsm_coastal", DisplayName: "NSM Coastal Bty",
		Lat: 44.20, Lon: 28.65,
		MinRangeM: 3_000, MaxRangeM: 200_000, MinAltitudeM: -10, MaxAltitudeM: 5_000,
		MaxTargetSpeed: 700, RoundsRemaining: 4, Status: "READY",
	})
	_, _ = dalStore.UpsertAsset(ctx, dal.DefendedAsset{
		TenantID: "00000000-0000-0000-0000-000000000001",
		ExternalID: "cincu-hq", DisplayName: "Cincu HQ",
		Lat: 45.8696, Lon: 24.7753, Criticality: 5,
	})
	_, _ = dalStore.UpsertAsset(ctx, dal.DefendedAsset{
		TenantID: "00000000-0000-0000-0000-000000000001",
		ExternalID: "constanta-naval", DisplayName: "Constanța naval area",
		Lat: 44.1733, Lon: 28.6383, Criticality: 4,
	})

	srv := &http.Server{
		Addr: addr,
		Handler: api.New(api.Options{
			Store: store, DAL: dalStore,
			DefendedAssets: []scoring.DefendedAsset{
				{Name: "Cincu HQ", Lat: 45.8696, Lon: 24.7753},
				{Name: "Constanța naval area", Lat: 44.1733, Lon: 28.6383},
			},
		}),
		ReadHeaderTimeout: 5 * time.Second,
	}

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
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
}

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
