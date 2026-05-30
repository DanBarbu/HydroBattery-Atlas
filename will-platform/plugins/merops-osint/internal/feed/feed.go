// Package feed abstracts the source of MEROPS detections. Two planned
// implementations:
//
//   - sim:        this commit; deterministic Shahed-style track + sequenced
//     jamming-then-neutralised engagement outcomes (dev/HIL)
//   - marketplace: US Counter-UAS Marketplace feed adapter — follow-up
//     (requires US-side credential issuance and IL5/IL6 review)
package feed

import (
	"context"

	"github.com/will-platform/plugins/merops-osint/internal/track"
)

type Feed interface {
	Run(ctx context.Context, out chan<- track.Detection) error
	Name() string
}
