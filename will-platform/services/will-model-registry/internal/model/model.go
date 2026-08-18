// Package model defines the will.model.v0 card and the admission-time
// validations the registry enforces before an artefact is stored.
//
// Every model artefact accepted by the registry MUST arrive with a Card
// that matches this shape. The registry is fail-closed: any unrecognised
// field or missing required field rejects the admission at the API edge.
package model

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

const Schema = "will.model.v0"

// Origin encodes where a model was trained and who signed the evaluation.
// FOREIGN and OPEN_WEIGHT_FOREIGN_BASE models are restricted to the OSINT
// layer at read time (ADR-016 / ADR-020 discipline).
type Origin string

const (
	OriginSovereignRO       Origin = "SOVEREIGN_RO"
	OriginNATOAlly          Origin = "NATO_ALLY"
	OriginForeign           Origin = "FOREIGN"
	OriginOpenWeightForeign Origin = "OPEN_WEIGHT_FOREIGN_BASE"
)

// AIActRiskClass matches the EU AI Act risk categorisation. HIGH_RISK
// models require ai_act_conformity_ref to be present.
type AIActRiskClass string

const (
	AIActMinimal AIActRiskClass = "MINIMAL"
	AIActLimited AIActRiskClass = "LIMITED"
	AIActHigh    AIActRiskClass = "HIGH_RISK"
)

// RevocationState is the lifecycle marker. REVOKED models refuse to load;
// the state is irreversible (a resurrection requires a fresh version).
type RevocationState string

const (
	RevActive     RevocationState = "ACTIVE"
	RevDeprecated RevocationState = "DEPRECATED"
	RevRevoked    RevocationState = "REVOKED"
)

// Format is a controlled vocabulary of accepted artefact formats.
type Format string

const (
	FormatONNX        Format = "ONNX"
	FormatGGUF        Format = "GGUF"
	FormatTFLite      Format = "TFLITE"
	FormatTorchScript Format = "TORCHSCRIPT"
)

// Card is the will.model.v0 model card. Every admission carries one of
// these; the registry stores the card alongside the artefact and its
// signature.
type Card struct {
	Schema string `json:"schema"`

	ModelID string `json:"model_id"` // UUID
	Version string `json:"version"`  // semver
	Purpose string `json:"purpose"`  // e.g. TRACK_PREDICTION, HOSTILE_UAS_CLASSIFY

	Format         Format `json:"format"`
	Classification string `json:"classification"` // STANAG-4774 marking
	Origin         Origin `json:"origin"`

	TrainingDatasetRef  string `json:"training_dataset_ref"`
	Evaluator           string `json:"evaluator"` // signed identity of the accreditor
	HyperparametersHash string `json:"hyperparameters_hash"`

	SigningKeyRef string `json:"signing_key_ref"`

	AIActRiskClass         AIActRiskClass `json:"ai_act_risk_class"`
	AIActConformityRef     string         `json:"ai_act_conformity_ref,omitempty"`
	ORNISSAccreditationRef string         `json:"orniss_accreditation_ref,omitempty"`

	RevocationState RevocationState `json:"revocation_state"`

	// Consumers is a declared list of services/plugins that may load this
	// model. Enforcement is at load time via a caller-declared identity.
	Consumers []string `json:"consumers,omitempty"`
}

