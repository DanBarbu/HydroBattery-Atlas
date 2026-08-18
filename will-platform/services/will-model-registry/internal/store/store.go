// Package store is the filesystem-backed model store. One directory per
// (tenant, model_id, version); each holds card.json + artifact.bin +
// signature.bin. The layout is intentionally simple so an ORNISS bundle
// export is a `tar` of the version directory.
package store

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/will-platform/will-model-registry/internal/model"
)

// TrustAnchors maps signing_key_ref → ed25519 public key. Loaded from
// disk at startup. Fail-closed: a key_ref not in the trust store cannot
// be admitted, so an empty trust store admits nothing.
type TrustAnchors map[string]ed25519.PublicKey

// LoadTrustAnchors reads a JSON file: { "key_ref": "<base64 ed25519 pubkey>", ... }.
// A missing file is not an error — the trust store is simply empty, and
// admission will refuse every signed card until it is populated.
func LoadTrustAnchors(path string) (TrustAnchors, error) {
	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return TrustAnchors{}, nil
		}
		return nil, err
	}
	defer func() { _ = f.Close() }()
	var raw map[string]string
	if err := json.NewDecoder(f).Decode(&raw); err != nil {
		return nil, fmt.Errorf("trust anchors: parse: %w", err)
	}
	anchors := make(TrustAnchors, len(raw))
	for ref, b64 := range raw {
		key, err := base64.StdEncoding.DecodeString(b64)
		if err != nil {
			return nil, fmt.Errorf("trust anchors: %s: %w", ref, err)
		}
		if len(key) != ed25519.PublicKeySize {
			return nil, fmt.Errorf("trust anchors: %s: pubkey size %d, want %d", ref, len(key), ed25519.PublicKeySize)
		}
		anchors[ref] = ed25519.PublicKey(key)
	}
	return anchors, nil
}

// Store is the filesystem-backed model store.
type Store struct {
	root    string
	anchors TrustAnchors
}

func New(root string, anchors TrustAnchors) (*Store, error) {
	if err := os.MkdirAll(root, 0o750); err != nil {
		return nil, err
	}
	return &Store{root: root, anchors: anchors}, nil
}

// Admit stores a new model version. It:
//   - validates the card (see model.Card.Validate),
//   - refuses if the (tenant, model_id, version) already exists,
//   - verifies the signature against the trust anchor named by
//     card.signing_key_ref (fail-closed: unknown key_ref -> refused).
func (s *Store) Admit(tenantID string, card model.Card, artifact []byte, signature []byte) error {
	if err := card.Validate(); err != nil {
		return fmt.Errorf("card: %w", err)
	}
	if err := s.verify(card, artifact, signature); err != nil {
		return fmt.Errorf("signature: %w", err)
	}
	dir := s.versionDir(tenantID, card.ModelID, card.Version)
	if _, err := os.Stat(filepath.Join(dir, "card.json")); err == nil {
		return fmt.Errorf("version %s already admitted for model %s", card.Version, card.ModelID)
	}
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return err
	}
	if err := writeJSON(filepath.Join(dir, "card.json"), card); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(dir, "artifact.bin"), artifact, 0o640); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(dir, "signature.bin"), signature, 0o640); err != nil {
		return err
	}
	return nil
}

// Verify checks that signature is a valid ed25519 signature over
// (canonical card || artifact) by the pubkey named by card.signing_key_ref.
func (s *Store) verify(card model.Card, artifact []byte, signature []byte) error {
	pub, ok := s.anchors[card.SigningKeyRef]
	if !ok {
		return fmt.Errorf("signing_key_ref %q not in trust store", card.SigningKeyRef)
	}
	cardBytes, err := card.Marshal()
	if err != nil {
		return err
	}
	signedOver := append(cardBytes, artifact...)
	if !ed25519.Verify(pub, signedOver, signature) {
		return errors.New("signature verification failed")
	}
	return nil
}

// GetCard returns the card without loading the artifact.
func (s *Store) GetCard(tenantID, modelID, version string) (model.Card, error) {
	f, err := os.Open(filepath.Join(s.versionDir(tenantID, modelID, version), "card.json"))
	if err != nil {
		return model.Card{}, err
	}
	defer func() { _ = f.Close() }()
	var card model.Card
	if err := json.NewDecoder(f).Decode(&card); err != nil {
		return model.Card{}, err
	}
	return card, nil
}

// ArtifactReader opens the artefact for streaming. Callers apply the
// read-time policy (classification ceiling, foreign-origin routing) BEFORE
// calling this — the store is not a policy authority.
func (s *Store) ArtifactReader(tenantID, modelID, version string) (io.ReadCloser, error) {
	return os.Open(filepath.Join(s.versionDir(tenantID, modelID, version), "artifact.bin"))
}

// Revoke updates the stored card's revocation_state to REVOKED. The state
// is irreversible: a revoked card cannot be transitioned back to ACTIVE.
func (s *Store) Revoke(tenantID, modelID, version string) error {
	card, err := s.GetCard(tenantID, modelID, version)
	if err != nil {
		return err
	}
	if card.RevocationState == model.RevRevoked {
		return nil // idempotent
	}
	card.RevocationState = model.RevRevoked
	return writeJSON(filepath.Join(s.versionDir(tenantID, modelID, version), "card.json"), card)
}

// ListModels returns every model_id present for the tenant.
func (s *Store) ListModels(tenantID string) ([]string, error) {
	dir := s.tenantDir(tenantID)
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return []string{}, nil
		}
		return nil, err
	}
	out := make([]string, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() {
			out = append(out, e.Name())
		}
	}
	sort.Strings(out)
	return out, nil
}

// ListVersions returns every version present for the (tenant, model_id).
func (s *Store) ListVersions(tenantID, modelID string) ([]string, error) {
	dir := filepath.Join(s.tenantDir(tenantID), modelID)
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return []string{}, nil
		}
		return nil, err
	}
	out := make([]string, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() {
			out = append(out, e.Name())
		}
	}
	sort.Strings(out)
	return out, nil
}

func (s *Store) tenantDir(tenantID string) string {
	return filepath.Join(s.root, safe(tenantID))
}

func (s *Store) versionDir(tenantID, modelID, version string) string {
	return filepath.Join(s.tenantDir(tenantID), safe(modelID), safe(version))
}

// safe guards against path traversal in path components.
func safe(s string) string {
	s = strings.ReplaceAll(s, "..", "")
	s = strings.ReplaceAll(s, "/", "")
	s = strings.ReplaceAll(s, "\\", "")
	return s
}

func writeJSON(path string, v any) error {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o640); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}
