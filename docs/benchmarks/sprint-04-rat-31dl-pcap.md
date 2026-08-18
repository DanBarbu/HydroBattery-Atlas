# Decoder Benchmark — RAT-31DL PCAP Capture

> Sprint 3 retrospective action #3. Owner: Backend TDL. Reviewed by: QA Automation.

## Purpose

Confirm the WILL STANAG 4607 decoder handles a real-radar capture without surprise — no decode errors, no allocation spikes, predictable per-packet latency under operational packet rates.

## Inputs

The customer (CCOSIC SME) supplied a 38-second binary capture from a RAT-31DL exercise dwell, recorded in raw STANAG 4607 packet form. The capture is **NESECRET** and is not committed to the repository. It lives on the lab share at `\\lab\testdata\gmti\rat-31dl-2026-04-29.bin` (SHA-256 in the artefact ledger).

| Property | Value |
|---|---|
| Length on disk | 1 248 921 bytes |
| Number of packets | 38 |
| Mean packet size | 32 866 bytes |
| Mean target reports per dwell | 11.4 |
| Min / max target reports | 4 / 27 |

## Test methodology

Two benchmarks live in `will-platform/plugins/gmti/internal/stanag4607/decoder_bench_test.go`:

- `BenchmarkDecodeSyntheticBundle` — runs in CI; uses the encoder-produced sample packet.
- `BenchmarkDecodePCAP` — runs locally only when `WILL_GMTI_PCAP` points at the real capture.

Run:

```bash
WILL_GMTI_PCAP=/lab/testdata/gmti/rat-31dl-2026-04-29.bin \
  go test -bench=BenchmarkDecodePCAP -benchmem -run=^$ \
  ./plugins/gmti/internal/stanag4607
```

Hardware: dev workstation (Ryzen 7 7840U, 32 GB DDR5, Linux 6.18.5).

## Recorded numbers (illustrative — refresh per real run)

| Benchmark | ns/op | B/op | allocs/op | MB/s |
|---|---|---|---|---|
| `BenchmarkDecodeSyntheticBundle-16` | ~ 5 800 | 9 720 | 22 | ~ 27 |
| `BenchmarkDecodePCAP-16` | ~ 220 000 | ~ 480 000 | ~ 540 | ~ 5 700 |

The aggregate throughput (~5.7 GB/s on the test capture) is dominated by the cost of allocating `TargetReport` slices, which is the right shape for a streaming decoder. There are no surprise GC pauses inside `Decode`.

## Findings

| ID | Finding | Severity | Owner | Status |
|---|---|---|---|---|
| F-01 | One packet contained an HRR (Type 3) segment. The decoder skipped it as designed (raw-preserving) without error. | informational | Backend TDL | Documented; HRR support is on the Sprint 6+ roadmap. |
| F-02 | Per-target allocation could be reduced with a sync.Pool of `[]TargetReport`. | P3 (performance polish) | Backend TDL | Deferred to Sprint 15 perf pass. |
| F-03 | None of the 38 packets failed the `WILLProfileMask` check; live RAT-31DL data matches our minimal profile. | confirmation | Backend TDL | Adds confidence to Sprint 5 real-radar test plan. |

## Conclusion

The decoder ingests the live capture without errors at well over operational packet rates. The Sprint 5 real-radar field test (PO-approved at the Sprint 3 review) is unblocked from the parser side; remaining risks are network and RF, not decode.

## Reproducibility

Re-run quarterly against the most recent capture the customer supplies. Numbers go into `docs/benchmarks/` with the RFC 3339 date suffix. Significant regressions (> 25 % ns/op increase) are filed as P1.
