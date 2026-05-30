// lynx-ifv — Rheinmetall Lynx KF41 IFV ingest plugin (ADR-018).
//
// Friendly tracked-IFV PLI + vehicle health summary to the bus
// (telemetry/bft/lynx). Coordinator-only: no turret control, no fire-control
// access, no ammunition release — Build is the only exported track-producer,
// and the binary has no outbound socket to the vehicle bus or to the FCS.
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

	"github.com/will-platform/plugins/lynx-ifv/internal/feed"
	"github.com/will-platform/plugins/lynx-ifv/internal/sim"
	"github.com/will-platform/plugins/lynx-ifv/internal/track"
)

func main() {
	mode := envOr("MODE", "sim")
	tenantID := envOr("TENANT_ID", "00000000-0000-0000-0000-000000000001")
	classification := envOr("CLASSIFICATION", "NESECRET")
	sourcePrefix := envOr("SOURCE_PREFIX", "lynx/btn-1")
	mqttURL := envOr("MQTT_URL", "tcp://emqx:1883")
	mqttTopic := envOr("MQTT_TOPIC", "telemetry/bft/lynx")

	src, err := buildFeed(mode)
	if err != nil {
		log.Fatalf("[lynx-ifv] feed init: %v", err)
	}

	opts := mqtt.NewClientOptions().
		AddBroker(mqttURL).
		SetClientID("lynx-ifv-" + sourcePrefix).
		SetAutoReconnect(true).
		SetConnectTimeout(10 * time.Second)
	client := mqtt.NewClient(opts)
	if tok := client.Connect(); tok.WaitTimeout(15*time.Second) && tok.Error() != nil {
		log.Fatalf("[lynx-ifv] mqtt connect: %v", tok.Error())
	}
	defer client.Disconnect(250)

	log.Printf("[lynx-ifv] mode=%s mqtt=%s topic=%s tenant=%s class=%s source=%s",
		mode, mqttURL, mqttTopic, tenantID, classification, sourcePrefix)

	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		stop := make(chan os.Signal, 1)
		signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
		<-stop
		cancel()
	}()

	out := make(chan track.PlatformPLI, 256)
	go func() {
		if err := src.Run(ctx, out); err != nil && ctx.Err() == nil {
			log.Printf("[lynx-ifv] feed stopped: %v", err)
			cancel()
		}
	}()

	for {
		select {
		case <-ctx.Done():
			log.Println("[lynx-ifv] shutting down")
			return
		case p := <-out:
			tr := track.Build(p, tenantID, classification, sourcePrefix)
			payload, err := tr.JSON()
			if err != nil {
				log.Printf("[lynx-ifv] marshal: %v", err)
				continue
			}
			if tok := client.Publish(mqttTopic, 0, false, payload); tok.Wait() && tok.Error() != nil {
				log.Printf("[lynx-ifv] publish: %v", tok.Error())
			}
		}
	}
}

func buildFeed(mode string) (feed.Feed, error) {
	switch mode {
	case "sim", "":
		cfg := sim.Default()
		if v := os.Getenv("SIM_UNIT_PREFIX"); v != "" {
			cfg.UnitPrefix = v
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
		if v := os.Getenv("SIM_MARCH_SPEED_MPS"); v != "" {
			if f, err := strconv.ParseFloat(v, 64); err == nil {
				cfg.MarchSpeedMps = f
			}
		}
		if v := os.Getenv("SIM_VEHICLES"); v != "" {
			if n, err := strconv.Atoi(v); err == nil && n > 0 {
				cfg.Vehicles = n
			}
		}
		return sim.New(cfg), nil
	case "vehicle-bus":
		log.Println("[lynx-ifv] MODE=vehicle-bus selected but the Rheinmetall vehicle-bus adapter is a follow-up (ADR-018); falling back to sim")
		return sim.New(sim.Default()), nil
	case "cot":
		log.Println("[lynx-ifv] MODE=cot selected but the crew-tablet CoT adapter is a follow-up (ADR-018); falling back to sim")
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
