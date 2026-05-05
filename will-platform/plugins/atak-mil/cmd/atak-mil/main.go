// atak-mil — Sprint 1 plugin.
//
// Listens for ATAK-MIL CoT XML on UDP, decodes it, transforms each event into
// a v0 track payload, and publishes onto the EMQX bus. Sprint 1 ships this
// as a UDP-side adapter; once gRPC SensorPlugin stubs are generated from the
// will.sensor.v1 contract, the same packages are wrapped in a gRPC server.
package main

import (
	"context"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"

	"github.com/will-platform/plugins/atak-mil/internal/cot"
	"github.com/will-platform/plugins/atak-mil/internal/forward"
)

const maxUDPPayload = 64 * 1024

func main() {
	listen := envOr("LISTEN_ADDR", "0.0.0.0:8087")
	tenantID := envOr("TENANT_ID", "00000000-0000-0000-0000-000000000001")
	classification := envOr("CLASSIFICATION", "NESECRET")
	sourcePrefix := envOr("SOURCE_PREFIX", "atak-mil")
	mqttURL := envOr("MQTT_URL", "tcp://emqx:1883")
	mqttTopic := envOr("MQTT_TOPIC", "telemetry/cot/atak-mil")

	opts := mqtt.NewClientOptions().
		AddBroker(mqttURL).
		SetClientID("atak-mil-" + sourcePrefix).
		SetAutoReconnect(true).
		SetConnectTimeout(10 * time.Second)
	client := mqtt.NewClient(opts)
	if tok := client.Connect(); tok.WaitTimeout(15*time.Second) && tok.Error() != nil {
		log.Fatalf("[atak-mil] mqtt connect: %v", tok.Error())
	}
	defer client.Disconnect(250)

	addr, err := net.ResolveUDPAddr("udp", listen)
	if err != nil {
		log.Fatalf("[atak-mil] resolve: %v", err)
	}
	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		log.Fatalf("[atak-mil] listen: %v", err)
	}
	defer func() { _ = conn.Close() }()

	log.Printf("[atak-mil] udp=%s mqtt=%s topic=%s tenant=%s class=%s",
		listen, mqttURL, mqttTopic, tenantID, classification)

	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		stop := make(chan os.Signal, 1)
		signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
		<-stop
		cancel()
		_ = conn.Close()
	}()

	buf := make([]byte, maxUDPPayload)
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}
		_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
		n, _, err := conn.ReadFromUDP(buf)
		if err != nil {
			if ne, ok := err.(net.Error); ok && ne.Timeout() {
				continue
			}
			if ctx.Err() != nil {
				return
			}
			log.Printf("[atak-mil] read: %v", err)
			continue
		}
		ev, err := cot.Decode(buf[:n])
		if err != nil {
			log.Printf("[atak-mil] decode: %v", err)
			continue
		}
		t := forward.FromCoT(ev, tenantID, classification, sourcePrefix)
		out, err := t.JSON()
		if err != nil {
			log.Printf("[atak-mil] marshal: %v", err)
			continue
		}
		if tok := client.Publish(mqttTopic, 0, false, out); tok.Wait() && tok.Error() != nil {
			log.Printf("[atak-mil] publish: %v", tok.Error())
		}
	}
}

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
