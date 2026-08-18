import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { fscm, fireMissions, deconfliction, type FSCM, type FireMission } from "../mock/fires";

function missionClass(s: string): string {
  switch (s) {
    case "IN_PROGRESS":
    case "SHOT":
      return "fm-active";
    case "SPLASH":
      return "fm-splash";
    case "COMPLETE":
      return "fm-complete";
    case "CANCELLED":
      return "fm-cancelled";
    default:
      return "fm-planned";
  }
}

export function Fires() {
  const { t } = useI18n();
  const [bump, setBump] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setBump((b) => b + 1), 1500);
    return () => window.clearInterval(id);
  }, []);

  const measures = useMemo<FSCM[]>(() => fscm(), [bump]);
  const missions = useMemo<FireMission[]>(() => fireMissions(), [bump]);

  const [lat, setLat] = useState("45.905");
  const [lon, setLon] = useState("24.930");
  const [alt, setAlt] = useState("1500");
  const flags = useMemo(
    () => deconfliction(parseFloat(lon) || 0, parseFloat(lat) || 0, parseFloat(alt) || 0),
    [lon, lat, alt, bump],
  );

  return (
    <div className="fires-shell">
      <div className="fires-banner" role="note">
        {t("fires.boundary")}
      </div>

      <header className="fires-header">
        <h2>{t("fires.heading")}</h2>
        <p className="admin-hint">{t("fires.hint")}</p>
      </header>

      <div className="fires-grid">
        <section className="bms-panel">
          <h3>{t("fires.measures")} <span className="badge">{measures.length}</span></h3>
          <ul className="fscm-list">
            {measures.map((m) => (
              <li key={m.externalId} className={m.active ? "fscm-active" : "fscm-inactive"}>
                <div className="fscm-line">
                  <span className={`measure-pill m-${m.measureType.toLowerCase()}`}>{m.measureType}</span>
                  <strong>{m.name}</strong>
                  <span className={`status-pill ${m.active ? "status-ready" : "status-maintenance"}`}>
                    {m.active ? t("fires.active") : t("fires.inactive")}
                  </span>
                </div>
                {m.minAltM !== undefined && (
                  <div className="fscm-meta">{t("fires.altBand")}: {m.minAltM}–{m.maxAltM} m</div>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="bms-panel">
          <h3>{t("fires.missions")} <span className="badge">{missions.length}</span></h3>
          <p className="admin-hint">{t("fires.missionsNote")}</p>
          <ul className="fms-list">
            {missions.map((f) => (
              <li key={f.externalId} className={missionClass(f.status)}>
                <div className="fms-line">
                  <span className="status-pill">{f.status}</span>
                  <strong>{f.externalId}</strong>
                  <span className="fms-unit">{f.firingUnit}</span>
                </div>
                <div className="fms-meta">
                  <span>ACA: {f.acaRef}</span>
                  {f.etaSplash && <span>ETA splash: {new Date(f.etaSplash).toLocaleTimeString()}</span>}
                  <span>{new Date(f.observedAt).toLocaleTimeString()}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="bms-panel">
          <h3>{t("fires.deconfliction")}</h3>
          <p className="admin-hint">{t("fires.deconflictionNote")}</p>
          <div className="deconflict-form">
            <label>{t("fires.lat")}<input value={lat} onChange={(e) => setLat(e.target.value)} /></label>
            <label>{t("fires.lon")}<input value={lon} onChange={(e) => setLon(e.target.value)} /></label>
            <label>{t("fires.alt")}<input value={alt} onChange={(e) => setAlt(e.target.value)} /></label>
          </div>
          <ul className="flag-list">
            {flags.length === 0 && <li className="flag-clear">{t("fires.clear")}</li>}
            {flags.map((fl, i) => (
              <li key={`${fl.measureId}-${i}`} className={`flag-${fl.severity}`}>
                <span className="flag-sev">{fl.severity.toUpperCase()}</span>
                <span><strong>{fl.measureType}</strong> {fl.measureName} — {fl.advisory}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
