package forward

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/will-platform/plugins/atak-mil/internal/cot"
)

func TestFromCoTRoundTrip(t *testing.T) {
	e := cot.Event{
		UID:      "tablet-7",
		Type:     "a-f-G-U-C-I",
		Time:     time.Date(2026, 5, 4, 12, 0, 0, 0, time.UTC),
		Lat:      45.8696,
		Lon:      24.7753,
		Hae:      500,
		Course:   180,
		Speed:    3.5,
		Callsign: "ALPHA-1",
	}
	tr := FromCoT(e, "tenant-uuid", "NESECRET", "atak-mil")
	b, err := tr.JSON()
	if err != nil {
		t.Fatalf("json: %v", err)
	}

	var got map[string]any
	if err := json.Unmarshal(b, &got); err != nil {
		t.Fatal(err)
	}
	if got["schema"] != "will.track.v0" {
		t.Errorf("schema=%v", got["schema"])
	}
	if got["classification"] != "NESECRET" {
		t.Errorf("classification=%v", got["classification"])
	}
	if md, ok := got["metadata"].(map[string]any); !ok || md["callsign"] != "ALPHA-1" {
		t.Errorf("callsign missing in metadata: %v", got["metadata"])
	}
}

func TestFromCoTSubstitutesNowOnZeroTime(t *testing.T) {
	e := cot.Event{UID: "x", Type: "a-f-G", Lat: 0, Lon: 0}
	tr := FromCoT(e, "t", "NESECRET", "atak-mil")
	if tr.ObservedAt == "" {
		t.Fatal("expected observed_at to be filled even with zero time")
	}
}
