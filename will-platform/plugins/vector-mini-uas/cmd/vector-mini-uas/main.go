// vector-mini-uas — Quantum Systems Vector / Scorpion Class I Mini UAS
// ingest plugin (ADR-018).
//
// Vector is a friendly ISR asset, so this plugin publishes friendly air
// PLI to the bus (will.track.v0). Coordinator discipline: no flight tasking
// from WILL — no Engage/Task/Command surface, no outbound socket to the GCS.
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

	"github.com/will-platform/plugins/vector-mini-uas/internal/feed"
	"github.com/will-platform/plugins/vector-mini-uas/internal/sim"
	"github.com/will-platform/plugins/vector-mini-uas/internal/track"
)

func main() {
	mode := envOr("MODE", "sim")
	tenantID := envOr("TENANT_ID", "00000000-0000-0000-0000-000000000001")
	classification := envOr("CLASSIFICATION", "NESECRET")
	sourcePrefix := envOr("SOURCE_PREFIX", "vector/gcs-1")
	mqttURL := envOr("MQTT_URL", "tcp://emqx:1883")
	mqttTopic := envOr("MQTT_TOPIC", "telemetry/uas/vector")

	src, err := buildFeed(mode)
	if err != nil {
		log.Fatalf("[vector-mini-uas] feed init: %v", err)
	}

	opts := mqtt.NewClientOptions().
		AddBroker(mqttURL).
		SetClientID("vector-mini-uas-" + sourcePrefix).
		SetAutoReconnect(true).
		SetConnectTimeout(10 * time.Second)
	client := mqtt.NewClient(opts)
	if tok := client.Connect(); tok.WaitTimeout(15*time.Second) && tok.Error() != nil {
		log.Fatalf("[vector-mini-uas] mqtt connect: %v", tok.Error())
	}
	defer client.Disconnect(250)

	log.Printf("[vector-mini-uas] mode=%s mqtt=%s topic=%s tenant=%s class=%s source=%s",
		mode, mqttURL, mqttTopic, tenantID, classification, sourcePrefix)

	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		stop := make(chan os.Signal, 1)
		signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
		<-stop
		cancel()
	}()

	out := make(chan track.Telemetry, 128)
	go func() {
		if err := src.Run(ctx, out); err != nil && ctx.Err() == nil {
			log.Printf("[vector-mini-uas] feed stopped: %v", err)
			cancel()
		}
	}()

	for {
		select {
		case <-ctx.Done():
			log.Println("[vector-mini-uas] shutting down")
			return
		case tl := <-out:
			tr := track.Build(tl, tenantID, classification, sourcePrefix)
			payload, err := tr.JSON()
			if err != nil {
				log.Printf("[vector-mini-uas] marshal: %v", err)
				continue
			}
			if tok := client.Publish(mqttTopic, 0, false, payload); tok.Wait() && tok.Error() != nil {
				log.Printf("[vector-mini-uas] publish: %v", tok.Error())
			}
		}
	}
}

func buildFeed(mode string) (feed.Feed, error) {
	switch mode {
	case "sim", "":
		cfg := sim.Default()
		if v := os.Getenv("SIM_UNIT_ID"); v != "" {
			cfg.UnitID = v
		}
		if v := os.Getenv("SIM_VARIANT"); v != "" {
			cfg.Variant = v
		}
		if v := os.Getenv("SIM_ORBIT_LAT"); v != "" {
			if f, err := strconv.ParseFloat(v, 64); err == nil {
				cfg.OrbitCenterLat = f
			}
		}
		if v := os.Getenv("SIM_ORBIT_LON"); v != "" {
			if f, err := strconv.ParseFloat(v, 64); err == nil {
				cfg.OrbitCenterLon = f
			}
		}
		if v := os.Getenv("SIM_ORBIT_RADIUS_M"); v != "" {
			if f, err := strconv.ParseFloat(v, 64); err == nil {
				cfg.OrbitRadiusM = f
			}
		}
		if v := os.Getenv("SIM_VIDEO_URL"); v != "" {
			cfg.VideoURL = v
		}
		return sim.New(cfg), nil
	case "mavlink":
		log.Println("[vector-mini-uas] MODE=mavlink selected but the MAVLink adapter is a follow-up (ADR-018); falling back to sim")
		return sim.New(sim.Default()), nil
	case "quantum":
		log.Println("[vector-mini-uas] MODE=quantum selected but the QBase SDK adapter is a follow-up (ADR-018); falling back to sim")
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
