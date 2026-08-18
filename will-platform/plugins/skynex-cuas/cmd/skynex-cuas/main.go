// skynex-cuas — Rheinmetall Skynex C-RAM / C-UAS ingest plugin (ADR-018).
//
// Coordinator discipline: ingest-only. WILL never tasks Skynex; engagement
// remains the vendor fire-control's responsibility. This binary has no
// outbound socket to Skynex and no Engage/Task entry point.
//
// Modes:
//   - sim:    deterministic synthetic UAS approach scenario (dev / HIL)
//   - vendor: real Rheinmetall feed adapter (TODO — ADR-018 follow-up; blocked
//     on protocol access from the vendor)
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

	"github.com/will-platform/plugins/skynex-cuas/internal/feed"
	"github.com/will-platform/plugins/skynex-cuas/internal/sim"
	"github.com/will-platform/plugins/skynex-cuas/internal/track"
)

func main() {
	mode := envOr("MODE", "sim")
	tenantID := envOr("TENANT_ID", "00000000-0000-0000-0000-000000000001")
	classification := envOr("CLASSIFICATION", "NESECRET")
	sourcePrefix := envOr("SOURCE_PREFIX", "skynex/battery-1")
	mqttURL := envOr("MQTT_URL", "tcp://emqx:1883")
	mqttTopic := envOr("MQTT_TOPIC", "telemetry/cuas/skynex")

	src, err := buildFeed(mode)
	if err != nil {
		log.Fatalf("[skynex-cuas] feed init: %v", err)
	}

	opts := mqtt.NewClientOptions().
		AddBroker(mqttURL).
		SetClientID("skynex-cuas-" + sourcePrefix).
		SetAutoReconnect(true).
		SetConnectTimeout(10 * time.Second)
	client := mqtt.NewClient(opts)
	if tok := client.Connect(); tok.WaitTimeout(15*time.Second) && tok.Error() != nil {
		log.Fatalf("[skynex-cuas] mqtt connect: %v", tok.Error())
	}
	defer client.Disconnect(250)

	log.Printf("[skynex-cuas] mode=%s mqtt=%s topic=%s tenant=%s class=%s source=%s",
		mode, mqttURL, mqttTopic, tenantID, classification, sourcePrefix)

	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		stop := make(chan os.Signal, 1)
		signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
		<-stop
		cancel()
	}()

	out := make(chan track.Detection, 128)
	go func() {
		if err := src.Run(ctx, out); err != nil && ctx.Err() == nil {
			log.Printf("[skynex-cuas] feed stopped: %v", err)
			cancel()
		}
	}()

	for {
		select {
		case <-ctx.Done():
			log.Println("[skynex-cuas] shutting down")
			return
		case d := <-out:
			tr := track.Build(d, tenantID, classification, sourcePrefix)
			payload, err := tr.JSON()
			if err != nil {
				log.Printf("[skynex-cuas] marshal: %v", err)
				continue
			}
			if tok := client.Publish(mqttTopic, 0, false, payload); tok.Wait() && tok.Error() != nil {
				log.Printf("[skynex-cuas] publish: %v", tok.Error())
			}
		}
	}
}

func buildFeed(mode string) (feed.Feed, error) {
	switch mode {
	case "sim", "":
		cfg := sim.Default()
		if v := os.Getenv("SIM_NUM_TRACKS"); v != "" {
			if n, err := strconv.Atoi(v); err == nil && n > 0 {
				cfg.NumTracks = n
			}
		}
		if v := os.Getenv("SIM_PERIOD_S"); v != "" {
			if f, err := strconv.ParseFloat(v, 64); err == nil && f > 0 {
				cfg.PeriodS = time.Duration(f * float64(time.Second))
			}
		}
		if v := os.Getenv("SIM_BATTERY_LAT"); v != "" {
			if f, err := strconv.ParseFloat(v, 64); err == nil {
				cfg.BatteryLat = f
			}
		}
		if v := os.Getenv("SIM_BATTERY_LON"); v != "" {
			if f, err := strconv.ParseFloat(v, 64); err == nil {
				cfg.BatteryLon = f
			}
		}
		return sim.New(cfg), nil
	case "vendor":
		log.Println("[skynex-cuas] MODE=vendor selected but the Rheinmetall adapter is a follow-up (ADR-018); falling back to sim")
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
