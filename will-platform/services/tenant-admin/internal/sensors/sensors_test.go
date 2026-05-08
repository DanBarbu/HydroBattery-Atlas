package sensors

import "testing"

func TestFamilyValid(t *testing.T) {
	for _, f := range []Family{FamilyLora, FamilyGMTI, FamilyCoT, FamilyMAVLink, FamilyOther} {
		if !f.Valid() {
			t.Errorf("expected %q to be valid", f)
		}
	}
	if Family("nope").Valid() {
		t.Error("expected invalid family to be rejected")
	}
}

func TestJsonToMap(t *testing.T) {
	m := jsonToMap([]byte(`{"k":1}`))
	if m["k"] != float64(1) {
		t.Fatalf("got %v", m)
	}
	if got := jsonToMap(nil); len(got) != 0 {
		t.Fatalf("nil should produce empty, got %v", got)
	}
	if got := jsonToMap([]byte("not json")); len(got) != 0 {
		t.Fatalf("invalid should produce empty, got %v", got)
	}
}
