// merops-osint — US MEROPS AI-powered counter-drone advisory feed plugin (ADR-018).
//
// MEROPS is a US-supplied asset (US Counter-UAS Marketplace), not a SAFE
// contract; Romania consumes its feed as ADVISORY OSINT per ADR-016.
// Every track this plugin publishes carries a forced "<base> // OSINT"
// classification and metadata.osint=true, confidence=low, never auto-fused
// with the operational C-UAS picture.
//
// Coordinator discipline: no Engage/Task/Command surface; MEROPS reports
// engagement outcomes (jamming, kinetic, neutralised) which WILL records as
// metadata only — WILL never actuates MEROPS.
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

	"github.com/will-platform/plugins/merops-osint/internal/feed"
	"github.com/will-platform/plugins/merops-osint/internal/sim"
	"github.com/will-platform/plugins/merops-osint/internal/track"
)

func main() {
	mode := envOr("MODE", "sim")
	tenantID := envOr("TENANT_ID", "00000000-0000-0000-0000-000000000001")
	classification := envOr("CLASSIFICATION", "NESECRET")
	sourcePrefix := envOr("SOURCE_PREFIX", "merops/site-1")
	mqttURL := envOr("MQTT_URL", "tcp://emqx:1883")
	mqttTopic := envOr("MQTT_TOPIC", "telemetry/osint/merops")

	src, err := buildFeed(mode)
	if err != nil {
		log.Fatalf("[merops-osint] feed init: %v", err)
	}

	opts := mqtt.NewClientOptions().
		AddBroker(mqttURL).
		SetClientID("merops-osint-" + sourcePrefix).
		SetAutoReconnect(true).
		SetConnectTimeout(10 * time.Second)
	client := mqtt.NewClient(opts)
	if tok := client.Connect(); tok.WaitTimeout(15*time.Second) && tok.Error() != nil {
		log.Fatalf("[merops-osint] mqtt connect: %v", tok.Error())
	}
	defer client.Disconnect(250)

	log.Printf("[merops-osint] mode=%s mqtt=%s topic=%s tenant=%s class=%s source=%s",
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
			log.Printf("[merops-osint] feed stopped: %v", err)
			cancel()
		}
	}()

	for {
		select {
		case <-ctx.Done():
			log.Println("[merops-osint] shutting down")
			return
		case d := <-out:
			tr := track.Build(d, tenantID, classification, sourcePrefix)
			payload, err := tr.JSON()
			if err != nil {
				log.Printf("[merops-osint] marshal: %v", err)
				continue
			}
			if tok := client.Publish(mqttTopic, 0, false, payload); tok.Wait() && tok.Error() != nil {
				log.Printf("[merops-osint] publish: %v", tok.Error())
			}
		}
	}
}

func buildFeed(mode string) (feed.Feed, error) {
	switch mode {
	case "sim", "":
		cfg := sim.Default()
		if v := os.Getenv("SIM_SITE_LAT"); v != "" {
			if f, err := strconv.ParseFloat(v, 64); err == nil {
				cfg.SiteLat = f
			}
		}
		if v := os.Getenv("SIM_SITE_LON"); v != "" {
			if f, err := strconv.ParseFloat(v, 64); err == nil {
				cfg.SiteLon = f
			}
		}
		if v := os.Getenv("SIM_THREAT_BEARING_DEG"); v != "" {
			if f, err := strconv.ParseFloat(v, 64); err == nil {
				cfg.BearingDeg = f
			}
		}
		if v := os.Getenv("SIM_THREAT_RANGE_M"); v != "" {
			if f, err := strconv.ParseFloat(v, 64); err == nil {
				cfg.StartRangeM = f
			}
		}
		if v := os.Getenv("SIM_AI_CLASSIFIER"); v != "" {
			cfg.AIClassifier = v
		}
		return sim.New(cfg), nil
	case "marketplace":
		log.Println("[merops-osint] MODE=marketplace selected but the US Counter-UAS Marketplace adapter is a follow-up (ADR-018); falling back to sim")
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
