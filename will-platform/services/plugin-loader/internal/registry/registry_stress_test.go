// Sprint 1 retrospective action #1: stress test the registry under a realistic
// pre-Sprint-4 plugin density. Run: go test -run TestStress -v ./internal/registry
package registry

import (
	"fmt"
	"sync"
	"testing"
	"time"
)

const stressEntries = 1_000

func TestStress1000Plugins(t *testing.T) {
	r := New()
	for i := 0; i < stressEntries; i++ {
		r.Upsert(Entry{ID: fmt.Sprintf("p-%05d", i), Name: "stress", Version: "0.1.0"})
	}
	if got := len(r.List()); got != stressEntries {
		t.Fatalf("expected %d entries, got %d", stressEntries, got)
	}

	start := time.Now()
	const reads = 100
	for i := 0; i < reads; i++ {
		_ = r.List()
	}
	elapsed := time.Since(start)
	perRead := elapsed / reads
	t.Logf("List() over %d entries: %s avg over %d reads", stressEntries, perRead, reads)
	if perRead > 5*time.Millisecond {
		t.Fatalf("List() too slow at %d entries: %s/op", stressEntries, perRead)
	}
}

func TestStress1000PluginsConcurrent(t *testing.T) {
	r := New()
	for i := 0; i < stressEntries; i++ {
		r.Upsert(Entry{ID: fmt.Sprintf("p-%05d", i)})
	}

	var wg sync.WaitGroup
	const writers = 50
	const reads = 200
	for w := 0; w < writers; w++ {
		wg.Add(1)
		go func(w int) {
			defer wg.Done()
			for i := 0; i < 20; i++ {
				r.Touch(fmt.Sprintf("p-%05d", (w*20+i)%stressEntries), StatusServing, int64(i))
			}
		}(w)
	}
	for r1 := 0; r1 < reads; r1++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = r.List()
		}()
	}
	wg.Wait()
}