// Validate enforces admission-time shape rules that don't require external
// state. Cross-references (registry index for duplicate IDs, trust-anchor
// verification for signing keys) live at the API layer.
func (c Card) Validate() error {
	if c.Schema != Schema {
		return fmt.Errorf("card.schema=%q, want %q", c.Schema, Schema)
	}
	if !looksLikeUUID(c.ModelID) {
		return fmt.Errorf("card.model_id=%q, want UUID", c.ModelID)
	}
	if !looksLikeSemver(c.Version) {
		return fmt.Errorf("card.version=%q, want semver", c.Version)
	}
	if strings.TrimSpace(c.Purpose) == "" {
		return errors.New("card.purpose required")
	}
	if !validFormat(c.Format) {
		return fmt.Errorf("card.format=%q not in {ONNX,GGUF,TFLITE,TORCHSCRIPT}", c.Format)
	}
	if strings.TrimSpace(c.Classification) == "" {
		return errors.New("card.classification required")
	}
	if !validOrigin(c.Origin) {
		return fmt.Errorf("card.origin=%q not recognised", c.Origin)
	}
	if strings.TrimSpace(c.TrainingDatasetRef) == "" {
		return errors.New("card.training_dataset_ref required — a model whose dataset cannot be identified cannot be deployed operationally")
	}
	if strings.TrimSpace(c.Evaluator) == "" {
		return errors.New("card.evaluator required")
	}
	if !looksLikeHash(c.HyperparametersHash) {
		return fmt.Errorf("card.hyperparameters_hash=%q, want 64-char hex", c.HyperparametersHash)
	}
	if strings.TrimSpace(c.SigningKeyRef) == "" {
		return errors.New("card.signing_key_ref required")
	}
	if !validAIActRisk(c.AIActRiskClass) {
		return fmt.Errorf("card.ai_act_risk_class=%q not in {MINIMAL,LIMITED,HIGH_RISK}", c.AIActRiskClass)
	}
	if c.AIActRiskClass == AIActHigh && strings.TrimSpace(c.AIActConformityRef) == "" {
		return errors.New("card.ai_act_conformity_ref required for HIGH_RISK models")
	}
	if !validRevocationState(c.RevocationState) {
		return fmt.Errorf("card.revocation_state=%q not in {ACTIVE,DEPRECATED,REVOKED}", c.RevocationState)
	}
	// A card admitted in REVOKED state is nonsense — revoke happens post-admission.
	if c.RevocationState == RevRevoked {
		return errors.New("card.revocation_state=REVOKED on admission — revoke via /revoke after admit")
	}
	return nil
}

// IsForeign reports whether this model must be served OSINT-only.
func (c Card) IsForeign() bool {
	return c.Origin == OriginForeign || c.Origin == OriginOpenWeightForeign
}

// Marshal returns a canonical serialisation suitable for signing.
func (c Card) Marshal() ([]byte, error) { return json.Marshal(c) }

func looksLikeUUID(s string) bool {
	// Loose UUID shape: 8-4-4-4-12 hex.
	if len(s) != 36 {
		return false
	}
	for i, r := range s {
		switch i {
		case 8, 13, 18, 23:
			if r != '-' {
				return false
			}
		default:
			if !isHex(r) {
				return false
			}
		}
	}
	return true
}

func looksLikeSemver(s string) bool {
	parts := strings.Split(s, ".")
	if len(parts) != 3 {
		return false
	}
	for _, p := range parts {
		if p == "" {
			return false
		}
		for _, r := range p {
			if r < '0' || r > '9' {
				return false
			}
		}
	}
	return true
}

func looksLikeHash(s string) bool {
	if len(s) != 64 {
		return false
	}
	for _, r := range s {
		if !isHex(r) {
			return false
		}
	}
	return true
}

func isHex(r rune) bool {
	return (r >= '0' && r <= '9') || (r >= 'a' && r <= 'f') || (r >= 'A' && r <= 'F')
}

func validFormat(f Format) bool {
	switch f {
	case FormatONNX, FormatGGUF, FormatTFLite, FormatTorchScript:
		return true
	}
	return false
}

func validOrigin(o Origin) bool {
	switch o {
	case OriginSovereignRO, OriginNATOAlly, OriginForeign, OriginOpenWeightForeign:
		return true
	}
	return false
}

func validAIActRisk(r AIActRiskClass) bool {
	switch r {
	case AIActMinimal, AIActLimited, AIActHigh:
		return true
	}
	return false
}

func validRevocationState(s RevocationState) bool {
	switch s {
	case RevActive, RevDeprecated, RevRevoked:
		return true
	}
	return false
}
