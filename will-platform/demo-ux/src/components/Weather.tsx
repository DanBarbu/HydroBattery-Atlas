import { useEffect, useMemo } from "react";
import { useState } from "react";
import { useI18n } from "../i18n";
import {
  currentConditions, impactMatrix, ASSET_LABEL, demoDrift,
  type ImpactResult, type Status,
} from "../mock/metoc";

function statusClass(s: Status): string {
  return s === "GO" ? "metoc-go" : s === "CAUTION" ? "metoc-caution" : "metoc-nogo";
}

export function Weather() {
  const { t } = useI18n();
  const [bump, setBump] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setBump((b) => b + 1), 1500);
    return () => window.clearInterval(id);
  }, []);

  const now = useMemo(() => currentConditions(), [bump]);
  const matrix = useMemo<ImpactResult[]>(() => impactMatrix(now.c), [now]);
  const drift = useMemo(() => demoDrift(), []);

  return (
    <div className="metoc-shell">
      <div className="metoc-banner" role="note">
        {t("metoc.boundary")}
      </div>

      <header className="fires-header">
        <h2>{t("metoc.heading")}</h2>
        <p className="admin-hint">{t("metoc.hint")}</p>
      </header>

      <div className="metoc-grid">
        <section className="bms-panel">
          <h3>{t("metoc.conditions")}</h3>
          <div className="metoc-conditions">
            <span className="metoc-phase">{now.label}</span>
            <code className="metoc-metar">{now.metar}</code>
          </div>
          <ul className="metoc-cond-list">
            <li><span>{t("metoc.ceiling")}</span><strong>{now.c.ceilingM > 0 ? `${now.c.ceilingM} m` : "—"}</strong></li>
            <li><span>{t("metoc.visibility")}</span><strong>{now.c.visibilityM} m</strong></li>
            <li><span>{t("metoc.wind")}</span><strong>{now.c.windSpeedMps.toFixed(1)} m/s{now.c.gustMps > 0 ? ` G${now.c.gustMps.toFixed(0)}` : ""}</strong></li>
            <li><span>{t("metoc.temp")}</span><strong>{now.c.tempC}°C</strong></li>
            <li><span>{t("metoc.precip")}</span><strong>{now.c.precip}</strong></li>
            <li><span>{t("metoc.seaState")}</span><strong>{now.c.seaState} ({now.c.waveHeightM.toFixed(1)} m)</strong></li>
          </ul>
        </section>

        <section className="bms-panel metoc-matrix-panel">
          <h3>{t("metoc.impact")} <span className="badge">{matrix.length}</span></h3>
          <p className="admin-hint">{t("metoc.impactNote")}</p>
          <ul className="metoc-matrix">
            {matrix.map((r) => (
              <li key={r.assetKind} className={statusClass(r.status)}>
                <div className="metoc-asset-line">
                  <strong>{ASSET_LABEL[r.assetKind] ?? r.assetKind}</strong>
                  <span className="metoc-status-pill">{r.status}</span>
                </div>
                <div className="metoc-reasons">{r.reasons.join(" · ")}</div>
              </li>
            ))}
          </ul>
        </section>

        <section className="bms-panel">
          <h3>{t("metoc.drift")}</h3>
          <p className="admin-hint">{t("metoc.driftNote")}</p>
          <div className="metoc-drift-release">
            {t("metoc.release")}: {drift.params.lat.toFixed(3)}, {drift.params.lon.toFixed(3)} ·
            {" "}{(drift.params.durationS / 3600).toFixed(0)} h · windage {((drift.params.windage ?? 0) * 100).toFixed(0)}%
          </div>
          <ul className="metoc-drift-list">
            {drift.waypoints.map((w, i) => (
              <li key={i}>
                <span className="metoc-drift-t">+{(w.tOffsetS / 3600).toFixed(1)} h</span>
                <span className="metoc-drift-pos">{w.lat.toFixed(4)}, {w.lon.toFixed(4)}</span>
                <span className="metoc-drift-spread">±{(w.spreadM / 1000).toFixed(2)} km</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
