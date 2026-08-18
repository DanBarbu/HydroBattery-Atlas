package forward

import (
	"encoding/json"
	"testing"

	"github.com/will-platform/plugins/gmti/internal/stanag4607"
)

func TestFromTargetReport(t *testing.T) {
	pkt := stanag4607.Packet{
		Header: stanag4607.PacketHeader{PlatformID: "RAT-31DL", MissionID: 7, JobID: 3},
	}
	dwell := stanag4607.DwellSegment{
		RevisitIndex: 2,
		DwellIndex:   4,
		SensorLat:    45.8696,
		SensorLon:    24.7753,
	}
	tr := stanag4607.TargetReport{
		MTIReportIndex:    11,
		TargetLat:         45.90,
		TargetLon:         24.80,
		GeodeticHeightM:   480,
		LineOfSightVelMPS: 9.5,
		SignalToNoiseDB:   18,
		TargetClass:       2,
	}
	got := FromTargetReport(pkt, dwell, tr, "tenant", "NESECRET")
	if got.TrackKind != "gmti" {
		t.Fatalf("track_kind=%q", got.TrackKind)
	}
	if got.APP6DSIDC[1] != 'U' {
		t.Fatalf("expected unknown affiliation, sidc=%q", got.APP6DSIDC)
	}
	b, err := got.JSON()
	if err != nil {
		t.Fatalf("json: %v", err)
	}
	var roundtrip map[string]any
	if err := json.Unmarshal(b, &roundtrip); err != nil {
		t.Fatal(err)
	}
	md := roundtrip["metadata"].(map[string]any)
	if md["platform"] != "RAT-31DL" {
		t.Fatalf("platform missing in metadata: %v", md)
	}
}
