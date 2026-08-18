// gmti-replay — Sprint 3 demo aid.
//
// Synthesises a STANAG 4607 packet (Mission + Dwell + 3 target reports) and
// transmits it over UDP to the gmti plugin's listener once per second. The
// scenario: three ground vehicles transiting near the Cincu range, with
// realistic radial velocities and SNRs.
package main

import (
	"log"
	"math"
	"net"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/will-platform/plugins/gmti/internal/stanag4607"
)

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

const (
	centerLat = 45.8696
	centerLon = 24.7753
	earthR    = 6_378_137.0
)

func offset(lat, lon, northM, eastM float64) (float64, float64) {
	dlat := northM / earthR
	dlon := eastM / (earthR * math.Cos(lat*math.Pi/180))
	return lat + dlat*180/math.Pi, lon + dlon*180/math.Pi
}

func main() {
	target := envOr("GMTI_TARGET", "gmti:8190")
	periodS, _ := strconv.Atoi(envOr("PERIOD_S", "1"))
	if periodS <= 0 {
		periodS = 1
	}

	addr, err := net.ResolveUDPAddr("udp", target)
	if err != nil {
		log.Fatalf("[gmti-replay] resolve: %v", err)
	}
	conn, err := net.DialUDP("udp", nil, addr)
	if err != nil {
		log.Fatalf("[gmti-replay] dial: %v", err)
	}
	defer func() { _ = conn.Close() }()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	log.Printf("[gmti-replay] target=%s period=%ds", target, periodS)

	t0 := time.Now()
	revisit := uint16(1)
	dwellIdx := uint16(0)

	tick := time.NewTicker(time.Duration(periodS) * time.Second)
	defer tick.Stop()
	for {
		select {
		case <-stop:
			return
		case <-tick.C:
		}

		elapsed := time.Since(t0).Seconds()
		// Three "vehicles" transiting different paths.
		t1Lat, t1Lon := offset(centerLat, centerLon, 1500*math.Sin(elapsed/30), 1500*math.Cos(elapsed/30))
		t2Lat, t2Lon := offset(centerLat, centerLon, 2500-elapsed*4, -2000+elapsed*3)
		t3Lat, t3Lon := offset(centerLat, centerLon, -800, 3000-elapsed*5)

		pkt := stanag4607.Packet{
			Header: stanag4607.PacketHeader{
				PacketID:             "12",
				PacketVersion:        "30",
				Nationality:          "XN",
				Classification:       5,
				ClassificationSystem: "NA",
				ExerciseIndicator:    1,
				PlatformID:           "RAT-31DL",
				MissionID:            42,
				JobID:                7,
			},
			Segments: []stanag4607.Segment{
				{Mission: &stanag4607.MissionSegment{
					MissionPlan:    "EXERCISE",
					FlightPlan:     "GROUND",
					PlatformType:   13,
					PlatformConfig: "ROMARM-A",
					ReferenceTime:  time.Now().UTC(),
				}},
				{Dwell: &stanag4607.DwellSegment{
					ExistenceMask:      stanag4607.WILLProfileMask,
					RevisitIndex:       revisit,
					DwellIndex:         dwellIdx,
					LastDwellOfRevisit: true,
					TargetReportCount:  3,
					DwellTimeMS:        uint32(time.Now().UTC().Unix() % 86400 * 1000),
					SensorLat:          centerLat,
					SensorLon:          centerLon,
					SensorAltCm:        50000,
					TargetReports: []stanag4607.TargetReport{
						{MTIReportIndex: 1, TargetLat: t1Lat, TargetLon: t1Lon, GeodeticHeightM: 480, LineOfSightVelMPS: 9.0 * math.Sin(elapsed/12), SignalToNoiseDB: 18, TargetClass: 2},
						{MTIReportIndex: 2, TargetLat: t2Lat, TargetLon: t2Lon, GeodeticHeightM: 470, LineOfSightVelMPS: 6.5, SignalToNoiseDB: 14, TargetClass: 5},
						{MTIReportIndex: 3, TargetLat: t3Lat, TargetLon: t3Lon, GeodeticHeightM: 510, LineOfSightVelMPS: -4.0, SignalToNoiseDB: 11, TargetClass: 7},
					},
				}},
			},
		}

		buf, err := stanag4607.Encode(pkt)
		if err != nil {
			log.Printf("[gmti-replay] encode: %v", err)
			continue
		}
		if _, err := conn.Write(buf); err != nil {
			log.Printf("[gmti-replay] write: %v", err)
			continue
		}
		dwellIdx++
		if dwellIdx > 16 {
			dwellIdx = 0
			revisit++
		}
	}
}
