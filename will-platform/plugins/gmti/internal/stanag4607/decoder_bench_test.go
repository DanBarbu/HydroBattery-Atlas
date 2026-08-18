package stanag4607

import (
	"os"
	"testing"
)

// Sprint 3 retrospective action #3 — decoder benchmark against a real
// RAT-31DL PCAP capture. The capture is not committed to the repo (it is
// customer-supplied and may be classified); the benchmark only runs when
// WILL_GMTI_PCAP points at a file. CI runs the synthetic-bundle benchmark.
//
// Run:
//   WILL_GMTI_PCAP=/path/to/rat-31dl.bin go test -bench=BenchmarkDecodePCAP \
//     -benchmem -run=^$ ./internal/stanag4607
//
// docs/benchmarks/sprint-04-rat-31dl-pcap.md captures the methodology and
// the recorded numbers.

func BenchmarkDecodeSyntheticBundle(b *testing.B) {
	pkt := samplePacket()
	buf, err := Encode(pkt)
	if err != nil {
		b.Fatalf("encode: %v", err)
	}
	b.SetBytes(int64(len(buf)))
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err := Decode(buf); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkDecodePCAP(b *testing.B) {
	path := os.Getenv("WILL_GMTI_PCAP")
	if path == "" {
		b.Skip("WILL_GMTI_PCAP not set; skipping real-radar benchmark")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		b.Fatalf("read pcap: %v", err)
	}
	b.SetBytes(int64(len(data)))
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err := Decode(data); err != nil {
			b.Fatalf("decode: %v", err)
		}
	}
}
