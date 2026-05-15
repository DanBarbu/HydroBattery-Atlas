package dal

import (
	"context"
	"testing"
)

func TestUpsertAssetIsIdempotent(t *testing.T) {
	s := NewMemoryStore()
	ctx := context.Background()
	if _, err := s.UpsertAsset(ctx, DefendedAsset{TenantID: "t1", ExternalID: "hq", DisplayName: "HQ", Lat: 45, Lon: 24, Criticality: 5}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.UpsertAsset(ctx, DefendedAsset{TenantID: "t1", ExternalID: "hq", DisplayName: "HQ-renamed", Lat: 46, Lon: 25, Criticality: 4}); err != nil {
		t.Fatal(err)
	}
	out, _ := s.ListAssets(ctx, "t1")
	if len(out) != 1 || out[0].DisplayName != "HQ-renamed" {
		t.Fatalf("expected single upserted asset, got %+v", out)
	}
}

func TestPointInPolygon(t *testing.T) {
	square := Polygon{{{0, 0}, {1, 0}, {1, 1}, {0, 1}, {0, 0}}}
	if !PointInPolygon(0.5, 0.5, square) {
		t.Fatal("centre should be inside")
	}
	if PointInPolygon(2, 2, square) {
		t.Fatal("outside should be outside")
	}
}

func TestPointInPolygonRejectsDegenerate(t *testing.T) {
	if PointInPolygon(0, 0, Polygon{}) {
		t.Fatal("empty polygon must reject")
	}
	if PointInPolygon(0, 0, Polygon{{{0, 0}, {1, 0}}}) {
		t.Fatal("two-point polygon must reject")
	}
}

func TestListZonesEmpty(t *testing.T) {
	out, err := NewMemoryStore().ListZones(context.Background(), "t1")
	if err != nil || len(out) != 0 {
		t.Fatalf("expected empty, got %v / %v", out, err)
	}
}
