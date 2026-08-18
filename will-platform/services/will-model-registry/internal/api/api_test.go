package api

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/will-platform/will-model-registry/internal/model"
	"github.com/will-platform/will-model-registry/internal/store"
)

func newServer(t *testing.T) (*httptest.Server, ed25519.PrivateKey, string) {
	t.Helper()
	root := t.TempDir()
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	keyRef := "vault://svc/test-evaluator/k1"
	anchorPath := filepath.Join(root, "anchors.json")
	m := map[string]string{keyRef: base64.StdEncoding.EncodeToString(pub)}
	b, _ := json.Marshal(m)
	_ = os.WriteFile(anchorPath, b, 0o600)

	anchors, err := store.LoadTrustAnchors(anchorPath)
	if err != nil {
		t.Fatal(err)
	}
	s, err := store.New(filepath.Join(root, "data"), anchors)
	if err != nil {
		t.Fatal(err)
	}
	return httptest.NewServer(New(s)), priv, keyRef
}

func card(keyRef string, opts ...func(*model.Card)) model.Card {
	c := model.Card{
		Schema:              model.Schema,
		ModelID:             "8f3c2b1d-4e5a-6b7c-8d9e-0a1b2c3d4e5f",
		Version:             "1.0.0",
		Purpose:             "TRACK_PREDICTION",
		Format:              model.FormatONNX,
		Classification:      "NESECRET",
		Origin:              model.OriginSovereignRO,
		TrainingDatasetRef:  "rou-ds-2026-track-pred-v1",
		Evaluator:           "evaluator:rou-mod-inspectorate-ai/2026-q2",
		HyperparametersHash: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
		SigningKeyRef:       keyRef,
		AIActRiskClass:      model.AIActLimited,
		RevocationState:     model.RevActive,
	}
	for _, o := range opts {
		o(&c)
	}
	return c
}

func admit(t *testing.T, ts *httptest.Server, priv ed25519.PrivateKey, c model.Card, art []byte) *http.Response {
	t.Helper()
	cb, _ := c.Marshal()
	sig := ed25519.Sign(priv, append(cb, art...))
	body := map[string]string{
		"card":          "", // placeholder; overwritten below
		"artifact_b64":  base64.StdEncoding.EncodeToString(art),
		"signature_b64": base64.StdEncoding.EncodeToString(sig),
	}
	// Marshal card into a nested field the API expects.
	envelope := map[string]any{
		"card":          c,
		"artifact_b64":  body["artifact_b64"],
		"signature_b64": body["signature_b64"],
	}
	b, _ := json.Marshal(envelope)
	res, err := http.Post(ts.URL+"/v1/tenants/tenant-1/models", "application/json",
		strings.NewReader(string(b)))
	if err != nil {
		t.Fatal(err)
	}
	return res
}

func TestAdmitHappyPathAndGetCard(t *testing.T) {
	ts, priv, keyRef := newServer(t)
	defer ts.Close()
	c := card(keyRef)
	res := admit(t, ts, priv, c, []byte("onnx"))
	if res.StatusCode != http.StatusCreated {
		b, _ := io.ReadAll(res.Body)
		t.Fatalf("admit status=%d body=%s", res.StatusCode, b)
	}
	res, err := http.Get(ts.URL + "/v1/tenants/tenant-1/models/" + c.ModelID + "/versions/1.0.0/card")
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != http.StatusOK {
		t.Fatalf("get card status=%d", res.StatusCode)
	}
}

func TestArtifactRequiresCeiling(t *testing.T) {
	ts, priv, keyRef := newServer(t)
	defer ts.Close()
	c := card(keyRef)
	admit(t, ts, priv, c, []byte("onnx"))

	res, err := http.Get(ts.URL + "/v1/tenants/tenant-1/models/" + c.ModelID + "/versions/1.0.0/artifact")
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("missing ceiling status=%d, want 400", res.StatusCode)
	}
}

