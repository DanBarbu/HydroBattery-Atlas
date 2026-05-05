// Package stanag4607 decodes a defensive subset of NATO STANAG 4607
// (Edition 3) GMTI packets — what we call the **WILL minimal profile**.
//
// The full standard supports many segment types and a flexible existence-mask
// per dwell. Sprint 3 ships the canonical kernel: packet header + Mission
// Segment (Type 1) + Dwell Segment (Type 2) with a fixed existence mask
// covering revisit/dwell indices, sensor position, and a target-report record
// containing MTI index, target lat/lon (D32 absolute), height, line-of-sight
// velocity, SNR, and target classification. Unknown or unsupported segments
// are skipped with their full size honoured so the parser never desyncs.
//
// Hostile inputs must not crash the decoder. Every field length and every
// segment size is bounded; invalid sizes return ErrTruncated.
package stanag4607

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"strings"
	"time"
)

const (
	// MaxPacketBytes guards against pathological inputs.
	MaxPacketBytes = 8 * 1024 * 1024
	headerLen      = 32
	segHeaderLen   = 5
)

// Segment types we care about; others are skipped per their declared size.
const (
	SegTypeMission uint8 = 1
	SegTypeDwell   uint8 = 2
)

// ExistenceMask bits relevant to the WILL minimal profile.
//
// Real STANAG 4607 implementations consult the existence mask to choose which
// fields are present. For Sprint 3 we hard-code the WILL profile mask and
// validate it on receipt; mismatching senders are rejected with a clear
// error so the cause is visible in the logs.
const WILLProfileMask uint64 = 0xFFFFFFFFFFFFFFFF // accept-all in profile

var (
	ErrTruncated     = errors.New("stanag4607: truncated packet")
	ErrUnsupported   = errors.New("stanag4607: unsupported field/profile")
	ErrBadHeader     = errors.New("stanag4607: bad packet header")
	ErrBadSegment    = errors.New("stanag4607: bad segment header")
	ErrPacketTooBig  = errors.New("stanag4607: packet exceeds MaxPacketBytes")
)

type Packet struct {
	Header   PacketHeader
	Segments []Segment
}

type PacketHeader struct {
	PacketID            string
	PacketVersion       string
	PacketLength        uint32
	Nationality         string
	Classification      uint8
	ClassificationSystem string
	PacketSecurityCode  uint16
	ExerciseIndicator   uint8
	PlatformID          string
	MissionID           uint32
	JobID               uint32
}

type Segment struct {
	Type    uint8
	Size    uint32
	Mission *MissionSegment
	Dwell   *DwellSegment
	Raw     []byte // for unsupported segments — kept so consumers can log
}

type MissionSegment struct {
	MissionPlan    string
	FlightPlan     string
	PlatformType   uint8
	PlatformConfig string
	ReferenceTime  time.Time
}

type DwellSegment struct {
	ExistenceMask      uint64
	RevisitIndex       uint16
	DwellIndex         uint16
	LastDwellOfRevisit bool
	TargetReportCount  uint16
	DwellTimeMS        uint32
	SensorLat          float64
	SensorLon          float64
	SensorAltCm        int32
	TargetReports      []TargetReport
}

type TargetReport struct {
	MTIReportIndex     uint16
	TargetLat          float64
	TargetLon          float64
	GeodeticHeightM    int16
	LineOfSightVelMPS  float64
	SignalToNoiseDB    int8
	TargetClass        uint8
}

