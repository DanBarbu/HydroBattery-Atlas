// Package feed abstracts the source of Lynx KF41 telemetry. Three planned
// implementations:
//   - sim:           this commit; deterministic platoon road march
//   - vehicle-bus:   Rheinmetall vehicle telemetry adapter — follow-up
//     (vendor protocol access required; ADR-018 declares it)
//   - cot:           the crew tablet emits CoT PLI; reuse the atak-mil decoder
//     pattern via a small adapter (follow-up)
package feed

import (
	"context"

	"github.com/will-platform/plugins/lynx-ifv/internal/track"
)

type Feed interface {
	Run(ctx context.Context, out chan<- track.PlatformPLI) error
	Name() string
}
