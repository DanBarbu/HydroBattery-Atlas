package api

import (
	"time"

	"github.com/will-platform/fires/internal/deconflict"
	"github.com/will-platform/fires/internal/store"
)

// deconflictCheck is the advisory-only adapter: pull the tenant's active
// measures and run the geometry/time/altitude check. ADR-012 — it returns
// flags only; it never blocks, gates, approves, or tasks anything.
func deconflictCheck(s *store.Store, tenantID string, lon, lat, alt float64, at time.Time) []deconflict.Flag {
	return deconflict.Check(lon, lat, alt, at, s.ToDeconflictMeasures(tenantID, at))
}
