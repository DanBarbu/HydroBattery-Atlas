import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { friendlyAssets, PLATFORM_LABEL, type Branch, type FriendlyAsset } from "../mock/bft";

const BRANCH_ORDER: Branch[] = ["land", "air", "naval", "sof", "joint"];

function statusClass(s: string): string {
  switch (s) {
    case "OPERATIONAL": return "fa-ok";
    case "DEGRADED": return "fa-degraded";
    case "BINGO":
    case "WINCHESTER": return "fa-warn";
    case "NO_COMMS": return "fa-nocomms";
    default: return "fa-other";
  }
}

export function Forces() {
  const { t } = useI18n();
  const [bump, setBump] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setBump((b) => b + 1), 1500);
    return () => window.clearInterval(id);
  }, []);

  const assets = useMemo<FriendlyAsset[]>(() => friendlyAssets(), [bump]);
  const byBranch = useMemo(() => {
    const m = new Map<Branch, FriendlyAsset[]>();
    for (const a of assets) {
      const arr = m.get(a.branch) ?? [];
      arr.push(a);
      m.set(a.branch, arr);
    }
    return m;
  }, [assets]);

  const noComms = assets.filter((a) => a.status === "NO_COMMS");
  const operational = assets.filter((a) => a.status === "OPERATIONAL").length;

  return (
    <div className="forces-shell">
      <header className="forces-header">
        <h2>{t("forces.heading")}</h2>
        <p className="admin-hint">{t("forces.hint")}</p>
        <div className="forces-summary">
          <span className="chip chip-ok">{t("forces.operational")}: {operational}</span>
          <span className="chip chip-total">{t("forces.total")}: {assets.length}</span>
          {noComms.length > 0 && (
            <span className="chip chip-nocomms" aria-live="polite">
              {t("forces.noComms")}: {noComms.map((a) => a.callsign).join(", ")}
            </span>
          )}
        </div>
      </header>

      <div className="forces-grid">
        {BRANCH_ORDER.filter((b) => byBranch.has(b)).map((branch) => (
          <section key={branch} className="forces-branch">
            <h3>{t(`forces.branch.${branch}`)} <span className="badge">{byBranch.get(branch)!.length}</span></h3>
            <ul className="forces-list">
              {byBranch.get(branch)!.map((a) => (
                <li key={a.id} className={`forces-row ${statusClass(a.status)}`}>
                  <div className="forces-line">
                    <span className="affiliation aff-F">F</span>
                    <strong>{a.callsign}</strong>
                    <span className="forces-platform">{PLATFORM_LABEL[a.platformType] ?? a.platformType}</span>
                    <span className={`status-pill status-${a.status.toLowerCase()}`}>{a.status}</span>
                  </div>
                  <div className="forces-meta">
                    <span>{t(`forces.echelon.${a.echelon}`)}</span>
                    <span>{a.lat.toFixed(4)}, {a.lon.toFixed(4)}</span>
                    <span>{a.headingDeg.toFixed(0)}°</span>
                    <span>{a.speedMps.toFixed(0)} m/s</span>
                    <span>{new Date(a.lastReportAt).toLocaleTimeString()}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
