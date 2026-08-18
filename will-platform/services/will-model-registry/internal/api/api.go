// Package api wires HTTP handlers for the model registry.
//
// The read-time gates are enforced HERE, not in the store. Every artefact
// GET requires the caller to declare its classification ceiling and its
// layer ("OPERATIONAL" or "OSINT"). The gates are fail-closed:
//   - unrecognised/missing ceiling             -> 400
//   - card classification above ceiling        -> 403
//   - FOREIGN origin served to OPERATIONAL     -> 403
//   - REVOKED card                             -> 410 Gone
package api

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"regexp"
	"strings"

	"github.com/will-platform/will-model-registry/internal/classification"
	"github.com/will-platform/will-model-registry/internal/model"
	"github.com/will-platform/will-model-registry/internal/store"
)

// Path-component validators. Every URL segment that becomes a filesystem
// path is rejected on ANY deviation from these patterns — no mutation, no
// silent normalisation. Callers get a 400 with a clear message so the
// tenant/model/version they intended is obviously wrong on the wire.
var (
	tenantPattern  = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$`)
	modelIDPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
	versionPattern = regexp.MustCompile(`^\d{1,10}\.\d{1,10}\.\d{1,10}$`)
)

// RBAC — Sprint-0 header-based gate matching tenant-admin convention
// (X-Will-Role). ADR-007-successor (NPKI / OIDC) replaces this later
// without changing endpoint shapes. Missing / wrong role on write
// endpoints returns 403 before any state change.
const (
	roleHeader = "X-Will-Role"
	roleAdmin  = "admin"
)

// Layer names a caller's trust layer. FOREIGN-origin artefacts are
// available only to OSINT callers (ADR-016 / ADR-020 discipline).
type Layer string

const (
	LayerOperational Layer = "OPERATIONAL"
	LayerOSINT       Layer = "OSINT"
)

func New(s *store.Store) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{
			"status": "ok", "component": "will-model-registry",
			"mode": "sovereign-registry",
		})
	})

	mux.HandleFunc("POST /v1/tenants/{tenant}/models", func(w http.ResponseWriter, r *http.Request) {
		if err := requireAdmin(r); err != nil {
			writeErr(w, http.StatusForbidden, err)
			return
		}
		tenant := r.PathValue("tenant")
		if err := validateTenant(tenant); err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<20))
		dec.DisallowUnknownFields()
		var body admitRequest
		if err := dec.Decode(&body); err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		if err := validateModelID(body.Card.ModelID); err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		if err := validateVersion(body.Card.Version); err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		artifact, err := base64.StdEncoding.DecodeString(body.ArtifactB64)
		if err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		signature, err := base64.StdEncoding.DecodeString(body.SignatureB64)
		if err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		if err := s.Admit(tenant, body.Card, artifact, signature); err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		log.Printf("[will-model-registry] admitted tenant=%s model=%s version=%s origin=%s classification=%s",
			tenant, body.Card.ModelID, body.Card.Version, body.Card.Origin, body.Card.Classification)
		writeJSON(w, http.StatusCreated, map[string]string{
			"model_id": body.Card.ModelID, "version": body.Card.Version,
		})
	})

	mux.HandleFunc("GET /v1/tenants/{tenant}/models", func(w http.ResponseWriter, r *http.Request) {
		tenant := r.PathValue("tenant")
		if err := validateTenant(tenant); err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		ids, err := s.ListModels(tenant)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"models": ids})
	})

	mux.HandleFunc("GET /v1/tenants/{tenant}/models/{model_id}/versions", func(w http.ResponseWriter, r *http.Request) {
		tenant := r.PathValue("tenant")
		modelID := r.PathValue("model_id")
		if err := validateTenant(tenant); err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		if err := validateModelID(modelID); err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		versions, err := s.ListVersions(tenant, modelID)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"model_id": modelID, "versions": versions})
	})

	// GET /card is ceiling-gated for the same reason /artifact is — the
	// card carries the classification marking itself plus sensitive
	// provenance fields (evaluator, training_dataset_ref, orniss ref).
	// Callers pass ?ceiling=... just like /artifact.
	mux.HandleFunc("GET /v1/tenants/{tenant}/models/{model_id}/versions/{version}/card", func(w http.ResponseWriter, r *http.Request) {
		tenant := r.PathValue("tenant")
		modelID := r.PathValue("model_id")
		version := r.PathValue("version")
		if err := validateTenant(tenant); err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		if err := validateModelID(modelID); err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		if err := validateVersion(version); err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		card, err := s.GetCard(tenant, modelID, version)
		if err != nil {
			writeErr(w, http.StatusNotFound, err)
			return
		}
		ceiling := r.URL.Query().Get("ceiling")
		if err := cardGate(card, ceiling); err != nil {
			status := http.StatusForbidden
			if errors.Is(err, errRevoked) {
				status = http.StatusGone
			} else if errors.Is(err, errBadCeiling) {
				status = http.StatusBadRequest
			}
			writeErr(w, status, err)
			return
		}
		writeJSON(w, http.StatusOK, card)
	})

	mux.HandleFunc("GET /v1/tenants/{tenant}/models/{model_id}/versions/{version}/artifact", func(w http.ResponseWriter, r *http.Request) {
		tenant := r.PathValue("tenant")
		modelID := r.PathValue("model_id")
		version := r.PathValue("version")
		if err := validateTenant(tenant); err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		if err := validateModelID(modelID); err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		if err := validateVersion(version); err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		ceiling := r.URL.Query().Get("ceiling")
		layer := Layer(strings.ToUpper(r.URL.Query().Get("layer")))

		card, err := s.GetCard(tenant, modelID, version)
		if err != nil {
			writeErr(w, http.StatusNotFound, err)
			return
		}
		if err := gate(card, ceiling, layer); err != nil {
			status := http.StatusForbidden
			if errors.Is(err, errRevoked) {
				status = http.StatusGone
			} else if errors.Is(err, errBadCeiling) || errors.Is(err, errBadLayer) {
				status = http.StatusBadRequest
			}
			writeErr(w, status, err)
			return
		}
		reader, err := s.ArtifactReader(tenant, modelID, version)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err)
			return
		}
		defer func() { _ = reader.Close() }()
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("X-Will-Model-Classification", card.Classification)
		w.Header().Set("X-Will-Model-Origin", string(card.Origin))
		w.WriteHeader(http.StatusOK)
		_, _ = io.Copy(w, reader)
	})

	mux.HandleFunc("POST /v1/tenants/{tenant}/models/{model_id}/versions/{version}/revoke", func(w http.ResponseWriter, r *http.Request) {
		if err := requireAdmin(r); err != nil {
			writeErr(w, http.StatusForbidden, err)
			return
		}
		tenant := r.PathValue("tenant")
		modelID := r.PathValue("model_id")
		version := r.PathValue("version")
		if err := validateTenant(tenant); err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		if err := validateModelID(modelID); err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		if err := validateVersion(version); err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		if err := s.Revoke(tenant, modelID, version); err != nil {
			writeErr(w, http.StatusNotFound, err)
			return
		}
		log.Printf("[will-model-registry] revoked tenant=%s model=%s version=%s by role=%s",
			tenant, modelID, version, r.Header.Get(roleHeader))
		writeJSON(w, http.StatusOK, map[string]string{"revocation_state": string(model.RevRevoked)})
	})

	return mux
}

// requireAdmin is the Sprint-0 header-based RBAC. Replaced by NPKI/OIDC
// once ADR-007-successor lands, without changing endpoint shapes.
func requireAdmin(r *http.Request) error {
	if r.Header.Get(roleHeader) != roleAdmin {
		return errForbiddenRole
	}
	return nil
}

func validateTenant(s string) error {
	if !tenantPattern.MatchString(s) {
		return errBadTenant
	}
	return nil
}

func validateModelID(s string) error {
	if !modelIDPattern.MatchString(s) {
		return errBadModelID
	}
	return nil
}

func validateVersion(s string) error {
	if !versionPattern.MatchString(s) {
		return errBadVersion
	}
	return nil
}

// cardGate is the read-time policy for GET /card. Ceiling-checked and
// revocation-aware, matching /artifact — but does not enforce foreign-
// origin routing because the card itself carries no artefact bytes; the
// caller may inspect origin to decide whether to fetch the artefact.
func cardGate(card model.Card, ceiling string) error {
	if card.RevocationState == model.RevRevoked {
		return errRevoked
	}
	if strings.TrimSpace(ceiling) == "" {
		return errBadCeiling
	}
	if !classification.Valid(ceiling) {
		return errBadCeiling
	}
	if !classification.AtOrBelowCeiling(card.Classification, ceiling) {
		return errAboveCeiling
	}
	return nil
}

// gate is the read-time policy check. Fail-closed on every axis.
func gate(card model.Card, ceiling string, layer Layer) error {
	if card.RevocationState == model.RevRevoked {
		return errRevoked
	}
	if strings.TrimSpace(ceiling) == "" {
		return errBadCeiling
	}
	if !classification.Valid(ceiling) {
		return errBadCeiling
	}
	if !classification.AtOrBelowCeiling(card.Classification, ceiling) {
		return errAboveCeiling
	}
	if layer != LayerOperational && layer != LayerOSINT {
		return errBadLayer
	}
	if card.IsForeign() && layer != LayerOSINT {
		return errForeignInOperational
	}
	return nil
}

var (
	errRevoked              = errors.New("model revoked")
	errBadCeiling           = errors.New("caller ceiling missing or unrecognised")
	errAboveCeiling         = errors.New("model classification exceeds caller ceiling")
	errBadLayer             = errors.New("caller layer must be OPERATIONAL or OSINT")
	errForeignInOperational = errors.New("foreign-origin model refused to OPERATIONAL layer; use layer=OSINT")
	errForbiddenRole        = errors.New("write requires X-Will-Role: admin")
	errBadTenant            = errors.New("tenant: must match ^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$")
	errBadModelID           = errors.New("model_id: must be a UUID")
	errBadVersion           = errors.New("version: must be semver X.Y.Z (digits only)")
)

type admitRequest struct {
	Card         model.Card `json:"card"`
	ArtifactB64  string     `json:"artifact_b64"`
	SignatureB64 string     `json:"signature_b64"`
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeErr(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]string{"error": err.Error()})
}
