// Package feed abstracts the source of Skynex detections. Two implementations
// are planned: Sim (this commit, for dev and HIL game-days) and a Vendor
// adapter that connects to Rheinmetall's real feed once protocol access is in
// place (ADR-018 declares the vendor adapter as a follow-up).
package feed

import (
	"context"

	"github.com/will-platform/plugins/skynex-cuas/internal/track"
)

// Feed delivers detections on Out until ctx is cancelled.
type Feed interface {
	Run(ctx context.Context, out chan<- track.Detection) error
	Name() string
}
