import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { bms, type AAR, type COAStep, type Effector, type Engagement, type F2T2EAStamps, type Threat } from "../mock/bms";

function priorityClass(s: number): string {
  if (s >= 0.6) return "score-high";
  if (s >= 0.35) return "score-medium";
  return "score-low";
}

function fmt(d?: string): string { return d ? new Date(d).toLocaleTimeString() : "—"; }

const F2T2EA_PHASES: Array<keyof F2T2EAStamps> = ["find", "fix", "track", "target", "engage", "assess"];

function TimelineStrip({ stamps }: { stamps: F2T2EAStamps }) {
  return (
    <div className="timeline-strip" aria-label="F2T2EA timeline">
      {F2T2EA_PHASES.map((phase) => (
        <div key={phase} className={`tl-cell ${stamps[phase] ? "tl-on" : "tl-off"}`} title={`${phase}: ${stamps[phase] ?? "—"}`}>
          <span className="tl-label">{phase[0].toUpperCase()}</span>
        </div>
      ))}
    </div>
  );
}

export function BMS() {
  const { t } = useI18n();
  const [bump, setBump] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setBump((b) => b + 1), 1500);
    return () => window.clearInterval(id);
  }, []);

  const threats = useMemo<Threat[]>(() => bms.threats(), [bump]);
  const effectors = useMemo<Effector[]>(() => bms.effectors(), [bump]);
  const engagements = useMemo<Engagement[]>(() => bms.engagements(), [bump]);
  const assets = useMemo(() => bms.defendedAssets(), []);
  const coa = useMemo<COAStep[]>(() => bms.recommendCOA(), [bump]);

  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), 2500);
    return () => window.clearTimeout(id);
  }, [flash]);

  const [aarOpen, setAarOpen] = useState<AAR | null>(null);

  const propose = (threatId: string) => {
    const res = bms.propose(threatId);
    setFlash(res.ok ? t("bms.flash.proposed") : `${t("bms.flash.noEffector")}: ${res.reason}`);
    setBump((b) => b + 1);
  };

  const tstApprove = (threatId: string) => {
    const res = bms.tstApprove(threatId);
    setFlash(res.ok ? t("bms.flash.tstApproved") : `${t("bms.flash.tstFailed")}: ${res.reason}`);
    setBump((b) => b + 1);
  };

  const transition = (id: string, action: "approve" | "abort" | "complete") => {
    const out = bms.transition(id, action);
    if (out) setFlash(`${t("bms.flash.transition")} → ${out.status}`);
    setBump((b) => b + 1);
  };

  const showAAR = (eng: Engagement) => {
    const aar = bms.aar(eng);
    if (aar) setAarOpen(aar);
  };

  const injectSwarm = () => {
    bms.injectSwarm();
    setFlash(t("bms.flash.swarmInjected"));
    setBump((b) => b + 1);
  };

  const denyGNSS = () => {
    const n = bms.setThreatPNT("uav", "DENIED");
    setFlash(`${t("bms.flash.pntDenied")} (${n})`);
    setBump((b) => b + 1);
  };

  return (
    <div className="bms-shell">
      <header className="bms-header">
        <h2>{t("bms.heading")}</h2>
        <p className="admin-hint">{t("bms.hint")}</p>
        <div className="bms-toolbar">
          <button type="button" onClick={injectSwarm}>{t("bms.injectSwarm")}</button>
          <button type="button" onClick={denyGNSS}>{t("bms.denyGNSS")}</button>
          <span className="bms-assets">
            {t("bms.defendedAssets")}: {assets.map((a) => a.name).join(" · ")}
          </span>
          {flash && <span className="bms-flash" aria-live="polite">{flash}</span>}
        </div>
      </header>

      <div className="bms-grid">
        {/* THREAT BOARD */}
        <section className="bms-panel">
          <h3>{t("bms.threats")} <span className="badge">{threats.length}</span></h3>
          <ul className="threat-list">
            {threats.map((th) => (
              <li key={th.id} className={`threat-row ${priorityClass(th.priorityScore)}`}>
                <div className="threat-line">
                  <span className="threat-class">{t(`bms.threatClass.${th.threatClass}`)}</span>
                  <span className={`affiliation aff-${th.affiliation}`}>{th.affiliation}</span>
                  {th.isTst && <span className="tst-badge" title={t("bms.tstHint")}>TST</span>}
                  {th.pntStatus !== "NOMINAL" && (
                    <span className={`pnt-badge pnt-${th.pntStatus.toLowerCase()}`} title={t(`bms.pnt.${th.pntStatus}`)}>
                      PNT {th.pntStatus}
                    </span>
                  )}
                  <span className="threat-score">{(th.priorityScore * 100).toFixed(0)}</span>
                </div>
                <div className="threat-meta">
                  <span>{th.trackId}</span>
                  <span>{th.speedMps.toFixed(0)} m/s</span>
                  <span>{th.altitudeM.toFixed(0)} m</span>
                  <span>{th.headingDeg.toFixed(0)}°</span>
                </div>
                <details className="rationale">
                  <summary>{t("bms.rationale")}</summary>
                  <ul>
                    {Object.entries(th.rationale).map(([k, v]) => (
                      <li key={k}><code>{k}</code>: {v.toFixed(2)}</li>
                    ))}
                  </ul>
                </details>
                <div className="threat-actions">
                  <button type="button" onClick={() => propose(th.id)}>{t("bms.propose")}</button>
                  {th.isTst && (
                    <button type="button" className="tst" onClick={() => tstApprove(th.id)}>
                      ⚡ {t("bms.tstApprove")}
                    </button>
                  )}
                </div>
              </li>
            ))}
            {threats.length === 0 && <li className="empty">{t("bms.empty.threats")}</li>}
          </ul>
        </section>

        {/* EFFECTOR BOARD */}
        <section className="bms-panel">
          <h3>{t("bms.effectors")} <span className="badge">{effectors.length}</span></h3>
          <ul className="effector-list">
            {effectors.map((e) => (
              <li key={e.id} className={`effector-row status-${e.status.toLowerCase()}`}>
                <div className="effector-line">
                  <strong>{e.displayName}</strong>
                  <span className="effector-kind">{e.kind}</span>
                  <span className={`status-pill status-${e.status.toLowerCase()}`}>{e.status}</span>
                </div>
                <div className="effector-meta">
                  <span>{t("bms.rounds")}: {e.roundsRemaining}</span>
                  <span>{(e.minRangeM / 1000).toFixed(0)}–{(e.maxRangeM / 1000).toFixed(0)} km</span>
                  <span>≤ {e.maxTargetSpeedMps} m/s</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* COA RECOMMENDATION (predictive) */}
        <section className="bms-panel">
          <h3>
            {t("bms.coa")} <span className="badge">{coa.length}</span>
            <span className="badge badge-predictive">{t("bms.predictive")}</span>
          </h3>
          <p className="admin-hint">{t("bms.coaHint")}</p>
          <ol className="coa-list">
            {coa.map((step, i) => {
              const t1 = threats.find((x) => x.id === step.threatId);
              const e = effectors.find((x) => x.id === step.effectorId);
              return (
                <li key={`${step.threatId}-${i}`} className={step.effectorId ? "coa-ok" : "coa-bad"}>
                  <span className="coa-rank">{i + 1}</span>
                  <span className="coa-target">
                    {t1 ? t(`bms.threatClass.${t1.threatClass}`) : "?"} {t1?.trackId ?? step.threatId}
                  </span>
                  <span>→</span>
                  <span className="coa-effector">{e?.displayName ?? "—"}</span>
                  <span className="coa-pk">PK {(step.probabilityOfKill * 100).toFixed(0)}%</span>
                  <span className="coa-rationale" title={step.rationale}>{step.rationale}</span>
                </li>
              );
            })}
            {coa.length === 0 && <li className="empty">{t("bms.empty.coa")}</li>}
          </ol>
        </section>

        {/* ENGAGEMENT QUEUE */}
        <section className="bms-panel bms-engagements">
          <h3>{t("bms.engagements")} <span className="badge">{engagements.length}</span></h3>
          <ul className="engagement-list">
            {engagements.map((eg) => {
              const eff = effectors.find((e) => e.id === eg.effectorId);
              const th = threats.find((x) => x.id === eg.threatId);
              return (
                <li key={eg.id} className={`engagement-row status-${eg.status.toLowerCase()}`}>
                  <div className="engagement-line">
                    <span className={`status-pill status-${eg.status.toLowerCase()}`}>{eg.status}</span>
                    {eg.isTst && <span className="tst-badge" title={t("bms.tstHint")}>TST</span>}
                    <span><strong>{eff?.displayName ?? eg.effectorId}</strong></span>
                    <span>→</span>
                    <span>{th ? `${t(`bms.threatClass.${th.threatClass}`)} ${th.trackId}` : eg.threatId}</span>
                  </div>
                  <TimelineStrip stamps={eg.timeline} />
                  <div className="engagement-meta">
                    <span>PK {(eg.probabilityOfKill * 100).toFixed(0)}%</span>
                    <span>TTI {eg.timeToInterceptS.toFixed(0)}s</span>
                    <span>{t("bms.proposed")} {fmt(eg.proposedAt)}</span>
                    <span>{t("bms.approved")} {fmt(eg.approvedAt)}</span>
                    <span>{t("bms.completed")} {fmt(eg.completedAt)}</span>
                  </div>
                  <div className="engagement-actions">
                    {eg.status === "PROPOSED" && (
                      <button type="button" onClick={() => transition(eg.id, "approve")}>{t("bms.approve")}</button>
                    )}
                    {eg.status === "EXECUTING" && (
                      <>
                        <button type="button" onClick={() => transition(eg.id, "complete")}>{t("bms.complete")}</button>
                        <button type="button" className="danger" onClick={() => transition(eg.id, "abort")}>{t("bms.abort")}</button>
                      </>
                    )}
                    {(eg.status === "COMPLETED" || eg.status === "ABORTED" || eg.status === "REJECTED") && (
                      <button type="button" onClick={() => showAAR(eg)}>{t("bms.aar")}</button>
                    )}
                  </div>
                </li>
              );
            })}
            {engagements.length === 0 && <li className="empty">{t("bms.empty.engagements")}</li>}
          </ul>
        </section>
      </div>

      {aarOpen && (
        <div className="aar-overlay" role="dialog" aria-modal="true" aria-label={t("bms.aar")}>
          <div className="aar-panel">
            <header>
              <h3>{t("bms.aar")}</h3>
              <button type="button" onClick={() => setAarOpen(null)} aria-label="Close">✕</button>
            </header>
            <p className="admin-hint">{aarOpen.engagementId}</p>
            <dl className="aar-grid">
              <dt>{t("bms.aarFinalStatus")}</dt><dd>{aarOpen.finalStatus}</dd>
              <dt>TST</dt><dd>{aarOpen.isTst ? "yes" : "no"}</dd>
              <dt>PK</dt><dd>{(aarOpen.probabilityOfKill * 100).toFixed(0)}%</dd>
              <dt>TTI</dt><dd>{aarOpen.timeToInterceptS.toFixed(0)} s</dd>
              <dt>Find → Assess</dt><dd>{aarOpen.durationsS.findToAssess.toFixed(1)} s</dd>
              <dt>Target → Engage</dt><dd>{aarOpen.durationsS.targetToEngage.toFixed(1)} s</dd>
              <dt>Engage → Assess</dt><dd>{aarOpen.durationsS.engageToAssess.toFixed(1)} s</dd>
            </dl>
            <h4>{t("bms.aarTimeline")}</h4>
            <TimelineStrip stamps={aarOpen.timeline} />
            <ul className="aar-stamps">
              {F2T2EA_PHASES.map((p) => (
                <li key={p}><strong>{p}</strong>: {fmt(aarOpen.timeline[p])}</li>
              ))}
            </ul>
            <h4>{t("bms.rationale")}</h4>
            <ul className="rationale">
              {Object.entries(aarOpen.rationale).map(([k, v]) => (
                <li key={k}><code>{k}</code>: {v.toFixed(2)}</li>
              ))}
            </ul>
            {aarOpen.notes && (
              <>
                <h4>Notes</h4>
                <p>{aarOpen.notes}</p>
              </>
            )}
            <p className="admin-hint">Generated {fmt(aarOpen.generatedAt)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
