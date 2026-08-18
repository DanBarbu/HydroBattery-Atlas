// Package store holds the in-memory METOC registry: observations, forecasts,
// and flow-field samples. Advisory only (ADR-015) — nothing here tasks an
// asset or writes back to any sensor. Data originates from weather providers
// (METAR/TAF/GRIB adapters) and ocean/atmosphere flow sources.
package store

import (
	"sort"
	"sync"
	"time"

	"github.com/will-platform/metoc/internal/lagrangian"
)

type Observation struct {
	ID           string    `json:"id"`
	TenantID     string    `json:"tenant_id"`
	Station      string    `json:"station"`
	Lat          float64   `json:"lat"`
	Lon          float64   `json:"lon"`
	ObservedAt   time.Time `json:"observed_at"`
	WindDirDeg   float64   `json:"wind_dir_deg"`
	WindSpeedMps float64   `json:"wind_speed_mps"`
	GustMps      float64   `json:"gust_mps"`
	VisibilityM  float64   `json:"visibility_m"`
	CeilingM     float64   `json:"ceiling_m"`
	TempC        float64   `json:"temp_c"`
	DewC         float64   `json:"dew_c"`
	Precip       string    `json:"precip"`
	SeaState     int       `json:"sea_state"`
	WaveHeightM  float64   `json:"wave_height_m"`
	Source       string    `json:"source"`
	ReceivedAt   time.Time `json:"received_at"`
}

type Forecast struct {
	ID           string    `json:"id"`
	TenantID     string    `json:"tenant_id"`
	Station      string    `json:"station"`
	ValidFrom    time.Time `json:"valid_from"`
	ValidTo      time.Time `json:"valid_to"`
	WindDirDeg   float64   `json:"wind_dir_deg"`
	WindSpeedMps float64   `json:"wind_speed_mps"`
	GustMps      float64   `json:"gust_mps"`
	VisibilityM  float64   `json:"visibility_m"`
	CeilingM     float64   `json:"ceiling_m"`
	Precip       string    `json:"precip"`
	SeaState     int       `json:"sea_state"`
	WaveHeightM  float64   `json:"wave_height_m"`
	Provider     string    `json:"provider"`
	ReceivedAt   time.Time `json:"received_at"`
}

type FlowSample struct {
	ID        string    `json:"id"`
	TenantID  string    `json:"tenant_id"`
	Lat       float64   `json:"lat"`
	Lon       float64   `json:"lon"`
	UEastMps  float64   `json:"u_east_mps"`
	VNorthMps float64   `json:"v_north_mps"`
	ValidAt   time.Time `json:"valid_at"`
	Provider  string    `json:"provider"`
	ReceivedAt time.Time `json:"received_at"`
}

type Store struct {
	mu   sync.Mutex
	obs  map[string][]*Observation // tenant -> list (latest first)
	fc   map[string][]*Forecast
	flow map[string][]*FlowSample
	seq  int
}

func New() *Store {
	return &Store{
		obs:  map[string][]*Observation{},
		fc:   map[string][]*Forecast{},
		flow: map[string][]*FlowSample{},
	}
}

func (s *Store) id(p string) string {
	s.seq++
	const d = "0123456789abcdefghijklmnopqrstuvwxyz"
	n, out := s.seq, ""
	for n > 0 {
		out = string(d[n%36]) + out
		n /= 36
	}
	return p + "-" + out
}

func (s *Store) IngestObservation(tenantID string, o Observation) Observation {
	s.mu.Lock()
	defer s.mu.Unlock()
	o.ID = s.id("obs")
	o.TenantID = tenantID
	if o.Source == "" {
		o.Source = "metar"
	}
	if o.Precip == "" {
		o.Precip = "none"
	}
	o.ReceivedAt = time.Now().UTC()
	s.obs[tenantID] = append([]*Observation{&o}, s.obs[tenantID]...)
	return o
}

func (s *Store) ListObservations(tenantID string) []Observation {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]Observation, 0, len(s.obs[tenantID]))
	for _, o := range s.obs[tenantID] {
		out = append(out, *o)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ObservedAt.After(out[j].ObservedAt) })
	return out
}

// LatestObservation returns the most recent observation for a station, or the
// most recent overall if station is empty. ok is false if none exist.
func (s *Store) LatestObservation(tenantID, station string) (Observation, bool) {
	for _, o := range s.ListObservations(tenantID) {
		if station == "" || o.Station == station {
			return o, true
		}
	}
	return Observation{}, false
}

func (s *Store) IngestForecast(tenantID string, f Forecast) Forecast {
	s.mu.Lock()
	defer s.mu.Unlock()
	f.ID = s.id("fc")
	f.TenantID = tenantID
	if f.Provider == "" {
		f.Provider = "taf"
	}
	if f.Precip == "" {
		f.Precip = "none"
	}
	f.ReceivedAt = time.Now().UTC()
	s.fc[tenantID] = append([]*Forecast{&f}, s.fc[tenantID]...)
	return f
}

func (s *Store) ListForecasts(tenantID string) []Forecast {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]Forecast, 0, len(s.fc[tenantID]))
	for _, f := range s.fc[tenantID] {
		out = append(out, *f)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ValidFrom.Before(out[j].ValidFrom) })
	return out
}

func (s *Store) IngestFlow(tenantID string, fs FlowSample) FlowSample {
	s.mu.Lock()
	defer s.mu.Unlock()
	fs.ID = s.id("flow")
	fs.TenantID = tenantID
	if fs.Provider == "" {
		fs.Provider = "ocean-model"
	}
	if fs.ValidAt.IsZero() {
		fs.ValidAt = time.Now().UTC()
	}
	fs.ReceivedAt = time.Now().UTC()
	s.flow[tenantID] = append(s.flow[tenantID], &fs)
	return fs
}

func (s *Store) ListFlow(tenantID string) []FlowSample {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]FlowSample, 0, len(s.flow[tenantID]))
	for _, f := range s.flow[tenantID] {
		out = append(out, *f)
	}
	return out
}

// Field builds a lagrangian.Field from the tenant's flow samples, falling back
// to the western Black-Sea surface set when no samples exist.
func (s *Store) Field(tenantID string) lagrangian.Field {
	f := lagrangian.BlackSeaSurface()
	for _, fs := range s.ListFlow(tenantID) {
		f.Samples = append(f.Samples, lagrangian.Sample{
			Lat: fs.Lat, Lon: fs.Lon, UEastMps: fs.UEastMps, VNorthMps: fs.VNorthMps,
		})
	}
	return f
}
