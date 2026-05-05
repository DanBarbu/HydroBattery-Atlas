package loader

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/will-platform/plugin-loader/internal/registry"
)

type fakeBridge struct {
	tracks []Track
}

func (b *fakeBridge) Publish(_ context.Context, t Track) error {
	b.tracks = append(b.tracks, t)
	return nil
}

type fakePlugin struct {
	desc     DescribeResult
	tracks   []Track
	configed bool
}

func (p *fakePlugin) Describe(context.Context) (DescribeResult, error) { return p.desc, nil }
func (p *fakePlugin) Health(context.Context) (HealthResult, error) {
	return HealthResult{Status: "SERVING"}, nil
}
func (p *fakePlugin) Configure(_ context.Context, _ string, _ map[string]any) error {
	p.configed = true
	return nil
}
func (p *fakePlugin) Telemetry(ctx context.Context, _ string, out chan<- Track) error {
	for _, t := range p.tracks {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case out <- t:
		}
	}
	<-ctx.Done()
	return ctx.Err()
}
func (p *fakePlugin) Close() error { return nil }

func TestLoadHappyPath(t *testing.T) {
	reg := registry.New()
	bridge := &fakeBridge{}
	plugin := &fakePlugin{
		desc:   DescribeResult{Name: "fake", Version: "0.1.0", ContractVersion: "v1.0"},
		tracks: []Track{{TrackID: "t1", Source: "fake/1"}, {TrackID: "t2", Source: "fake/1"}},
	}
	l := New(Options{
		Reg:              reg,
		Bridge:           bridge,
		AcceptedContract: "v1.0",
		HealthInterval:   10 * time.Millisecond,
	}, func(string) (PluginClient, error) { return plugin, nil })

	ctx, cancel := context.WithCancel(context.Background())
	if err := l.Load(ctx, PluginConfig{ID: "p1", Endpoint: "fake://1", TenantID: "tenant"}); err != nil {
		t.Fatalf("Load: %v", err)
	}
	time.Sleep(50 * time.Millisecond)
	cancel()
	l.Close()

	if !plugin.configed {
		t.Error("plugin was not configured")
	}
	if len(bridge.tracks) != 2 {
		t.Errorf("expected 2 tracks bridged, got %d", len(bridge.tracks))
	}
	if got := reg.List(); len(got) != 0 {
		t.Errorf("expected registry cleared after Close, got %d entries", len(got))
	}
}

func TestLoadRejectsMismatchedContract(t *testing.T) {
	reg := registry.New()
	plugin := &fakePlugin{desc: DescribeResult{ContractVersion: "v0.9"}}
	l := New(Options{
		Reg:              reg,
		Bridge:           &fakeBridge{},
		AcceptedContract: "v1.0",
	}, func(string) (PluginClient, error) { return plugin, nil })

	err := l.Load(context.Background(), PluginConfig{ID: "p1", Endpoint: "fake://1"})
	if err == nil {
		t.Fatal("expected contract mismatch error")
	}
}

type failingDialer struct{}

func TestLoadDialError(t *testing.T) {
	reg := registry.New()
	l := New(Options{Reg: reg, Bridge: &fakeBridge{}, AcceptedContract: "v1.0"},
		func(string) (PluginClient, error) { return nil, errors.New("boom") })
	if err := l.Load(context.Background(), PluginConfig{ID: "p1"}); err == nil {
		t.Fatal("expected dial error")
	}
}
