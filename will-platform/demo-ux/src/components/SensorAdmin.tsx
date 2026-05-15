import { useState } from "react";
import { useI18n } from "../i18n";
import { tenantStore } from "../mock/tenants";
import type { Sensor } from "../types";

const FAMILIES = ["lora", "gmti", "cot", "mavlink", "other"] as const;
type Family = (typeof FAMILIES)[number];

interface RawSensor {
  external_id?: string;
  family?: string;
  display_name?: string;
  classification?: string;
}

export function SensorAdmin({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const [sensors, setSensors] = useState<Sensor[]>(tenantStore.sensors(tenantId));
  const [text, setText] = useState(
    `[
  {"external_id":"node-101","family":"lora","display_name":"Cincu N101","classification":"NESECRET"}
]`,
  );
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const submit = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      setError(`${t("admin.error.invalidJSON")}: ${(e as Error).message}`);
      return;
    }
    if (!Array.isArray(parsed)) {
      setError(t("sensors.error.notArray"));
      return;
    }
    const items = (parsed as RawSensor[])
      .filter((r) => r.external_id && r.display_name && FAMILIES.includes((r.family ?? "other") as Family))
      .map((r) => ({
        externalId: r.external_id!,
        family: (r.family ?? "other") as Family,
        displayName: r.display_name!,
        classification: r.classification ?? "NESECRET",
      }));
    tenantStore.bulkRegisterSensors(tenantId, items);
    setSensors(tenantStore.sensors(tenantId));
    setSavedAt(new Date().toLocaleTimeString());
    setError(null);
  };

  return (
    <section className="sensor-admin">
      <h3>{t("sensors.heading")}</h3>
      <p className="admin-hint">{t("sensors.hint")}</p>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      <div className="sensor-admin-grid">
        <div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} rows={12} />
          <div className="admin-actions">
            <button type="button" onClick={submit}>
              {t("sensors.register")}
            </button>
            {savedAt && (
              <span className="admin-saved" aria-live="polite">
                {t("admin.savedAt")}: {savedAt}
              </span>
            )}
          </div>
        </div>
        <div>
          <h4>
            {t("sensors.registered")} ({sensors.length})
          </h4>
          <ul className="sensor-list">
            {sensors.map((s) => (
              <li key={s.id} className={`family-${s.family}`}>
                <span className="sensor-name">{s.displayName}</span>
                <span className="sensor-meta">
                  {s.family} · {s.externalId} · {s.classification}
                </span>
              </li>
            ))}
            {sensors.length === 0 && <li>{t("sensors.empty")}</li>}
          </ul>
        </div>
      </div>
    </section>
  );
}
