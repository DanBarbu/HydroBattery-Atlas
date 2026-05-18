import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { platforms, HULL_LABEL, type CommsLink, type Platform } from "../mock/ownship";

function commsClass(s: string): string {
  return s === "UP" ? "comms-up" : s === "DEGRADED" ? "comms-degraded" : "comms-down";
}

function CommsBar({ links }: { links: CommsLink[] }) {
  return (
    <div className="comms-bar">
      {links.map((l) => (
        <span key={l.channel} className={`comms-cell ${commsClass(l.status)}`} title={`${l.channel} · ${l.bearer} · ${l.status} · ${l.latencyMs} ms`}>
          {l.channel.toUpperCase()}
        </span>
      ))}
    </div>
  );
}

export function Naval() {
  const { t } = useI18n();
  const [bump, setBump] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setBump((b) => b + 1), 1500);
    return () => window.clearInterval(id);
  }, []);

  const fleet = useMemo<Platform[]>(() => platforms(), [bump]);
  const degraded = fleet.filter((p) => p.comms.some((c) => c.status !== "UP"));

  return (
    <div className="naval-shell">
      <header className="naval-header">
        <h2>{t("naval.heading")}</h2>
        <p className="admin-hint">{t("naval.hint")}</p>
        <div className="forces-summary">
          <span className="chip chip-total">{t("naval.platforms")}: {fleet.length}</span>
          {degraded.length > 0 && (
            <span className="chip chip-nocomms" aria-live="polite">
              {t("naval.commsDegraded")}: {degraded.map((p) => p.name).join(", ")}
            </span>
          )}
        </div>
      </header>

      <div className="naval-grid">
        {fleet.map((p) => (
          <section key={p.id} className={`naval-card emcon-${p.emconState.toLowerCase()}`}>
            <div className="naval-line">
              <strong>{p.name}</strong>
              <span className="naval-hull">{HULL_LABEL[p.hullClass] ?? p.hullClass}</span>
              <span className={`status-pill status-${p.status.toLowerCase()}`}>{p.status}</span>
              <span className={`emcon-pill emcon-${p.emconState.toLowerCase()}`}>EMCON {p.emconState}</span>
            </div>
            <div className="naval-meta">
              <span>{p.lat.toFixed(4)}, {p.lon.toFixed(4)}</span>
              <span>{p.headingDeg.toFixed(0)}°</span>
              <span>{(p.speedMps * 1.94384).toFixed(1)} kn</span>
            </div>

            <h4>{t("naval.seacom")}</h4>
            <CommsBar links={p.comms} />

            <h4>{t("naval.payloads")}</h4>
            <ul className="payload-list">
              {p.payloads.map((pl) => (
                <li key={pl.name} className={`payload-${pl.kind}`}>
                  <span className="payload-name">{pl.name}</span>
                  <span className="payload-kind">{t(`naval.kind.${pl.kind}`)}</span>
                  <span className={`status-pill status-${pl.status.toLowerCase()}`}>{pl.status}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="admin-hint naval-boundary">{t("naval.boundary")}</p>
    </div>
  );
}