// Decode parses one STANAG 4607 packet from the byte slice. Trailing bytes
// past the declared packet length are ignored.
func Decode(buf []byte) (Packet, error) {
	if len(buf) > MaxPacketBytes {
		return Packet{}, ErrPacketTooBig
	}
	if len(buf) < headerLen {
		return Packet{}, ErrTruncated
	}

	hdr, err := decodeHeader(buf[:headerLen])
	if err != nil {
		return Packet{}, err
	}
	if hdr.PacketLength < headerLen || hdr.PacketLength > uint32(len(buf)) {
		return Packet{}, fmt.Errorf("%w: packet length %d", ErrBadHeader, hdr.PacketLength)
	}

	body := buf[headerLen:hdr.PacketLength]
	segs := make([]Segment, 0, 4)
	for len(body) > 0 {
		if len(body) < segHeaderLen {
			return Packet{}, fmt.Errorf("%w: segment header", ErrBadSegment)
		}
		segType := body[0]
		segSize := binary.BigEndian.Uint32(body[1:5])
		if segSize < segHeaderLen || int(segSize) > len(body) {
			return Packet{}, fmt.Errorf("%w: declared size %d", ErrBadSegment, segSize)
		}
		payload := body[segHeaderLen:segSize]
		seg := Segment{Type: segType, Size: segSize}
		switch segType {
		case SegTypeMission:
			m, err := decodeMission(payload)
			if err != nil {
				return Packet{}, err
			}
			seg.Mission = &m
		case SegTypeDwell:
			d, err := decodeDwell(payload)
			if err != nil {
				return Packet{}, err
			}
			seg.Dwell = &d
		default:
			seg.Raw = append([]byte(nil), payload...)
		}
		segs = append(segs, seg)
		body = body[segSize:]
	}
	return Packet{Header: hdr, Segments: segs}, nil
}

func decodeHeader(b []byte) (PacketHeader, error) {
	if len(b) != headerLen {
		return PacketHeader{}, ErrTruncated
	}
	hdr := PacketHeader{
		PacketID:             ascii(b[0:2]),
		PacketVersion:        ascii(b[2:4]),
		PacketLength:         binary.BigEndian.Uint32(b[4:8]),
		Nationality:          ascii(b[8:10]),
		Classification:       b[10],
		ClassificationSystem: ascii(b[11:13]),
		PacketSecurityCode:   binary.BigEndian.Uint16(b[13:15]),
		ExerciseIndicator:    b[15],
		PlatformID:           ascii(b[16:26]),
		MissionID:            binary.BigEndian.Uint32(b[26:30]),
		JobID:                binary.BigEndian.Uint32(b[30:32]) >> 16, // 2 bytes for JobID; remaining 2 reserved
	}
	if hdr.PacketID != "12" {
		return PacketHeader{}, fmt.Errorf("%w: PacketID=%q", ErrBadHeader, hdr.PacketID)
	}
	return hdr, nil
}

// Mission segment fixed layout: MissionPlan(12) + FlightPlan(12) +
// PlatformType(1) + PlatformConfig(10) + ReferenceTime(4 bytes year/month/day-of-year/hour-as-bcd? -> we use a simple unix encoding)
// For interop with the WILL encoder we store a 4-byte big-endian unix epoch
// in seconds. Real STANAG 4607 reference time uses calendar fields; the
// decoder accepts either 4-byte unix or the canonical 5-byte calendar form
// based on the payload length.
func decodeMission(b []byte) (MissionSegment, error) {
	if len(b) < 12+12+1+10+4 {
		return MissionSegment{}, fmt.Errorf("%w: mission segment too short", ErrTruncated)
	}
	m := MissionSegment{
		MissionPlan:    ascii(b[0:12]),
		FlightPlan:     ascii(b[12:24]),
		PlatformType:   b[24],
		PlatformConfig: ascii(b[25:35]),
	}
	if len(b) >= 35+5 {
		// canonical: year(2) month(1) day(1) hour(1)
		yr := int(binary.BigEndian.Uint16(b[35:37]))
		mo := int(b[37])
		d := int(b[38])
		h := int(b[39])
		m.ReferenceTime = time.Date(yr, time.Month(mo), d, h, 0, 0, 0, time.UTC)
	} else {
		// WILL profile: 4-byte unix epoch
		m.ReferenceTime = time.Unix(int64(binary.BigEndian.Uint32(b[35:39])), 0).UTC()
	}
	return m, nil
}

