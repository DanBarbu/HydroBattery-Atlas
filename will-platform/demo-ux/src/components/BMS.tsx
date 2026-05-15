import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { bms, type Effector, type Engagement, type Threat } from "../mock/bms";

function priorityClass(s: number): string {
  if (s >= 0.6) return "score-high";
  if (s >= 0.35) return "score-medium";
  return "score-low";
}

function fmt(d?: string): string {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString();
}

export function BMS() {
  const { t } = useI18n();
  const [bump, setBump] = useState(0);
  // Refresh on a 1.5 s tick so any propose/approve/complete is visible.
  useEffect(() => {
    const id = window.setInterval(() => setBump((b) => b + 1), 1500);
    return () => window.clearInterval(id);
  }, []);

  const threats = useMemo<Threat[]>(() => bms.threats(), [bump]);
  const effectors = useMemo<Effector[]>(() => bms.effectors(), [bump]);
  const engagements = useMemo<Engagement[]>(() => bms.engagements(), [bump]);
  const assets = useMemo(() => bms.defendedAssets(), []);

  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), 2500);
    return () => window.clearTimeout(id);
  }, [flash]);

  const propose = (threatId: string) => {
    const res = bms.propose(threatId);
    if (res.ok) {
      setFlash(t("bms.flash.proposed"));
    } else {
      setFlash(`${t("bms.flash.noEffector")}: ${res.reason}`);
    }
    setBump((b) => b + 1);
  };

  const transition = (id: string, action: "approve" | "abort" | "complete") => {
    const out = bms.transition(id, action);
    if (out) {
      setFlash(`${t("bms.flash.transition")} → ${out.status}`);
    }
    setBump((b) => b + 1);
  };

  const injectSwarm = () => {
    for (let i = 0; i < 5; i++) {
      bms.injectThreat({
        trackId: `swarm-${Date.now()}-${i}`,
        threatClass: "swarm",
        affiliation: "H",
        lat: 45.88 + i * 0.005,
        lon: 24.79 + i * 0.005,
        altitudeM: 100,
        speedMps: 40,
        headingDeg: 200,
      });
    }
    setFlash(t("bms.flash.swarmInjected"));
    setBump((b) => b + 1);
  };

  return (
    <div className="bms-shell">
      <header className="bms-header">
        <h2>{t("bms.heading")}</h2>
        <p className="admin-hint">{t("bms.hint")}</p>
        <div className="bms-toolbar">
          <button type="button" onClick={injectSwarm}>
            {t("bms.injectSwarm")}
          </button>
          <span className="bms-assets">
            {t("bms.defendedAssets")}: {assets.map((a) => a.name).join(" · ")}
          </span>
          {flash && (
            <span className="bms-flash" aria-live="polite">
              {flash}
            </span>
          )}
        </div>
      </header>

      <div className="bms-grid">
        {/* THREAT BOARD */}
        <section className="bms-panel">
          <h3>
            {t("bms.threats")} <span className="badge">{threats.length}</span>
          </h3>
          <ul className="threat-list">
            {threats.map((th) => (
              <li key={th.id} className={`threat-row ${priorityClass(th.priorityScore)}`}>
                <div className="threat-line">
                  <span className="threat-class">{t(`bms.threatClass.${th.threatClass}`)}</span>
                  <span className={`affiliation aff-${th.affiliation}`}>{th.affiliation}</span>
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
                      <li key={k}>
                        <code>{k}</code>: {v.toFixed(2)}
                      </li>
                    ))}
                  </ul>
                </details>
                <button type="button" onClick={() => propose(th.id)}>
                  {t("bms.propose")}
                </button>
              </li>
            ))}
            {threats.length === 0 && <li className="empty">{t("bms.empty.threats")}</li>}
          </ul>
        </section>

        {/* EFFECTOR BOARD */}
        <section className="bms-panel">
          <h3>
            {t("bms.effectors")} <span className="badge">{effectors.length}</span>
          </h3>
          <ul className="effector-list">
            {effectors.map((e) => (
              <li key={e.id} className={`effector-row status-${e.status.toLowerCase()}`}>
                <div className="effector-line">
                  <strong>{e.displayName}</strong>
                  <span className="effector-kind">{e.kind}</span>
                  <span className={`status-pill status-${e.status.toLowerCase()}`}>{e.status}</span>
                </div>
                <div className="effector-meta">
                  <span>
                    {t("bms.rounds")}: {e.roundsRemaining}
                  </span>
                  <span>
                    {(e.minRangeM / 1000).toFixed(0)}–{(e.maxRangeM / 1000).toFixed(0)} km
                  </span>
                  <span>≤ {e.maxTargetSpeedMps} m/s</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ENGAGEMENT QUEUE */}
        <section className="bms-panel bms-engagements">
          <h3>
            {t("bms.engagements")} <span className="badge">{engagements.length}</span>
          </h3>
          <ul className="engagement-list">
            {engagements.map((eg) => {
              const eff = effectors.find((e) => e.id === eg.effectorId);
              const th = threats.find((x) => x.id === eg.threatId);
              return (
                <li key={eg.id} className={`engagement-row status-${eg.status.toLowerCase()}`}>
                  <div className="engagement-line">
                    <span className={`status-pill status-${eg.status.toLowerCase()}`}>{eg.status}</span>
                    <span>
                      <strong>{eff?.displayName ?? eg.effectorId}</strong>
                    </span>
                    <span>→</span>
                    <span>
                      {th ? `${t(`bms.threatClass.${th.threatClass}`)} ${th.trackId}` : eg.threatId}
                    </span>
                  </div>
                  <div className="engagement-meta">
                    <span>PK {(eg.probabilityOfKill * 100).toFixed(0)}%</span>
                    <span>TTI {eg.timeToInterceptS.toFixed(0)}s</span>
                    <span>
                      {t("bms.proposed")} {fmt(eg.proposedAt)}
                    </span>
                    <span>
                      {t("bms.approved")} {fmt(eg.approvedAt)}
                    </span>
                    <span>
                      {t("bms.completed")} {fmt(eg.completedAt)}
                    </span>
                  </div>
                  <div className="engagement-actions">
                    {eg.status === "PROPOSED" && (
                      <button type="button" onClick={() => transition(eg.id, "approve")}>
                        {t("bms.approve")}
                      </button>
                    )}
                    {eg.status === "EXECUTING" && (
                      <>
                        <button type="button" onClick={() => transition(eg.id, "complete")}>
                          {t("bms.complete")}
                        </button>
                        <button type="button" className="danger" onClick={() => transition(eg.id, "abort")}>
                          {t("bms.abort")}
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
            {engagements.length === 0 && <li className="empty">{t("bms.empty.engagements")}</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
