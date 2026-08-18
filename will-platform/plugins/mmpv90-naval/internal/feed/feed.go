// Package feed abstracts the source of MMPV-90 telemetry. Three planned
// implementations:
//
//   - sim:      this commit; corvette on a Black Sea patrol leg with sensor
//     contacts and AIS receptions, for dev/HIL
//   - vendor:   Rheinmetall CMS / sensor feed adapter — follow-up (ADR-018);
//     Phase 1 ingest-only; Phase 2 bidirectional only AFTER Link-22
//     ships on the Squad Alpha TDL roadmap
//   - link22:   Phase-2 only; not implemented in this commit (declared
//     dependency on the TDL gateway is NOT a blocker for Phase 1)
package feed

import (
	"context"

	"github.com/will-platform/plugins/mmpv90-naval/internal/track"
)

// Event is exactly one of OwnShip, Detection, or AIS. The plugin's main loop
// routes each variant to a separate MQTT topic (operational vs OSINT layers
// stay distinct per ADR-016/018).
type Event struct {
	OwnShip   *track.OwnShipPLI
	Detection *track.Detection
	AIS       *track.AISContact
}

type Feed interface {
	Run(ctx context.Context, out chan<- Event) error
	Name() string
}
