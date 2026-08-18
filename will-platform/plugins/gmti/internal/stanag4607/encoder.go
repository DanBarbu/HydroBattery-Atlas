package stanag4607

import (
	"bytes"
	"encoding/binary"
	"fmt"
)

// Encode produces a STANAG 4607 packet matching the WILL minimal profile.
// Used by the gmti-replay container and by round-trip decoder tests.
func Encode(p Packet) ([]byte, error) {
	body := &bytes.Buffer{}
	for _, seg := range p.Segments {
		var payload []byte
		switch {
		case seg.Mission != nil:
			payload = encodeMission(*seg.Mission)
			body.WriteByte(SegTypeMission)
		case seg.Dwell != nil:
			pl, err := encodeDwell(*seg.Dwell)
			if err != nil {
				return nil, err
			}
			payload = pl
			body.WriteByte(SegTypeDwell)
		default:
			body.WriteByte(seg.Type)
			payload = seg.Raw
		}
		if err := binary.Write(body, binary.BigEndian, uint32(segHeaderLen+len(payload))); err != nil {
			return nil, err
		}
		body.Write(payload)
	}

	hdr := make([]byte, headerLen)
	pad(hdr[0:2], p.Header.PacketID, "12")
	pad(hdr[2:4], p.Header.PacketVersion, "30")
	binary.BigEndian.PutUint32(hdr[4:8], uint32(headerLen+body.Len()))
	pad(hdr[8:10], p.Header.Nationality, "XN")
	hdr[10] = p.Header.Classification
	pad(hdr[11:13], p.Header.ClassificationSystem, "NA")
	binary.BigEndian.PutUint16(hdr[13:15], p.Header.PacketSecurityCode)
	hdr[15] = p.Header.ExerciseIndicator
	pad(hdr[16:26], p.Header.PlatformID, "")
	binary.BigEndian.PutUint32(hdr[26:30], p.Header.MissionID)
	binary.BigEndian.PutUint32(hdr[30:32], (p.Header.JobID<<16)&0xFFFF0000)

	out := make([]byte, 0, len(hdr)+body.Len())
	out = append(out, hdr...)
	out = append(out, body.Bytes()...)
	return out, nil
}

func encodeMission(m MissionSegment) []byte {
	out := make([]byte, 12+12+1+10+5)
	pad(out[0:12], m.MissionPlan, "")
	pad(out[12:24], m.FlightPlan, "")
	out[24] = m.PlatformType
	pad(out[25:35], m.PlatformConfig, "")
	binary.BigEndian.PutUint16(out[35:37], uint16(m.ReferenceTime.Year()))
	out[37] = byte(m.ReferenceTime.Month())
	out[38] = byte(m.ReferenceTime.Day())
	out[39] = byte(m.ReferenceTime.Hour())
	return out
}

func encodeDwell(d DwellSegment) ([]byte, error) {
	if d.TargetReportCount != uint16(len(d.TargetReports)) {
		return nil, fmt.Errorf("dwell: TargetReportCount=%d but len(TargetReports)=%d",
			d.TargetReportCount, len(d.TargetReports))
	}
	out := make([]byte, dwellHeaderLen+int(d.TargetReportCount)*targetReportLen)
	mask := d.ExistenceMask
	if mask == 0 {
		mask = WILLProfileMask
	}
	binary.BigEndian.PutUint64(out[0:8], mask)
	binary.BigEndian.PutUint16(out[8:10], d.RevisitIndex)
	binary.BigEndian.PutUint16(out[10:12], d.DwellIndex)
	if d.LastDwellOfRevisit {
		out[12] = 1
	}
	binary.BigEndian.PutUint16(out[13:15], d.TargetReportCount)
	binary.BigEndian.PutUint32(out[15:19], d.DwellTimeMS)
	binary.BigEndian.PutUint32(out[19:23], uint32(encodeSA32(d.SensorLat)))
	binary.BigEndian.PutUint32(out[23:27], encodeBA32(d.SensorLon))
	binary.BigEndian.PutUint32(out[27:31], uint32(d.SensorAltCm))

	body := out[dwellHeaderLen:]
	for i, tr := range d.TargetReports {
		off := i * targetReportLen
		binary.BigEndian.PutUint16(body[off:off+2], tr.MTIReportIndex)
		binary.BigEndian.PutUint32(body[off+2:off+6], uint32(encodeSA32(tr.TargetLat)))
		binary.BigEndian.PutUint32(body[off+6:off+10], encodeBA32(tr.TargetLon))
		binary.BigEndian.PutUint16(body[off+10:off+12], uint16(tr.GeodeticHeightM))
		vel := int16(tr.LineOfSightVelMPS * 100)
		binary.BigEndian.PutUint16(body[off+12:off+14], uint16(vel))
		body[off+14] = byte(tr.SignalToNoiseDB)
		body[off+15] = tr.TargetClass
	}
	return out, nil
}

func encodeSA32(deg float64) int32 {
	return int32(deg * (2147483648.0 / 180.0))
}

func encodeBA32(deg float64) uint32 {
	if deg < 0 {
		deg += 360
	}
	return uint32(deg * (4294967296.0 / 360.0))
}

func pad(dst []byte, s, def string) {
	if s == "" {
		s = def
	}
	for i := range dst {
		if i < len(s) {
			dst[i] = s[i]
		} else {
			dst[i] = ' '
		}
	}
}
