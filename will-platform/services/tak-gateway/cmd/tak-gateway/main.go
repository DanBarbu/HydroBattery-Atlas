// tak-gateway — bidirectional, classification-gated TAK Server bridge (ADR-017).
//
// Ingress: TAK Server (CoT over mTLS) -> will.track.v0 on the bus, treating TAK
// as a sensor source. Egress: will.track.v0 -> CoT to TAK, but only through the
// classification ceiling gate (fail-closed). No tasking path exists.
//
// The bridge will not open a TAK socket unless BOTH gates pass:
//  1. the install/first-run opt-out decision is "enabled" (operator authorised), and
//  2. the ADR-017 co-sign acknowledgement is set (governance: Tech Lead +
//     Compliance + Security have signed off for this deployment).
//
// While either gate is unmet, the service runs healthz + the decision API only.
package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"

	"github.com/will-platform/tak-gateway/internal/cot"
	"github.com/will-platform/tak-gateway/internal/decision"
	"github.com/will-platform/tak-gateway/internal/egress"
	"github.com/will-platform/tak-gateway/internal/forward"
	"github.com/will-platform/tak-gateway/internal/tak"
)

func main() {
	cfg := loadConfig()

	// Apply a non-interactive seed (unattended installs) only on fresh install.
	if cfg.seedDecision != "" {
		if r, err := decision.Seed(cfg.decisionFile, decision.State(cfg.seedDecision),
			"unattended-install", "TAK_DECISION env seed"); err != nil {
			log.Printf("[tak-gateway] decision seed ignored: %v", err)
		} else {
			log.Printf("[tak-gateway] decision after seed: %s", r.State)
		}
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	srv := &http.Server{
		Addr:              cfg.httpAddr,
		Handler:           newHandler(cfg),
		ReadHeaderTimeout: 5 * time.Second,
	}
	go func() {
		log.Printf("[tak-gateway] http listening on %s (ADR-017, status API)", cfg.httpAddr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[tak-gateway] http: %v", err)
		}
	}()

	if ok, why := cfg.bridgeAllowed(); ok {
		go runBridge(ctx, cfg)
	} else {
		log.Printf("[tak-gateway] TAK bridge NOT started: %s", why)
		log.Printf("[tak-gateway] no TAK socket will be opened; serving status API only")
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
	log.Println("[tak-gateway] shutting down")
	cancel()
	shutCtx, shutCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutCancel()
	_ = srv.Shutdown(shutCtx)
}

// runBridge wires MQTT <-> TAK once both gates have passed.
func runBridge(ctx context.Context, cfg config) {
	opts := mqtt.NewClientOptions().
		AddBroker(cfg.mqttURL).
		SetClientID("tak-gateway").
		SetAutoReconnect(true).
		SetConnectTimeout(10 * time.Second)
	client := mqtt.NewClient(opts)
	if tok := client.Connect(); tok.WaitTimeout(15*time.Second) && tok.Error() != nil {
		log.Fatalf("[tak-gateway] mqtt connect: %v", tok.Error())
	}
	defer client.Disconnect(250)

	// Ingress: TAK CoT -> will.track.v0 on the bus.
	takClient := tak.New(cfg.takConfig(), func(ev cot.Event) {
		t := forward.FromCoT(ev, cfg.tenantID, cfg.ingressClass, "tak")
		out, err := t.JSON()
		if err != nil {
			log.Printf("[tak-gateway] ingress marshal: %v", err)
			return
		}
		if tok := client.Publish(cfg.ingressTopic, 0, false, out); tok.Wait() && tok.Error() != nil {
			log.Printf("[tak-gateway] ingress publish: %v", tok.Error())
		}
	})

	// Egress: will.track.v0 -> gated CoT -> TAK.
	if cfg.egressEnabled {
		policy := egress.Policy{Ceiling: cfg.egressCeiling, AllowOSINT: cfg.egressAllowOSINT}
		handler := func(_ mqtt.Client, m mqtt.Message) {
			t, err := forward.ParseTrack(m.Payload())
			if err != nil {
				return
			}
			if strings.HasPrefix(t.Source, "tak/") { // never re-egress our own ingress
				return
			}
			if d := policy.Decide(t); !d.Allowed {
				log.Printf("[tak-gateway] egress DROP track=%s class=%q: %s", t.TrackID, t.Classification, d.Reason)
				return
			}
			ev, err := forward.ToCoT(t)
			if err != nil {
				return
			}
			doc, err := ev.Encode()
			if err != nil {
				return
			}
			if !takClient.Egress(doc) {
				log.Printf("[tak-gateway] egress buffer full, dropped track=%s", t.TrackID)
			}
		}
		if tok := client.Subscribe(cfg.egressTopic, 0, handler); tok.Wait() && tok.Error() != nil {
			log.Fatalf("[tak-gateway] egress subscribe: %v", tok.Error())
		}
		log.Printf("[tak-gateway] egress ENABLED topic=%s ceiling=%s osint=%v",
			cfg.egressTopic, cfg.egressCeiling, cfg.egressAllowOSINT)
	} else {
		log.Printf("[tak-gateway] egress disabled (ingress-only)")
	}

	if err := takClient.Run(ctx); err != nil && ctx.Err() == nil {
		log.Printf("[tak-gateway] tak client stopped: %v", err)
	}
}

// --- config ---

type config struct {
	httpAddr     string
	tenantID     string
	decisionFile string
	seedDecision string
	cosignAck    bool

	takAddr      string
	tlsCert      string
	tlsKey       string
	tlsCA        string
	ingressClass string

	mqttURL      string
	ingressTopic string

	egressEnabled    bool
	egressTopic      string
	egressCeiling    string
	egressAllowOSINT bool
}

func loadConfig() config {
	return config{
		httpAddr:     envOr("HTTP_ADDR", ":8092"),
		tenantID:     envOr("TENANT_ID", "00000000-0000-0000-0000-000000000001"),
		decisionFile: envOr("TAK_DECISION_FILE", "/var/lib/will/tak-gateway/decision.json"),
		seedDecision: os.Getenv("TAK_DECISION"),
		cosignAck:    envBool("TAK_COSIGN_ACK", false),

		takAddr:      os.Getenv("TAK_SERVER_ADDR"),
		tlsCert:      envOr("TAK_TLS_CERT", "/etc/will/tls/tak-client.crt"),
		tlsKey:       envOr("TAK_TLS_KEY", "/etc/will/tls/tak-client.key"),
		tlsCA:        envOr("TAK_TLS_CA", "/etc/will/tls/tak-ca.crt"),
		ingressClass: envOr("INGRESS_CLASSIFICATION", "NESECRET"),

		mqttURL:      envOr("MQTT_URL", "tcp://emqx:1883"),
		ingressTopic: envOr("MQTT_INGRESS_TOPIC", "telemetry/tak/ingress"),

		egressEnabled:    envBool("EGRESS_ENABLED", false),
		egressTopic:      envOr("EGRESS_SUBSCRIBE_TOPIC", "telemetry/#"),
		egressCeiling:    envOr("EGRESS_CEILING", "NESECRET"),
		egressAllowOSINT: envBool("EGRESS_ALLOW_OSINT", false),
	}
}

func (c config) takConfig() tak.Config {
	return tak.Config{Addr: c.takAddr, CertPath: c.tlsCert, KeyPath: c.tlsKey, CAPath: c.tlsCA}
}

// bridgeAllowed reports whether both the operator decision gate and the
// governance co-sign gate permit opening a TAK socket.
func (c config) bridgeAllowed() (bool, string) {
	rec, err := decision.Load(c.decisionFile)
	if err != nil {
		return false, "decision file unreadable: " + err.Error()
	}
	switch rec.State {
	case decision.StatePending:
		return false, "install/first-run decision pending — operator must enable or opt out via POST /decision"
	case decision.StateOptedOut:
		return false, "operator opted out of TAK integration"
	}
	if !c.cosignAck {
		return false, "ADR-017 co-sign not acknowledged (set TAK_COSIGN_ACK=true once Tech Lead + Compliance + Security sign off)"
	}
	if strings.TrimSpace(c.takAddr) == "" {
		return false, "TAK_SERVER_ADDR not configured"
	}
	return true, ""
}

// --- http ---

func newHandler(cfg config) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		ok, why := cfg.bridgeAllowed()
		writeJSON(w, http.StatusOK, map[string]any{
			"status":         "ok",
			"component":      "tak-gateway",
			"mode":           "tak-bridge",
			"bridge_running": ok,
			"bridge_reason":  why,
		})
	})
	mux.HandleFunc("/decision", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			rec, err := decision.Load(cfg.decisionFile)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, rec)
		case http.MethodPost:
			var body struct {
				Decision string `json:"decision"`
				Operator string `json:"operator"`
				Reason   string `json:"reason"`
			}
			if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10)).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			rec, err := decision.RecordDecision(cfg.decisionFile,
				decision.State(body.Decision), body.Operator, body.Reason)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
				return
			}
			log.Printf("[tak-gateway] decision recorded: state=%s operator=%q", rec.State, rec.Operator)
			writeJSON(w, http.StatusOK, map[string]any{
				"recorded": rec,
				"note":     "restart the tak-gateway for the change to take effect",
			})
		default:
			w.Header().Set("Allow", "GET, POST")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})
	return mux
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func envBool(k string, def bool) bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv(k)))
	switch v {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return def
	}
}
