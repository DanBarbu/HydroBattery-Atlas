import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { tracks, ingest, southbound, type LegacyTrack } from "../mock/legacyc2";

function affClass(sidc: string): string {
  const a = sidc[1];
  if (a === "F" || a === "A") return "aff-F";
  if (a === "H") return "aff-H";
  if (a === "N") return "aff-N";
  return "aff-U";
}

export function LegacyC2() {
  const { t } = useI18n();
  const [bump, setBump] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setBump((b) => b + 1), 1500);
    return () => window.clearInterval(id);
  }, []);

  const trk = useMemo<LegacyTrack[]>(() => tracks(), [bump]);
  const inq = useMemo(() => ingest(), [bump]);
  const sb = useMemo(() => southbound(), [bump]);

  return (
    <div className="legacy-shell">
      <div className="legacy-banner" role="note">
        {t("legacy.boundary")}
      </div>

      <header className="legacy-header">
        <h2>{t("legacy.heading")}</h2>
        <p className="admin-hint">{t("legacy.hint")}</p>
      </header>

      <div className="legacy-grid">
        <section className="bms-panel">
          <h3>{t("legacy.northbound")} <span className="badge">JC3IEDM · AdatP-3</span></h3>
          <p className="admin-hint">{t("legacy.northboundNote")}</p>
          <ul className="ingest-list">
            {inq.map((e, i) => (
              <li key={`${e.externalId}-${i}`} className={`fmt-${e.format}`}>
                <div className="ingest-line">
                  <span className="fmt-pill">{e.format.toUpperCase()}</span>
                  <strong>{e.externalId}</strong>
                  <span className="ingest-at">{new Date(e.at).toLocaleTimeString()}</span>
                </div>
                <code className="ingest-raw">{e.raw}</code>
              </li>
            ))}
            {inq.length === 0 && <li className="empty">{t("legacy.waiting")}</li>}
          </ul>
        </section>

        <section className="bms-panel">
          <h3>{t("legacy.normalised")} <span className="badge">{trk.length}</span></h3>
          <p className="admin-hint">{t("legacy.normalisedNote")}</p>
          <ul className="legacy-track-list">
            {trk.map((x) => (
              <li key={x.externalId}>
                <div className="lt-line">
                  <span className={`affiliation ${affClass(x.app6Sidc)}`}>{x.app6Sidc[1]}</span>
                  <strong>{x.callsign}</strong>
                  <span className="lt-src">{x.sourceFormat}</span>
                  <span className="lt-class">{x.classification}</span>
                </div>
                <div className="lt-meta">
                  <span>{x.externalId}</span>
                  <span>{x.app6Sidc}</span>
                  <span>{x.lat.toFixed(4)}, {x.lon.toFixed(4)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="bms-panel">
          <h3>{t("legacy.southbound")} <span className="badge">{sb.length}</span></h3>
          <p className="admin-hint">{t("legacy.southboundNote")}</p>
          <ul className="southbound-list">
            {sb.map((m, i) => (
              <li key={`${m.trackExternalId}-${i}`}>
                <div className="sb-line">
                  <strong>{m.trackExternalId}</strong>
                  <span className="sb-sidc">{m.app6Sidc}</span>
                  <span className="sb-at">{new Date(m.renderedAt).toLocaleTimeString()}</span>
                </div>
                <pre className="sb-adatp3">{m.adatp3}</pre>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
