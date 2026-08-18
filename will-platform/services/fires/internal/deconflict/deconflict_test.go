package deconflict

import (
	"testing"
	"time"
)

func sq(cx, cy, h float64) Ring {
	return Ring{{cx - h, cy - h}, {cx + h, cy - h}, {cx + h, cy + h}, {cx - h, cy + h}, {cx - h, cy - h}}
}

func fptr(v float64) *float64 { return &v }

func TestNFAInsideRaisesCaution(t *testing.T) {
	m := Measure{ExternalID: "nfa-1", MeasureType: "NFA", Name: "Cincu HQ NFA", Polygon: sq(24.78, 45.87, 0.02)}
	fl := Check(24.78, 45.87, 0, time.Now(), []Measure{m})
	if len(fl) != 1 || fl[0].Severity != "caution" {
		t.Fatalf("expected one caution flag, got %+v", fl)
	}
}

func TestOutsideFootprintNoFlag(t *testing.T) {
	m := Measure{ExternalID: "nfa-1", MeasureType: "NFA", Polygon: sq(24.78, 45.87, 0.01)}
	if fl := Check(25.50, 46.50, 0, time.Now(), []Measure{m}); len(fl) != 0 {
		t.Fatalf("expected no flags outside footprint, got %+v", fl)
	}
}

func TestACAAltitudeBand(t *testing.T) {
	m := Measure{
		ExternalID: "aca-1", MeasureType: "ACA", Name: "Cincu ACA",
		Polygon: sq(24.78, 45.87, 0.05), MinAltM: fptr(300), MaxAltM: fptr(3000),
	}
	inBand := Check(24.78, 45.87, 1500, time.Now(), []Measure{m})
	if len(inBand) != 1 || inBand[0].Severity != "caution" {
		t.Fatalf("in-band ACA should caution, got %+v", inBand)
	}
	outBand := Check(24.78, 45.87, 6000, time.Now(), []Measure{m})
	if len(outBand) != 1 || outBand[0].Severity != "info" {
		t.Fatalf("out-of-band ACA should be info, got %+v", outBand)
	}
}

func TestInactiveMeasureIgnored(t *testing.T) {
	past := time.Now().Add(-2 * time.Hour)
	ended := time.Now().Add(-1 * time.Hour)
	m := Measure{
		ExternalID: "rfa-1", MeasureType: "RFA", Polygon: sq(24.78, 45.87, 0.02),
		EffectiveFrom: &past, EffectiveTo: &ended,
	}
	if fl := Check(24.78, 45.87, 0, time.Now(), []Measure{m}); len(fl) != 0 {
		t.Fatalf("expired measure must not flag, got %+v", fl)
	}
}

func TestDegenerateRingNeverContains(t *testing.T) {
	m := Measure{ExternalID: "x", MeasureType: "NFA", Polygon: Ring{{0, 0}, {1, 1}}}
	if fl := Check(0.5, 0.5, 0, time.Now(), []Measure{m}); len(fl) != 0 {
		t.Fatalf("degenerate ring must not raise a flag, got %+v", fl)
	}
}

func TestActiveWindowBounds(t *testing.T) {
	now := time.Now()
	from := now.Add(-time.Hour)
	to := now.Add(time.Hour)
	m := Measure{EffectiveFrom: &from, EffectiveTo: &to}
	if !m.Active(now) {
		t.Fatal("should be active within window")
	}
	if m.Active(now.Add(2 * time.Hour)) {
		t.Fatal("should be inactive after window")
	}
}
