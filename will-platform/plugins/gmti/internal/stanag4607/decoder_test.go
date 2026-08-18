package stanag4607

import (
	"math"
	"strings"
	"testing"
	"time"
)

func samplePacket() Packet {
	return Packet{
		Header: PacketHeader{
			PacketID:             "12",
			PacketVersion:        "30",
			Nationality:          "XN",
			Classification:       5, // Unclassified
			ClassificationSystem: "NA",
			ExerciseIndicator:    0,
			PlatformID:           "RAT-31DL",
			MissionID:            42,
			JobID:                7,
		},
		Segments: []Segment{
			{Mission: &MissionSegment{
				MissionPlan:    "EXERCISE-A",
				FlightPlan:     "GROUND",
				PlatformType:   13, // Ground-based radar
				PlatformConfig: "ROMARM-A",
				ReferenceTime:  time.Date(2026, 5, 5, 12, 0, 0, 0, time.UTC),
			}},
			{Dwell: &DwellSegment{
				ExistenceMask:      WILLProfileMask,
				RevisitIndex:       1,
				DwellIndex:         3,
				LastDwellOfRevisit: true,
				TargetReportCount:  2,
				DwellTimeMS:        12 * 3600 * 1000,
				SensorLat:          45.8696,
				SensorLon:          24.7753,
				SensorAltCm:        50000,
				TargetReports: []TargetReport{
					{MTIReportIndex: 1, TargetLat: 45.90, TargetLon: 24.80, GeodeticHeightM: 480, LineOfSightVelMPS: 9.0, SignalToNoiseDB: 18, TargetClass: 2},
					{MTIReportIndex: 2, TargetLat: 45.85, TargetLon: 24.75, GeodeticHeightM: 460, LineOfSightVelMPS: -3.5, SignalToNoiseDB: 12, TargetClass: 5},
				},
			}},
		},
	}
}

func TestEncodeDecodeRoundTrip(t *testing.T) {
	in := samplePacket()
	buf, err := Encode(in)
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	out, err := Decode(buf)
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	if out.Header.PlatformID != "RAT-31DL" {
		t.Fatalf("PlatformID=%q", out.Header.PlatformID)
	}
	if len(out.Segments) != 2 {
		t.Fatalf("segments=%d", len(out.Segments))
	}
	d := out.Segments[1].Dwell
	if d == nil {
		t.Fatal("expected dwell segment")
	}
	if len(d.TargetReports) != 2 {
		t.Fatalf("targets=%d", len(d.TargetReports))
	}
	tr := d.TargetReports[0]
	if math.Abs(tr.TargetLat-45.90) > 1e-3 || math.Abs(tr.TargetLon-24.80) > 1e-3 {
		t.Fatalf("target0 coords=(%f, %f)", tr.TargetLat, tr.TargetLon)
	}
	if math.Abs(tr.LineOfSightVelMPS-9.0) > 1e-2 {
		t.Fatalf("target0 LOS=%f", tr.LineOfSightVelMPS)
	}
}

func TestRejectsTooSmall(t *testing.T) {
	if _, err := Decode([]byte{1, 2, 3}); err == nil {
		t.Fatal("expected truncated error")
	}
}

func TestRejectsBadPacketID(t *testing.T) {
	buf := make([]byte, headerLen)
	buf[0] = 'X'
	buf[1] = 'X'
	if _, err := Decode(buf); err == nil {
		t.Fatal("expected bad header error")
	}
}

func TestRejectsOversize(t *testing.T) {
	huge := make([]byte, MaxPacketBytes+1)
	if _, err := Decode(huge); err == nil {
		t.Fatal("expected too-big error")
	}
}

func TestRejectsBadSegmentSize(t *testing.T) {
	in := samplePacket()
	buf, _ := Encode(in)
	// corrupt the second segment's size to 0xFFFFFFFF
	for i := headerLen; i < len(buf)-segHeaderLen; i++ {
		if buf[i] == SegTypeDwell {
			buf[i+1] = 0xFF
			buf[i+2] = 0xFF
			buf[i+3] = 0xFF
			buf[i+4] = 0xFF
			break
		}
	}
	if _, err := Decode(buf); err == nil {
		t.Fatal("expected bad segment error")
	}
}

func TestSkipsUnsupportedSegment(t *testing.T) {
	in := samplePacket()
	in.Segments = append(in.Segments, Segment{Type: 99, Raw: []byte{1, 2, 3, 4, 5}})
	buf, err := Encode(in)
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	out, err := Decode(buf)
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(out.Segments) != 3 {
		t.Fatalf("segments=%d", len(out.Segments))
	}
	if out.Segments[2].Type != 99 || out.Segments[2].Raw == nil {
		t.Fatalf("expected unsupported segment preserved as raw")
	}
}

func TestRejectsExistenceMaskMismatch(t *testing.T) {
	in := samplePacket()
	in.Segments[1].Dwell.ExistenceMask = 0x01
	buf, _ := Encode(in)
	if _, err := Decode(buf); err == nil || !strings.Contains(err.Error(), "ExistenceMask") {
		t.Fatalf("expected ExistenceMask error, got %v", err)
	}
}

func TestPadHonoursDefaults(t *testing.T) {
	out := make([]byte, 4)
	pad(out, "", "AB")
	if string(out) != "AB  " {
		t.Fatalf("pad with default produced %q", out)
	}
}

func FuzzDecode(f *testing.F) {
	in := samplePacket()
	buf, _ := Encode(in)
	f.Add(buf)
	f.Add([]byte{})
	f.Add([]byte("12"))
	f.Fuzz(func(_ *testing.T, data []byte) {
		_, _ = Decode(data)
	})
}
