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

	// Demo seeds (illustrative public-domain envelope figures).
	// Patriot refreshed: PAC-3 MSE / Config 3+ — BMD-capable, deeper
	// envelope than the original placeholder.
	_, _ = store.CreateEffector(ctx, api.Effector{
		TenantID: "00000000-0000-0000-0000-000000000001",
		PluginID: "sam-battery-mock", Kind: "sam_area", DisplayName: "Patriot Bn 1 (PAC-3 MSE)",
		Lat: 45.87, Lon: 24.78,
		MinRangeM: 3_000, MaxRangeM: 100_000, MinAltitudeM: 50, MaxAltitudeM: 36_000,
		MaxTargetSpeed: 2_400, RoundsRemaining: 16, Status: "READY",
	})
	// NSM coastal refreshed: ~185 km, sea-skimming, surface targets.
	_, _ = store.CreateEffector(ctx, api.Effector{
		TenantID: "00000000-0000-0000-0000-000000000001",
		PluginID: "nsm-coastal-mock", Kind: "nsm_coastal", DisplayName: "NSM Coastal Bty",
		Lat: 44.20, Lon: 28.65,
		MinRangeM: 3_000, MaxRangeM: 185_000, MinAltitudeM: -10, MaxAltitudeM: 1_000,
		MaxTargetSpeed: 40, RoundsRemaining: 8, Status: "READY",
	})
	// Skynex / Oerlikon GDF-103 — close-in C-RAM / C-UAS gun.
	_, _ = store.CreateEffector(ctx, api.Effector{
		TenantID: "00000000-0000-0000-0000-000000000001",
		PluginID: "skynex-mock", Kind: "gun_shorad", DisplayName: "Skynex Bty (GDF-103)",
		Lat: 45.872, Lon: 24.776,
		MinRangeM: 100, MaxRangeM: 4_000, MinAltitudeM: 0, MaxAltitudeM: 3_500,
		MaxTargetSpeed: 1_000, RoundsRemaining: 1_200, Status: "READY",
	})
	// F-16 combat air patrol on station — AIM-120 AMRAAM / AIM-9X loadout.
	_, _ = store.CreateEffector(ctx, api.Effector{
		TenantID: "00000000-0000-0000-0000-000000000001",
		PluginID: "cap-fighter-mock", Kind: "air_intercept", DisplayName: "F-16 CAP SOIM-01",
		Lat: 45.80, Lon: 24.55,
		MinRangeM: 2_000, MaxRangeM: 100_000, MinAltitudeM: 30, MaxAltitudeM: 18_000,
		MaxTargetSpeed: 900, RoundsRemaining: 8, Status: "READY",
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
