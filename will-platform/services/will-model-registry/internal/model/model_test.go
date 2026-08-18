package model

import "testing"

func good() Card {
	return Card{
		Schema:              Schema,
		ModelID:             "8f3c2b1d-4e5a-6b7c-8d9e-0a1b2c3d4e5f",
		Version:             "1.0.0",
		Purpose:             "TRACK_PREDICTION",
		Format:              FormatONNX,
		Classification:      "NESECRET",
		Origin:              OriginSovereignRO,
		TrainingDatasetRef:  "rou-ds-2026-track-pred-v1",
		Evaluator:           "evaluator:rou-mod-inspectorate-ai/2026-q2",
		HyperparametersHash: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
		SigningKeyRef:       "vault://svc/evaluator-2026-q2/k1",
		AIActRiskClass:      AIActLimited,
		RevocationState:     RevActive,
	}
}

func TestValidateAcceptsGoodCard(t *testing.T) {
	if err := good().Validate(); err != nil {
		t.Fatalf("good card rejected: %v", err)
	}
}

func TestHighRiskRequiresConformity(t *testing.T) {
	c := good()
	c.AIActRiskClass = AIActHigh
	if err := c.Validate(); err == nil {
		t.Fatal("HIGH_RISK without ai_act_conformity_ref must be rejected")
	}
	c.AIActConformityRef = "ROU-AIACT-2026-M014"
	if err := c.Validate(); err != nil {
		t.Fatalf("HIGH_RISK with conformity ref rejected: %v", err)
	}
}

func TestRevokedOnAdmissionRejected(t *testing.T) {
	c := good()
	c.RevocationState = RevRevoked
	if err := c.Validate(); err == nil {
		t.Fatal("REVOKED on admission must be rejected — revoke happens post-admit")
	}
}

func TestRequiredFieldsEnforced(t *testing.T) {
	blank := Card{Schema: Schema}
	if err := blank.Validate(); err == nil {
		t.Fatal("empty card must be rejected")
	}
	c := good()
	c.ModelID = "not-a-uuid"
	if err := c.Validate(); err == nil {
		t.Fatal("bad model_id must be rejected")
	}
	c = good()
	c.Version = "1.0"
	if err := c.Validate(); err == nil {
		t.Fatal("bad semver must be rejected")
	}
	c = good()
	c.TrainingDatasetRef = ""
	if err := c.Validate(); err == nil {
		t.Fatal("missing training_dataset_ref must be rejected — provenance is required")
	}
	c = good()
	c.Format = "PICKLE"
	if err := c.Validate(); err == nil {
		t.Fatal("unknown format must be rejected")
	}
}

func TestIsForeign(t *testing.T) {
	cases := []struct {
		o    Origin
		want bool
	}{
		{OriginSovereignRO, false},
		{OriginNATOAlly, false},
		{OriginForeign, true},
		{OriginOpenWeightForeign, true},
	}
	for _, c := range cases {
		card := good()
		card.Origin = c.o
		if got := card.IsForeign(); got != c.want {
			t.Fatalf("origin=%q IsForeign=%v want %v", c.o, got, c.want)
		}
	}
}
