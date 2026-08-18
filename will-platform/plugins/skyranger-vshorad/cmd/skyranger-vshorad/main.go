// skyranger-vshorad — Rheinmetall Skyranger 35 mobile VSHORAD ingest plugin (ADR-018).
//
// The plugin publishes two will.track.v0 streams to the bus:
//   - hostile UAS/RAM detections from the Skyranger's radar
//   - the mount's own friendly platform PLI (mobile VSHORAD position)
//
// Coordinator discipline: ingest-only. No Engage/Task surface; no outbound
// socket to the mount; engagement remains the vendor fire-control's
// responsibility.
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

	"github.com/will-platform/plugins/skyranger-vshorad/internal/feed"
	"github.com/will-platform/plugins/skyranger-vshorad/internal/sim"
	"github.com/will-platform/plugins/skyranger-vshorad/internal/track"
)

func main() {
	mode := envOr("MODE", "sim")
	tenantID := envOr("TENANT_ID", "00000000-0000-0000-0000-000000000001")
	classification := envOr("CLASSIFICATION", "NESECRET")
	sourcePrefix := envOr("SOURCE_PREFIX", "skyranger/A1")
	mqttURL := envOr("MQTT_URL", "tcp://emqx:1883")
	detTopic := envOr("MQTT_TOPIC_DETECTIONS", "telemetry/cuas/skyranger")
	platTopic := envOr("MQTT_TOPIC_PLATFORM", "telemetry/bft/skyranger")

	src, err := buildFeed(mode)
	if err != nil {
		log.Fatalf("[skyranger-vshorad] feed init: %v", err)
	}

	opts := mqtt.NewClientOptions().
		AddBroker(mqttURL).
		SetClientID("skyranger-vshorad-" + sourcePrefix).
		SetAutoReconnect(true).
		SetConnectTimeout(10 * time.Second)
	client := mqtt.NewClient(opts)
	if tok := client.Connect(); tok.WaitTimeout(15*time.Second) && tok.Error() != nil {
		log.Fatalf("[skyranger-vshorad] mqtt connect: %v", tok.Error())
	}
	defer client.Disconnect(250)

	log.Printf("[skyranger-vshorad] mode=%s mqtt=%s det=%s plat=%s tenant=%s class=%s source=%s",
		mode, mqttURL, detTopic, platTopic, tenantID, classification, sourcePrefix)

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
			log.Printf("[skyranger-vshorad] feed stopped: %v", err)
			cancel()
		}
	}()

	for {
		select {
		case <-ctx.Done():
			log.Println("[skyranger-vshorad] shutting down")
			return
		case ev := <-out:
			if ev.Detection != nil {
				publish(client, detTopic, track.Build(*ev.Detection, tenantID, classification, sourcePrefix))
			}
			if ev.Platform != nil {
				publish(client, platTopic, track.BuildPlatform(*ev.Platform, tenantID, classification, sourcePrefix))
			}
		}
	}
}

func publish(client mqtt.Client, topic string, tr track.Track) {
	payload, err := tr.JSON()
	if err != nil {
		log.Printf("[skyranger-vshorad] marshal: %v", err)
		return
	}
	if tok := client.Publish(topic, 0, false, payload); tok.Wait() && tok.Error() != nil {
		log.Printf("[skyranger-vshorad] publish: %v", tok.Error())
	}
}

func buildFeed(mode string) (feed.Feed, error) {
	switch mode {
	case "sim", "":
		cfg := sim.Default()
		if v := os.Getenv("SIM_UNIT_ID"); v != "" {
			cfg.UnitID = v
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
		if v := os.Getenv("SIM_PATROL_SPEED_MPS"); v != "" {
			if f, err := strconv.ParseFloat(v, 64); err == nil {
				cfg.PatrolSpeedMps = f
			}
		}
		if v := os.Getenv("SIM_NUM_TRACKS"); v != "" {
			if n, err := strconv.Atoi(v); err == nil && n > 0 {
				cfg.NumTracks = n
			}
		}
		return sim.New(cfg), nil
	case "vendor":
		log.Println("[skyranger-vshorad] MODE=vendor selected but the Rheinmetall adapter is a follow-up (ADR-018); falling back to sim")
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
