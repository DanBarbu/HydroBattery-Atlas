// Package loader connects to a configured set of plugin gRPC endpoints,
// calls Describe/Configure, polls Health, and streams Telemetry into a
// downstream Bridge (typically the EMQX MQTT bridge).
//
// Sprint 1 scope: static plugin endpoints from config. Dynamic discovery
// (Sprint 12 plugin registry) replaces the static list later.
package loader

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/will-platform/plugin-loader/internal/registry"
)

// Bridge consumes Track payloads emitted by plugins.
type Bridge interface {
	Publish(ctx context.Context, t Track) error
}

// PluginClient is the abstract interface the loader uses to talk to a plugin.
// In production it is a thin wrapper over the generated gRPC stubs.
type PluginClient interface {
	Describe(ctx context.Context) (DescribeResult, error)
	Health(ctx context.Context) (HealthResult, error)
	Configure(ctx context.Context, tenantID string, settings map[string]any) error
	Telemetry(ctx context.Context, tenantID string, out chan<- Track) error
	Close() error
}

type DescribeResult struct {
	Name            string
	Version         string
	Vendor          string
	ContractVersion string
	Capabilities    []string
	Description     string
}

type HealthResult struct {
	Status    string
	LatencyMs int64
}

type Track struct {
	TrackID        string
	Source         string
	TenantID       string
	Longitude      float64
	Latitude       float64
	AltitudeM      float64
	HeadingDeg     float64
	SpeedMps       float64
	Confidence     float64
	Classification string
	APP6DSIDC      string
	ObservedAt     time.Time
	Metadata       map[string]any
}

type PluginConfig struct {
	ID       string
	Endpoint string
	TenantID string
	Settings map[string]any
}

type Options struct {
	Reg              *registry.Registry
	Bridge           Bridge
	HealthInterval   time.Duration
	AcceptedContract string // e.g. "v1.0"
}

type Loader struct {
	opts    Options
	dialer  func(endpoint string) (PluginClient, error)
	mu      sync.Mutex
	clients map[string]PluginClient
}

func New(opts Options, dialer func(string) (PluginClient, error)) *Loader {
	if opts.HealthInterval == 0 {
		opts.HealthInterval = 5 * time.Second
	}
	return &Loader{
		opts:    opts,
		dialer:  dialer,
		clients: make(map[string]PluginClient),
	}
}

// Load brings up a single plugin. It Describes, validates the contract
// version, Configures, and then runs a Health-poll loop and a Telemetry
// pump until ctx is cancelled.
func (l *Loader) Load(ctx context.Context, cfg PluginConfig) error {
	client, err := l.dialer(cfg.Endpoint)
	if err != nil {
		return fmt.Errorf("dial %s: %w", cfg.Endpoint, err)
	}

	desc, err := client.Describe(ctx)
	if err != nil {
		_ = client.Close()
		return fmt.Errorf("describe: %w", err)
	}
	if l.opts.AcceptedContract != "" && desc.ContractVersion != l.opts.AcceptedContract {
		_ = client.Close()
		return fmt.Errorf(
			"plugin %s declares contract %s; loader accepts %s",
			cfg.ID, desc.ContractVersion, l.opts.AcceptedContract,
		)
	}

	if err := client.Configure(ctx, cfg.TenantID, cfg.Settings); err != nil {
		_ = client.Close()
		return fmt.Errorf("configure: %w", err)
	}

	l.opts.Reg.Upsert(registry.Entry{
		ID:              cfg.ID,
		Name:            desc.Name,
		Version:         desc.Version,
		Vendor:          desc.Vendor,
		ContractVersion: desc.ContractVersion,
		Capabilities:    desc.Capabilities,
		Description:     desc.Description,
		Status:          registry.StatusUnknown.String(),
		LastSeen:        time.Now().UTC(),
	})

	l.mu.Lock()
	l.clients[cfg.ID] = client
	l.mu.Unlock()

	go l.healthLoop(ctx, cfg.ID, client)
	go l.telemetryLoop(ctx, cfg, client)

	return nil
}

func (l *Loader) healthLoop(ctx context.Context, id string, c PluginClient) {
	ticker := time.NewTicker(l.opts.HealthInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			start := time.Now()
			h, err := c.Health(ctx)
			latency := time.Since(start).Milliseconds()
			if err != nil {
				l.opts.Reg.Touch(id, registry.StatusNotServing, latency)
				continue
			}
			status := registry.StatusUnknown
			switch h.Status {
			case "SERVING":
				status = registry.StatusServing
			case "NOT_SERVING":
				status = registry.StatusNotServing
			case "DEGRADED":
				status = registry.StatusDegraded
			}
			l.opts.Reg.Touch(id, status, latency)
		}
	}
}

func (l *Loader) telemetryLoop(ctx context.Context, cfg PluginConfig, c PluginClient) {
	out := make(chan Track, 256)
	go func() {
		if err := c.Telemetry(ctx, cfg.TenantID, out); err != nil && ctx.Err() == nil {
			log.Printf("[loader] telemetry %s ended: %v", cfg.ID, err)
		}
		close(out)
	}()
	for t := range out {
		if err := l.opts.Bridge.Publish(ctx, t); err != nil {
			log.Printf("[loader] bridge publish %s: %v", cfg.ID, err)
		}
	}
}

// Close stops all plugins.
func (l *Loader) Close() {
	l.mu.Lock()
	defer l.mu.Unlock()
	for id, c := range l.clients {
		_ = c.Close()
		l.opts.Reg.Remove(id)
	}
	l.clients = map[string]PluginClient{}
}
