// mmpv90-naval — Rheinmetall MMPV-90 OPV / corvette ingest plugin (ADR-018).
//
// Phase 1 ingest-only. Three output topics keep operational and OSINT layers
// distinct (ADR-016):
//
//   - MQTT_TOPIC_OWNSHIP   (telemetry/bft/mmpv90)       — friendly own ship PLI
//   - MQTT_TOPIC_SENSOR    (telemetry/sensor/mmpv90)    — naval radar/EO/ESM detections
//   - MQTT_TOPIC_AIS_OSINT (telemetry/osint/mmpv90-ais) — AIS broadcasts, OSINT advisory
//
// Coordinator-only: no CMS replacement, no weapons direction, no sail orders.
// No outbound socket to the ship's combat-management or steering systems.
// Phase 2 (bidirectional) is blocked on Squad Alpha's Link-22 gateway.
package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"

	"github.com/will-platform/plugins/mmpv90-naval/internal/feed"
	"github.com/will-platform/plugins/mmpv90-naval/internal/sim"
	"github.com/will-platform/plugins/mmpv90-naval/internal/track"
)

func main() {
	mode := envOr("MODE", "sim")
	tenantID := envOr("TENANT_ID", "00000000-0000-0000-0000-000000000001")
	classification := envOr("CLASSIFICATION", "NESECRET")
	sourcePrefix := envOr("SOURCE_PREFIX", "mmpv90/F501")
	mqttURL := envOr("MQTT_URL", "tcp://emqx:1883")
	ownshipTopic := envOr("MQTT_TOPIC_OWNSHIP", "telemetry/bft/mmpv90")
	sensorTopic := envOr("MQTT_TOPIC_SENSOR", "telemetry/sensor/mmpv90")
	aisTopic := envOr("MQTT_TOPIC_AIS_OSINT", "telemetry/osint/mmpv90-ais")

	src, err := buildFeed(mode)
	if err != nil {
		log.Fatalf("[mmpv90-naval] feed init: %v", err)
	}

	opts := mqtt.NewClientOptions().
		AddBroker(mqttURL).
		SetClientID("mmpv90-naval-" + sourcePrefix).
		SetAutoReconnect(true).
		SetConnectTimeout(10 * time.Second)
	client := mqtt.NewClient(opts)
	if tok := client.Connect(); tok.WaitTimeout(15*time.Second) && tok.Error() != nil {
		log.Fatalf("[mmpv90-naval] mqtt connect: %v", tok.Error())
	}
	defer client.Disconnect(250)

	log.Printf("[mmpv90-naval] mode=%s mqtt=%s ownship=%s sensor=%s ais=%s tenant=%s class=%s source=%s",
		mode, mqttURL, ownshipTopic, sensorTopic, aisTopic, tenantID, classification, sourcePrefix)

	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		stop := make(chan os.Signal, 1)
		signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
		<-stop
		cancel()
	}()

	out := make(chan feed.Event, 256)
	go func() {
		if err := src.Run(ctx, out); err != nil && ctx.Err() == nil {
			log.Printf("[mmpv90-naval] feed stopped: %v", err)
			cancel()
		}
	}()

	for {
		select {
		case <-ctx.Done():
			log.Println("[mmpv90-naval] shutting down")
			return
		case ev := <-out:
			if ev.OwnShip != nil {
				publish(client, ownshipTopic, track.BuildOwnShip(*ev.OwnShip, tenantID, classification, sourcePrefix))
			}
			if ev.Detection != nil {
				publish(client, sensorTopic, track.BuildDetection(*ev.Detection, tenantID, classification, sourcePrefix))
			}
			if ev.AIS != nil {
				// BuildAISContact forces the OSINT caveat regardless of base.
				publish(client, aisTopic, track.BuildAISContact(*ev.AIS, tenantID, classification, sourcePrefix))
			}
		}
	}
}

func publish(client mqtt.Client, topic string, tr track.Track) {
	payload, err := tr.JSON()
	if err != nil {
		log.Printf("[mmpv90-naval] marshal: %v", err)
		return
	}
	if tok := client.Publish(topic, 0, false, payload); tok.Wait() && tok.Error() != nil {
		log.Printf("[mmpv90-naval] publish: %v", tok.Error())
	}
}

func buildFeed(mode string) (feed.Feed, error) {
	switch mode {
	case "sim", "":
		cfg := sim.Default()
		if v := os.Getenv("SIM_HULL_ID"); v != "" {
			cfg.HullID = v
		}
		if v := os.Getenv("SIM_PENNANT"); v != "" {
			cfg.Pennant = v
		}
		if v := os.Getenv("SIM_START_LAT"); v != "" {
			if f, err := strconv.ParseFloat(v, 64); err == nil {
				cfg.StartLat = f
			}
		}
		if v := os.Getenv("SIM_START_LON"); v != "" {
			if f, err := strconv.ParseFloat(v, 64); err == nil {
				cfg.StartLon = f
			}
		}
		if v := os.Getenv("SIM_HEADING_DEG"); v != "" {
			if f, err := strconv.ParseFloat(v, 64); err == nil {
				cfg.HeadingDeg = f
			}
		}
		if v := os.Getenv("SIM_CRUISE_MPS"); v != "" {
			if f, err := strconv.ParseFloat(v, 64); err == nil {
				cfg.CruiseSpeedMps = f
			}
		}
		return sim.New(cfg), nil
	case "vendor":
		log.Println("[mmpv90-naval] MODE=vendor selected but the Rheinmetall CMS adapter is a Phase 1 follow-up (ADR-018); falling back to sim")
		return sim.New(sim.Default()), nil
	case "link22":
		log.Println("[mmpv90-naval] MODE=link22 is Phase 2; blocked on Squad Alpha Link-22 gateway. Falling back to sim.")
		return sim.New(sim.Default()), nil
	default:
		return nil, errBadMode(mode)
	}
}

type errBadMode string

func (e errBadMode) Error() string { return "unknown MODE=" + string(e) }

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
