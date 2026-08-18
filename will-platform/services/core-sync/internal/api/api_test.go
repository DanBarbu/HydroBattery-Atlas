package api

import "testing"

func TestDefaultClass(t *testing.T) {
	if defaultClass("") != "NESECRET" {
		t.Fatal("empty must default to NESECRET")
	}
	if defaultClass("NATO_RESTRICTED") != "NATO_RESTRICTED" {
		t.Fatal("non-empty must pass through")
	}
}
