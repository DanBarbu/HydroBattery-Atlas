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
	"strings"

	"github.com/will-platform/will-model-registry/internal/classification"
	"github.com/will-platform/will-model-registry/internal/model"
	"github.com/will-platform/will-model-registry/internal/store"
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
		tenant := r.PathValue("tenant")
		var body admitRequest
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<20)).Decode(&body); err != nil {
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
		versions, err := s.ListVersions(tenant, modelID)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"model_id": modelID, "versions": versions})
	})

	mux.HandleFunc("GET /v1/tenants/{tenant}/models/{model_id}/versions/{version}/card", func(w http.ResponseWriter, r *http.Request) {
		tenant := r.PathValue("tenant")
		modelID := r.PathValue("model_id")
		version := r.PathValue("version")
		card, err := s.GetCard(tenant, modelID, version)
		if err != nil {
			writeErr(w, http.StatusNotFound, err)
			return
		}
		writeJSON(w, http.StatusOK, card)
	})

	mux.HandleFunc("GET /v1/tenants/{tenant}/models/{model_id}/versions/{version}/artifact", func(w http.ResponseWriter, r *http.Request) {
		tenant := r.PathValue("tenant")
		modelID := r.PathValue("model_id")
		version := r.PathValue("version")
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
		tenant := r.PathValue("tenant")
		modelID := r.PathValue("model_id")
		version := r.PathValue("version")
		if err := s.Revoke(tenant, modelID, version); err != nil {
			writeErr(w, http.StatusNotFound, err)
			return
		}
		log.Printf("[will-model-registry] revoked tenant=%s model=%s version=%s", tenant, modelID, version)
		writeJSON(w, http.StatusOK, map[string]string{"revocation_state": string(model.RevRevoked)})
	})

	return mux
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
