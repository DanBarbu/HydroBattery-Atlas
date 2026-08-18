// Package registry tracks the live plugin set and their last-known health.
// It is goroutine-safe; the API and loader read/write through the same handle.
package registry

import (
	"sync"
	"time"
)

type Status int

const (
	StatusUnknown Status = iota
	StatusServing
	StatusNotServing
	StatusDegraded
)

func (s Status) String() string {
	switch s {
	case StatusServing:
		return "SERVING"
	case StatusNotServing:
		return "NOT_SERVING"
	case StatusDegraded:
		return "DEGRADED"
	default:
		return "UNKNOWN"
	}
}

// Entry is the public view of a registered plugin.
type Entry struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	Version         string    `json:"version"`
	Vendor          string    `json:"vendor"`
	ContractVersion string    `json:"contract_version"`
	Capabilities    []string  `json:"capabilities"`
	Description     string    `json:"description"`
	Status          string    `json:"status"`
	LastSeen        time.Time `json:"last_seen"`
	LatencyMs       int64     `json:"latency_ms"`
}

// Registry is a thread-safe store keyed by plugin id.
type Registry struct {
	mu  sync.RWMutex
	all map[string]Entry
}

func New() *Registry {
	return &Registry{all: make(map[string]Entry)}
}

func (r *Registry) Upsert(e Entry) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.all[e.ID] = e
}

func (r *Registry) Touch(id string, status Status, latencyMs int64) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	e, ok := r.all[id]
	if !ok {
		return false
	}
	e.Status = status.String()
	e.LastSeen = time.Now().UTC()
	e.LatencyMs = latencyMs
	r.all[id] = e
	return true
}

func (r *Registry) Remove(id string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.all, id)
}

func (r *Registry) List() []Entry {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]Entry, 0, len(r.all))
	for _, e := range r.all {
		out = append(out, e)
	}
	return out
}
