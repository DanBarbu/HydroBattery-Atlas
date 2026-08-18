package store

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"testing"

	"github.com/will-platform/will-model-registry/internal/model"
)

func newStoreWithKey(t *testing.T) (*Store, ed25519.PrivateKey, string) {
	t.Helper()
	root := t.TempDir()
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	keyRef := "vault://svc/test-evaluator/k1"
	anchorPath := filepath.Join(root, "anchors.json")
	writeAnchors(t, anchorPath, map[string]ed25519.PublicKey{keyRef: pub})
	anchors, err := LoadTrustAnchors(anchorPath)
	if err != nil {
		t.Fatal(err)
	}
	s, err := New(filepath.Join(root, "data"), anchors)
	if err != nil {
		t.Fatal(err)
	}
	return s, priv, keyRef
}

func writeAnchors(t *testing.T, path string, m map[string]ed25519.PublicKey) {
	t.Helper()
	raw := map[string]string{}
	for k, v := range m {
		raw[k] = base64.StdEncoding.EncodeToString(v)
	}
	b, err := json.Marshal(raw)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, b, 0o600); err != nil {
		t.Fatal(err)
	}
}

func goodCard(keyRef string) model.Card {
	return model.Card{
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
}

func sign(t *testing.T, card model.Card, artifact []byte, priv ed25519.PrivateKey) []byte {
	t.Helper()
	cb, err := card.Marshal()
	if err != nil {
		t.Fatal(err)
	}
	return ed25519.Sign(priv, append(cb, artifact...))
}

func TestAdmitAndGetHappyPath(t *testing.T) {
	s, priv, keyRef := newStoreWithKey(t)
	c := goodCard(keyRef)
	art := []byte("onnx-bytes-here")
	sig := sign(t, c, art, priv)
	if err := s.Admit("tenant-1", c, art, sig); err != nil {
		t.Fatalf("admit: %v", err)
	}
	got, err := s.GetCard("tenant-1", c.ModelID, c.Version)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Purpose != "TRACK_PREDICTION" {
		t.Fatalf("card round-tripped wrong: %+v", got)
	}
	r, err := s.ArtifactReader("tenant-1", c.ModelID, c.Version)
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()
	b, err := io.ReadAll(r)
	if err != nil {
		t.Fatal(err)
	}
	if string(b) != string(art) {
		t.Fatalf("artefact round-tripped wrong: %q", b)
	}
}

func TestAdmitRefusesUnknownSigningKey(t *testing.T) {
	s, priv, _ := newStoreWithKey(t)
	c := goodCard("vault://svc/some-other-key/k1") // not in anchors
	art := []byte("x")
	sig := sign(t, c, art, priv) // signed with the real key, but key_ref names something else
	if err := s.Admit("tenant-1", c, art, sig); err == nil {
		t.Fatal("expected refusal on unknown signing_key_ref")
	}
}

func TestAdmitRefusesTamperedArtefact(t *testing.T) {
	s, priv, keyRef := newStoreWithKey(t)
	c := goodCard(keyRef)
	sig := sign(t, c, []byte("original"), priv)
	// Tamper: pass a different artefact after signing.
	if err := s.Admit("tenant-1", c, []byte("tampered"), sig); err == nil {
		t.Fatal("expected signature failure on tampered artefact")
	}
}

func TestAdmitRefusesDuplicateVersion(t *testing.T) {
	s, priv, keyRef := newStoreWithKey(t)
	c := goodCard(keyRef)
	art := []byte("x")
	sig := sign(t, c, art, priv)
	if err := s.Admit("tenant-1", c, art, sig); err != nil {
		t.Fatal(err)
	}
	if err := s.Admit("tenant-1", c, art, sig); err == nil {
		t.Fatal("expected refusal on duplicate (model_id, version) admission")
	}
}

func TestRevokeIsIrreversible(t *testing.T) {
	s, priv, keyRef := newStoreWithKey(t)
	c := goodCard(keyRef)
	art := []byte("x")
	if err := s.Admit("tenant-1", c, art, sign(t, c, art, priv)); err != nil {
		t.Fatal(err)
	}
	if err := s.Revoke("tenant-1", c.ModelID, c.Version); err != nil {
		t.Fatal(err)
	}
	got, _ := s.GetCard("tenant-1", c.ModelID, c.Version)
	if got.RevocationState != model.RevRevoked {
		t.Fatalf("revoke did not stick: %+v", got)
	}
	// Idempotent second revoke.
	if err := s.Revoke("tenant-1", c.ModelID, c.Version); err != nil {
		t.Fatalf("second revoke should be idempotent: %v", err)
	}
}

func TestEmptyTrustStoreAdmitsNothing(t *testing.T) {
	root := t.TempDir()
	s, err := New(filepath.Join(root, "data"), TrustAnchors{})
	if err != nil {
		t.Fatal(err)
	}
	_, priv, _ := ed25519.GenerateKey(rand.Reader)
	c := goodCard("vault://any-key")
	art := []byte("x")
	sig := ed25519.Sign(priv, art)
	if err := s.Admit("tenant-1", c, art, sig); err == nil {
		t.Fatal("empty trust store must fail-closed on admission")
	}
}

func TestPathTraversalGuarded(t *testing.T) {
	s, priv, keyRef := newStoreWithKey(t)
	c := goodCard(keyRef)
	c.ModelID = "../../etc/passwd"
	art := []byte("x")
	sig := sign(t, c, art, priv)
	// Admission fails at card validation (model_id is not a valid UUID).
	if err := s.Admit("tenant-1", c, art, sig); err == nil {
		t.Fatal("path-traversal model_id must be rejected by card validation")
	}
}

func TestListModelsAndVersions(t *testing.T) {
	s, priv, keyRef := newStoreWithKey(t)
	c := goodCard(keyRef)
	art := []byte("x")
	if err := s.Admit("tenant-1", c, art, sign(t, c, art, priv)); err != nil {
		t.Fatal(err)
	}
	c2 := c
	c2.Version = "1.0.1"
	if err := s.Admit("tenant-1", c2, art, sign(t, c2, art, priv)); err != nil {
		t.Fatal(err)
	}
	models, _ := s.ListModels("tenant-1")
	if len(models) != 1 || models[0] != c.ModelID {
		t.Fatalf("models=%v", models)
	}
	versions, _ := s.ListVersions("tenant-1", c.ModelID)
	if len(versions) != 2 {
		t.Fatalf("versions=%v", versions)
	}
}
