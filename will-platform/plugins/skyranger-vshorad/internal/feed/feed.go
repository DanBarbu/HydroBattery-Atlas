// Package feed abstracts the source of Skyranger reports. Two implementations
// are planned: Sim (this commit) and a Vendor adapter for the Rheinmetall
// real feed (ADR-018 declares the vendor adapter as a follow-up).
package feed

import (
	"context"

	"github.com/will-platform/plugins/skyranger-vshorad/internal/track"
)

// Event is either a Detection or a PlatformPLI; exactly one is set.
type Event struct {
	Detection *track.Detection
	Platform  *track.PlatformPLI
}

// Feed delivers events on Out until ctx is cancelled.
type Feed interface {
	Run(ctx context.Context, out chan<- Event) error
	Name() string
}
