package jc3iedm

import (
	"strings"
	"testing"
)

const friendlyCompany = `{
  "object_item_id":"OI-LF-21","category":"UNIT","name":"Cp 2 Vanatori",
  "hostility":"FR","dimension":"LAND","echelon":"COMPANY",
  "location":{"lat_deg":45.873,"lon_deg":24.778,"elevation_m":480},
  "reporting_org":"JFC","reported_at":"2026-05-18T09:00:00Z",
  "classification":"RS"}`

func TestDecodeFriendlyCompany(t *testing.T) {
	tr, err := Decode([]byte(friendlyCompany))
	if err != nil {
		t.Fatal(err)
	}
	if tr.ExternalID != "OI-LF-21" || tr.Hostility != "FR" || tr.Dimension != "LAND" {
		t.Fatalf("got %+v", tr)
	}
	if tr.Classification != "SECRET_DE_SERVICIU" {
		t.Fatalf("RS must map to SECRET_DE_SERVICIU, got %q", tr.Classification)
	}
}

func TestDecodeDefaultsHostilityAndDimension(t *testing.T) {
	tr, err := Decode([]byte(`{"object_item_id":"X","location":{"lat_deg":1,"lon_deg":1}}`))
	if err != nil {
		t.Fatal(err)
	}
	if tr.Hostility != "UK" || tr.Dimension != "LAND" {
		t.Fatalf("expected UK/LAND defaults, got %s/%s", tr.Hostility, tr.Dimension)
	}
	if tr.Classification != "NESECRET" {
		t.Fatalf("empty classification must map to NESECRET, got %q", tr.Classification)
	}
}

func TestClassificationNeverDowngrades(t *testing.T) {
	tr, _ := Decode([]byte(`{"object_item_id":"X","location":{"lat_deg":1,"lon_deg":1},"classification":"WEIRD"}`))
	if tr.Classification != "STRICT_SECRET" {
		t.Fatalf("unknown class must be most-restrictive, got %q", tr.Classification)
	}
}

func TestRejectsEmptyOversizeMalformedAndRange(t *testing.T) {
	if _, err := Decode(nil); err != ErrEmpty {
		t.Fatalf("empty: %v", err)
	}
	if _, err := Decode([]byte(strings.Repeat("a", MaxMessageBytes+1))); err != ErrTooLarge {
		t.Fatalf("oversize: %v", err)
	}
	if _, err := Decode([]byte("not json")); err == nil {
		t.Fatal("malformed should error")
	}
	if _, err := Decode([]byte(`{"object_item_id":"X","location":{"lat_deg":999,"lon_deg":0}}`)); err != ErrRange {
		t.Fatalf("range: %v", err)
	}
	if _, err := Decode([]byte(`{"location":{"lat_deg":1,"lon_deg":1}}`)); err == nil {
		t.Fatal("missing object_item_id should error")
	}
}
