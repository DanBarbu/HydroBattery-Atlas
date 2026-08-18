package metar

import (
	"math"
	"strings"
	"testing"
	"time"
)

var now = time.Date(2026, 5, 18, 15, 0, 0, 0, time.UTC)

func TestParseFullMetar(t *testing.T) {
	o, err := Parse([]byte("METAR LRCK 181500Z 24008KT 9999 SCT030 BKN100 18/12 Q1015"), now)
	if err != nil {
		t.Fatal(err)
	}
	if o.Station != "LRCK" {
		t.Fatalf("station=%q", o.Station)
	}
	if math.Abs(o.WindDirDeg-240) > 0.1 || math.Abs(o.WindSpeedMps-ktToMps(8)) > 0.01 {
		t.Fatalf("wind wrong: %+v", o)
	}
	if o.VisibilityM != 10000 {
		t.Fatalf("vis=%f", o.VisibilityM)
	}
	// BKN100 = 10000 ft -> ~3048 m ceiling.
	if math.Abs(o.CeilingM-3048) > 1 {
		t.Fatalf("ceiling=%f", o.CeilingM)
	}
	if !o.HasTemp || o.TempC != 18 || o.DewC != 12 || o.QNHhPa != 1015 {
		t.Fatalf("temp/qnh wrong: %+v", o)
	}
}

func TestGustAndNegativeTemp(t *testing.T) {
	o, err := Parse([]byte("LRCV 181500Z 27015G28KT 3000 BKN008 M03/M05 Q1008"), now)
	if err != nil {
		t.Fatal(err)
	}
	if math.Abs(o.GustMps-ktToMps(28)) > 0.01 {
		t.Fatalf("gust=%f", o.GustMps)
	}
	if o.VisibilityM != 3000 || math.Abs(o.CeilingM-243.84) > 1 {
		t.Fatalf("vis/ceiling: %+v", o)
	}
	if o.TempC != -3 || o.DewC != -5 {
		t.Fatalf("neg temp: %+v", o)
	}
}

func TestCavok(t *testing.T) {
	o, _ := Parse([]byte("LROP 181500Z 00000KT CAVOK 20/05 Q1020"), now)
	if o.VisibilityM != 10000 {
		t.Fatalf("CAVOK should set vis 10000, got %f", o.VisibilityM)
	}
}

func TestDefensive(t *testing.T) {
	if _, err := Parse(nil, now); err != ErrEmpty {
		t.Fatalf("empty: %v", err)
	}
	if _, err := Parse([]byte(strings.Repeat("x", MaxMessageBytes+1)), now); err != ErrTooLarge {
		t.Fatalf("oversize: %v", err)
	}
	// Garbage tokens must not panic and should yield a (mostly empty) obs.
	if _, err := Parse([]byte("!!! ??? ###"), now); err != nil {
		t.Fatalf("garbage should not error hard: %v", err)
	}
}
