# Sprint 5 — Sprint Review (Day 13)

**Duration:** 60 minutes.
**Audience:** PO, PM, Tech Lead, Compliance Officer, CCOSIC SME, Aerostar, STS DevOps liaison, candidate-pilot operator, range NCO from Cincu.
**Facilitator:** will-scrum-master-bravo (lead) with will-scrum-master-alpha for the Cincu segment.

## Pre-flight (T-30)

- [ ] Stack at tag `sprint-5-review` running.
- [ ] All generators running: `cot-replay`, `mavlink-sim`, `gmti-replay`, `lora-sim`, `sim-gps-puck`.
- [ ] Brigada Demo tenant seeded.
- [ ] Cincu PCAP, drive-through screencast, logs ready as backup material.
- [ ] Browser tabs ready: dashboard (Ops + Admin), edge-agent `/v1/edge/status`, plugin-loader, kms-stub, EMQX dashboard, GitLab CI.
- [ ] One Getac S410 sitting in the room with K3s installed and the edge-agent running for the disconnect demo.

## Run sheet

### 0:00 — Recap (3 min)
will-scrum-master-bravo: sprint goal in one sentence; what the audience will see.

### 0:03 — Cincu RAT-31DL field test (10 min)
Backend TDL + QA HIL:
- Walk the test plan briefly.
- Replay the captured drive-through screencast with audio; pause on the GMTI track entering the radar footprint.
- Show the radial-velocity match table (NCO-supplied speeds vs WILL-derived).
- Show `psql -c "select count(*) from tracks where track_kind='gmti' and source like '%RAT-31DL%' and observed_at > now() - interval '24 hours'"` to confirm the data is in PostgreSQL.
- Range NCO invited to add one sentence.

### 0:13 — Edge K3s install live (5 min)
DevOps On-Prem:
- On the Getac in the room, `curl http://<getac-ip>:30090/healthz` returns ok.
- `curl http://<getac-ip>:30090/v1/edge/status` shows zero pending commands.
- The audience sees a real rugged laptop running the WILL edge.

### 0:18 — Disconnected demo (12 min)
QA Automation:
- Run `./tests/e2e/disconnected-demo.sh` live.
- Watch the partition trigger; the edge agent's pending count climbs to 25.
- The 30-second sleep lands in the script.
- Network is restored; the pending count drains to 0 within ~10 seconds.
- PASS line shown on screen.

### 0:30 — Conflict resolution worked example (5 min)
Edge Engineer + Fusion Engineer:
- Open `docs/edge/conflict-resolution.md`; walk through Example 1 ("clean late arrival") and Example 2 (tie-break).
- `go test ./edge/agent/internal/outbox/... -run TestResolve` shown live on the projector.

### 0:35 — SSO shim ADR-007 (4 min)
Tech Lead + Backend Core-2:
- Open ADR-007; explain the boundary between Sprint 5 (skeleton + Binder interface), Sprint 6 (working OIDC), Sprint 10 (NPKI swap).
- Aerostar invited to comment on the ADR; their Sprint 4 ask is closed at the design level.

### 0:39 — Annual pen-test calendar (3 min)
Security Engineer:
- Open `docs/devops/annual-pentest-calendar.md`; show the 2026 calendar entries.
- STS DevOps liaison's Sprint 4 ask is closed.

### 0:42 — Gatekeeper exempt list per profile (3 min)
DevOps Cloud:
- Open `helm/values/policy-{cloud,cpg,onprem}.yaml`. Walk the three modes.
- Confirm Sprint 6 flips CPG + on-prem to enforce after the next quarterly drill.

### 0:45 — Procurement / interoperability framing (4 min)
will-scrum-master-bravo:
- Cincu live test = first NATO-standard end-to-end demo on real hardware. Concrete NSPA / NCIA conversation enabler.
- Edge offline-first = the **DIANA disconnected-environments** narrative.
- Annual pen-test calendar + Gatekeeper enforce roadmap = the next ORNISS pre-accreditation evidence layer.
- Cohort-cycle calendar refreshed; PM circulating DIANA pitch v3.

### 0:49 — Acceptance and Q&A (11 min)
PO reads each PBI and accepts/rejects. PM confirms next sprint slot.

## Failure protocol

Same as prior sprints: keep talking, switch to backup screencast, file P1 bug, root-cause before Sprint 6 planning.