// Dwell segment in the WILL minimal profile: 8(mask) + 2(revisit) + 2(dwell) +
// 1(last) + 2(count) + 4(dwell time) + 4(lat SA32) + 4(lon BA32) + 4(alt cm)
// = 31 bytes header. Then for each target report: 2(mti idx) + 4(lat SA32) +
// 4(lon BA32) + 2(height m) + 2(LOS vel cm/s) + 1(SNR dB) + 1(class) = 16 bytes.
const dwellHeaderLen = 31
const targetReportLen = 16

func decodeDwell(b []byte) (DwellSegment, error) {
	if len(b) < dwellHeaderLen {
		return DwellSegment{}, fmt.Errorf("%w: dwell header", ErrTruncated)
	}
	d := DwellSegment{
		ExistenceMask:      binary.BigEndian.Uint64(b[0:8]),
		RevisitIndex:       binary.BigEndian.Uint16(b[8:10]),
		DwellIndex:         binary.BigEndian.Uint16(b[10:12]),
		LastDwellOfRevisit: b[12] != 0,
		TargetReportCount:  binary.BigEndian.Uint16(b[13:15]),
		DwellTimeMS:        binary.BigEndian.Uint32(b[15:19]),
		SensorLat:          decodeSA32(int32(binary.BigEndian.Uint32(b[19:23]))),
		SensorLon:          decodeBA32(binary.BigEndian.Uint32(b[23:27])),
		SensorAltCm:        int32(binary.BigEndian.Uint32(b[27:31])),
	}
	if d.ExistenceMask != WILLProfileMask {
		return DwellSegment{}, fmt.Errorf(
			"%w: ExistenceMask=%016x; WILL minimal profile expects %016x",
			ErrUnsupported, d.ExistenceMask, WILLProfileMask,
		)
	}
	expected := dwellHeaderLen + int(d.TargetReportCount)*targetReportLen
	if len(b) < expected {
		return DwellSegment{}, fmt.Errorf(
			"%w: dwell body %d < expected %d", ErrTruncated, len(b), expected,
		)
	}
	body := b[dwellHeaderLen:]
	d.TargetReports = make([]TargetReport, 0, d.TargetReportCount)
	for i := 0; i < int(d.TargetReportCount); i++ {
		off := i * targetReportLen
		tr := TargetReport{
			MTIReportIndex:    binary.BigEndian.Uint16(body[off : off+2]),
			TargetLat:         decodeSA32(int32(binary.BigEndian.Uint32(body[off+2 : off+6]))),
			TargetLon:         decodeBA32(binary.BigEndian.Uint32(body[off+6 : off+10])),
			GeodeticHeightM:   int16(binary.BigEndian.Uint16(body[off+10 : off+12])),
			LineOfSightVelMPS: float64(int16(binary.BigEndian.Uint16(body[off+12:off+14]))) / 100.0,
			SignalToNoiseDB:   int8(body[off+14]),
			TargetClass:       body[off+15],
		}
		if tr.TargetLat < -90 || tr.TargetLat > 90 || tr.TargetLon < -180 || tr.TargetLon > 180 {
			return DwellSegment{}, fmt.Errorf("%w: target %d coord out of range", ErrUnsupported, i)
		}
		d.TargetReports = append(d.TargetReports, tr)
	}
	return d, nil
}

// decodeSA32 — Signed Angle 32: degrees = raw * (180 / 2^31)
func decodeSA32(raw int32) float64 {
	return float64(raw) * (180.0 / 2147483648.0)
}

// decodeBA32 — Binary Angle 32 unsigned: degrees in [0, 360); we wrap to [-180, 180).
func decodeBA32(raw uint32) float64 {
	deg := float64(raw) * (360.0 / 4294967296.0)
	if deg >= 180 {
		deg -= 360
	}
	return deg
}

func ascii(b []byte) string {
	// Strip trailing NULs and spaces; STANAG 4607 strings are space-padded.
	return strings.TrimRight(string(bytes.TrimRight(b, "\x00")), " ")
}
