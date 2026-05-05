// gmti — Sprint 3 plugin.
//
// Listens for STANAG 4607 (NATO GMTI) packets on UDP, decodes the WILL
// minimal profile (Mission + Dwell with a fixed existence mask), and
// publishes one v0 Track per target report onto EMQX.
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

	"github.com/will-platform/plugins/gmti/internal/forward"
	"github.com/will-platform/plugins/gmti/internal/stanag4607"
)

const maxUDPPayload = 64 * 1024

func main() {
	listen := envOr("LISTEN_ADDR", "0.0.0.0:8190")
	tenantID := envOr("TENANT_ID", "00000000-0000-0000-0000-000000000001")
	classification := envOr("CLASSIFICATION", "NESECRET")
	mqttURL := envOr("MQTT_URL", "tcp://emqx:1883")
	mqttTopicPrefix := envOr("MQTT_TOPIC_PREFIX", "telemetry/gmti")

	opts := mqtt.NewClientOptions().
		AddBroker(mqttURL).
		SetClientID("gmti-plugin").
		SetAutoReconnect(true).
		SetConnectTimeout(10 * time.Second)
	client := mqtt.NewClient(opts)
	if tok := client.Connect(); tok.WaitTimeout(15*time.Second) && tok.Error() != nil {
		log.Fatalf("[gmti] mqtt connect: %v", tok.Error())
	}
	defer client.Disconnect(250)

	addr, err := net.ResolveUDPAddr("udp", listen)
	if err != nil {
		log.Fatalf("[gmti] resolve: %v", err)
	}
	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		log.Fatalf("[gmti] listen: %v", err)
	}
	defer func() { _ = conn.Close() }()

	log.Printf("[gmti] udp=%s mqtt=%s topic=%s tenant=%s", listen, mqttURL, mqttTopicPrefix, tenantID)

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
			log.Printf("[gmti] read: %v", err)
			continue
		}
		pkt, err := stanag4607.Decode(buf[:n])
		if err != nil {
			log.Printf("[gmti] decode: %v", err)
			continue
		}
		published := 0
		for _, seg := range pkt.Segments {
			if seg.Dwell == nil {
				continue
			}
			topic := mqttTopicPrefix + "/job" + jobSuffix(pkt.Header.JobID)
			for _, tr := range seg.Dwell.TargetReports {
				track := forward.FromTargetReport(pkt, *seg.Dwell, tr, tenantID, classification)
				out, err := track.JSON()
				if err != nil {
					log.Printf("[gmti] marshal: %v", err)
					continue
				}
				if tok := client.Publish(topic, 0, false, out); tok.Wait() && tok.Error() != nil {
					log.Printf("[gmti] publish: %v", tok.Error())
					continue
				}
				published++
			}
		}
		if published > 0 {
			log.Printf("[gmti] published %d tracks from packet platform=%q job=%d", published, pkt.Header.PlatformID, pkt.Header.JobID)
		}
	}
}

func jobSuffix(j uint32) string {
	const digits = "0123456789"
	if j == 0 {
		return "0"
	}
	out := []byte{}
	for j > 0 {
		out = append([]byte{digits[j%10]}, out...)
		j /= 10
	}
	return string(out)
}

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
