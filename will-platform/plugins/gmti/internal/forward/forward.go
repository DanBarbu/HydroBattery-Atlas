// Package forward turns decoded STANAG 4607 target reports into the v0 track
// payload that downstream WILL services consume.
package forward

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/will-platform/plugins/gmti/internal/stanag4607"
)

type Track struct {
	Schema             string         `json:"schema"`
	TrackID            string         `json:"track_id"`
	TenantID           string         `json:"tenant_id"`
	Source             string         `json:"source"`
	TrackKind          string         `json:"track_kind"`
	Geometry           Geometry       `json:"geometry"`
	AltitudeM          float64        `json:"altitude_m"`
	HeadingDeg         float64        `json:"heading_deg"`
	SpeedMps           float64        `json:"speed_mps"`
	VelocityRadialMps  float64        `json:"velocity_radial_mps"`
	SnrDB              float64        `json:"snr_db"`
	Classification     string         `json:"classification"`
	APP6DSIDC          string         `json:"app6d_sidc"`
	ObservedAt         string         `json:"observed_at"`
	Metadata           map[string]any `json:"metadata"`
}

type Geometry struct {
	Type        string    `json:"type"`
	Coordinates []float64 `json:"coordinates"`
}

// FromTargetReport produces one Track per target report. Sprint 3 default
// affiliation is Unknown ('U') since GMTI does not carry IFF on its own.
// Operators promote affiliation through later sprints' workflow.
func FromTargetReport(
	pkt stanag4607.Packet,
	dwell stanag4607.DwellSegment,
	tr stanag4607.TargetReport,
	tenantID, classification string,
) Track {
	platform := pkt.Header.PlatformID
	source := fmt.Sprintf("gmti/%s/job%d/mti%d", platform, pkt.Header.JobID, tr.MTIReportIndex)
	now := time.Now().UTC().Format(time.RFC3339Nano)
	return Track{
		Schema:            "will.track.v0",
		TrackID:           fmt.Sprintf("%s-%d-%d-%d", platform, pkt.Header.JobID, dwell.DwellIndex, tr.MTIReportIndex),
		TenantID:          tenantID,
		Source:            source,
		TrackKind:         "gmti",
		Geometry:          Geometry{Type: "Point", Coordinates: []float64{tr.TargetLon, tr.TargetLat}},
		AltitudeM:         float64(tr.GeodeticHeightM),
		HeadingDeg:        0,
		SpeedMps:          0,
		VelocityRadialMps: tr.LineOfSightVelMPS,
		SnrDB:             float64(tr.SignalToNoiseDB),
		Classification:    classification,
		APP6DSIDC:         "SUGP-----------",
		ObservedAt:        now,
		Metadata: map[string]any{
			"plugin":         "gmti",
			"version":        "0.1.0",
			"platform":       platform,
			"mission_id":     pkt.Header.MissionID,
			"job_id":         pkt.Header.JobID,
			"revisit_index":  dwell.RevisitIndex,
			"dwell_index":    dwell.DwellIndex,
			"target_class":   tr.TargetClass,
			"sensor_lat":     dwell.SensorLat,
			"sensor_lon":     dwell.SensorLon,
		},
	}
}

func (t Track) JSON() ([]byte, error) {
	return json.Marshal(t)
}
