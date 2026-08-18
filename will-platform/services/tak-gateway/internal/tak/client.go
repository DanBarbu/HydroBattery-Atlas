// Package tak is a bidirectional CoT-over-TLS streaming client for a
// customer-operated TAK Server (ADR-017). It connects as an enrolled TAK
// streaming client with mutual-TLS, decodes inbound CoT (ingress), and writes
// gated CoT outbound (egress).
//
// TLS verification is mandatory: there is no insecure-skip option. TAK
// Protocol v1 (length-prefixed protobuf) and Federation Hub federate topology
// are declared follow-ups (ADR-017a) and are not implemented here.
package tak

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"time"

	"github.com/will-platform/tak-gateway/internal/cot"
)

// Config describes the TAK Server endpoint and the mutual-TLS material. Cert
// paths are mounted from the KMS/Vault path in production; never committed.
type Config struct {
	Addr     string // host:port of the TAK Server CoT-TLS streaming port
	CertPath string // client enrollment certificate (PEM)
	KeyPath  string // client private key (PEM)
	CAPath   string // trust anchor for the TAK Server certificate (PEM)
}

// Client maintains a reconnecting bidirectional CoT stream.
type Client struct {
	cfg     Config
	onEvent func(cot.Event)
	out     chan []byte
}

func New(cfg Config, onEvent func(cot.Event)) *Client {
	return &Client{cfg: cfg, onEvent: onEvent, out: make(chan []byte, 256)}
}

// Egress enqueues a pre-encoded CoT document for transmission. It drops on a
// full buffer rather than blocking the bus consumer.
func (c *Client) Egress(doc []byte) bool {
	select {
	case c.out <- doc:
		return true
	default:
		return false
	}
}

// Run connects and serves until ctx is cancelled, reconnecting with capped
// exponential backoff.
func (c *Client) Run(ctx context.Context) error {
	tlsCfg, err := c.tlsConfig()
	if err != nil {
		return fmt.Errorf("tak: tls config: %w", err)
	}
	backoff := time.Second
	const maxBackoff = 30 * time.Second
	for {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if err := c.session(ctx, tlsCfg); err != nil && ctx.Err() == nil {
			log.Printf("[tak-gateway] session ended: %v; reconnecting in %s", err, backoff)
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(backoff):
			}
			if backoff *= 2; backoff > maxBackoff {
				backoff = maxBackoff
			}
			continue
		}
		backoff = time.Second
	}
}

func (c *Client) session(ctx context.Context, tlsCfg *tls.Config) error {
	dialer := &tls.Dialer{NetDialer: &net.Dialer{Timeout: 10 * time.Second}, Config: tlsCfg}
	conn, err := dialer.DialContext(ctx, "tcp", c.cfg.Addr)
	if err != nil {
		return err
	}
	defer func() { _ = conn.Close() }()
	log.Printf("[tak-gateway] connected to TAK Server %s (mTLS)", c.cfg.Addr)

	sctx, cancel := context.WithCancel(ctx)
	defer cancel()

	// Egress pump.
	go func() {
		for {
			select {
			case <-sctx.Done():
				return
			case doc := <-c.out:
				_ = conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
				if _, err := conn.Write(append(doc, '\n')); err != nil {
					log.Printf("[tak-gateway] egress write: %v", err)
					cancel()
					return
				}
			}
		}
	}()

	// Ingress read loop.
	dec := cot.NewStreamDecoder(conn)
	for {
		if sctx.Err() != nil {
			return sctx.Err()
		}
		ev, err := dec.Next()
		if err != nil {
			if errors.Is(err, io.EOF) {
				return errors.New("peer closed stream")
			}
			return fmt.Errorf("ingress decode: %w", err)
		}
		if c.onEvent != nil {
			c.onEvent(ev)
		}
	}
}

func (c *Client) tlsConfig() (*tls.Config, error) {
	cert, err := tls.LoadX509KeyPair(c.cfg.CertPath, c.cfg.KeyPath)
	if err != nil {
		return nil, fmt.Errorf("load client cert: %w", err)
	}
	caPEM, err := os.ReadFile(c.cfg.CAPath)
	if err != nil {
		return nil, fmt.Errorf("read CA: %w", err)
	}
	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(caPEM) {
		return nil, errors.New("no certificates parsed from CA file")
	}
	host, _, err := net.SplitHostPort(c.cfg.Addr)
	if err != nil {
		return nil, fmt.Errorf("parse addr: %w", err)
	}
	return &tls.Config{
		Certificates: []tls.Certificate{cert},
		RootCAs:      pool,
		ServerName:   host,
		MinVersion:   tls.VersionTLS12,
	}, nil
}
