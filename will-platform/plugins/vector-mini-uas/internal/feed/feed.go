// Package feed abstracts the source of Vector / Scorpion telemetry. Three
// implementations are planned:
//   - sim:     this commit; deterministic patrol leg for dev/HIL
//   - mavlink: Vector emits MAVLink-compatible telemetry on its GCS link;
//     reuse plugins/mavlink decoder via a small adapter (follow-up)
//   - quantum: vendor-proprietary control link; QBase SDK access required
//     (follow-up declared by ADR-018)
package feed

import (
	"context"

	"github.com/will-platform/plugins/vector-mini-uas/internal/track"
)

type Feed interface {
	Run(ctx context.Context, out chan<- track.Telemetry) error
	Name() string
}