func TestArtifactClassificationCeilingEnforced(t *testing.T) {
	ts, priv, keyRef := newServer(t)
	defer ts.Close()
	// Model marked SECRET; caller ceiling NESECRET — must be refused.
	c := card(keyRef, func(c *model.Card) { c.Classification = "SECRET" })
	res := admit(t, ts, priv, c, []byte("onnx"))
	if res.StatusCode != http.StatusCreated {
		b, _ := io.ReadAll(res.Body)
		t.Fatalf("admit failed: %d %s", res.StatusCode, b)
	}

	res, _ = http.Get(ts.URL + "/v1/tenants/tenant-1/models/" + c.ModelID +
		"/versions/1.0.0/artifact?ceiling=NESECRET&layer=OPERATIONAL")
	if res.StatusCode != http.StatusForbidden {
		t.Fatalf("SECRET model to NESECRET caller status=%d, want 403", res.StatusCode)
	}
}

func TestForeignRefusedInOperationalLayer(t *testing.T) {
	ts, priv, keyRef := newServer(t)
	defer ts.Close()
	c := card(keyRef, func(c *model.Card) { c.Origin = model.OriginForeign })
	admit(t, ts, priv, c, []byte("onnx"))

	// Foreign to OPERATIONAL: refused.
	res, _ := http.Get(ts.URL + "/v1/tenants/tenant-1/models/" + c.ModelID +
		"/versions/1.0.0/artifact?ceiling=NESECRET&layer=OPERATIONAL")
	if res.StatusCode != http.StatusForbidden {
		t.Fatalf("FOREIGN to OPERATIONAL status=%d, want 403", res.StatusCode)
	}

	// Foreign to OSINT: allowed.
	res, _ = http.Get(ts.URL + "/v1/tenants/tenant-1/models/" + c.ModelID +
		"/versions/1.0.0/artifact?ceiling=NESECRET&layer=OSINT")
	if res.StatusCode != http.StatusOK {
		t.Fatalf("FOREIGN to OSINT status=%d, want 200", res.StatusCode)
	}
	if got := res.Header.Get("X-Will-Model-Origin"); got != "FOREIGN" {
		t.Fatalf("origin header=%q", got)
	}
}

func TestRevokedReturnsGone(t *testing.T) {
	ts, priv, keyRef := newServer(t)
	defer ts.Close()
	c := card(keyRef)
	admit(t, ts, priv, c, []byte("onnx"))

	// Confirm 200 before revoke.
	res, _ := http.Get(ts.URL + "/v1/tenants/tenant-1/models/" + c.ModelID +
		"/versions/1.0.0/artifact?ceiling=NESECRET&layer=OPERATIONAL")
	if res.StatusCode != http.StatusOK {
		t.Fatalf("pre-revoke status=%d", res.StatusCode)
	}

	res, _ = http.Post(ts.URL+"/v1/tenants/tenant-1/models/"+c.ModelID+"/versions/1.0.0/revoke",
		"application/json", nil)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("revoke status=%d", res.StatusCode)
	}

	res, _ = http.Get(ts.URL + "/v1/tenants/tenant-1/models/" + c.ModelID +
		"/versions/1.0.0/artifact?ceiling=NESECRET&layer=OPERATIONAL")
	if res.StatusCode != http.StatusGone {
		t.Fatalf("post-revoke status=%d, want 410", res.StatusCode)
	}
}

func TestCrossSchemeCeilingDenied(t *testing.T) {
	ts, priv, keyRef := newServer(t)
	defer ts.Close()
	// Model marked NESECRET (RO); caller ceiling NATO_SECRET.
	c := card(keyRef)
	admit(t, ts, priv, c, []byte("onnx"))
	res, _ := http.Get(ts.URL + "/v1/tenants/tenant-1/models/" + c.ModelID +
		"/versions/1.0.0/artifact?ceiling=NATO_SECRET&layer=OPERATIONAL")
	if res.StatusCode != http.StatusForbidden {
		t.Fatalf("cross-scheme status=%d, want 403", res.StatusCode)
	}
}

func TestHealthz(t *testing.T) {
	ts, _, _ := newServer(t)
	defer ts.Close()
	res, err := http.Get(ts.URL + "/healthz")
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != http.StatusOK {
		t.Fatalf("healthz=%d", res.StatusCode)
	}
}
