import { useEffect, useState } from "react";
import { useI18n } from "../i18n";

interface Sensor {
  id: string;
  external_id: string;
  family: string;
  display_name: string;
  classification: string;
  enabled: boolean;
}

interface SensorAdminProps {
  tenantId: string;
}

const TENANT_API =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_TENANT_API ?? "http://localhost:8081/v1/tenants";
const ROLE_HEADER = "X-Will-Role";
const ADMIN_ROLE = "admin";

export function SensorAdmin({ tenantId }: SensorAdminProps) {
  const { t } = useI18n();
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [bulkText, setBulkText] = useState<string>(
    `[
  {"external_id":"node-001","family":"lora","display_name":"Cincu N1","home_lat":45.873,"home_lon":24.778}
]`,
  );
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const res = await fetch(`${TENANT_API}/${tenantId}/sensors`, {
        headers: { [ROLE_HEADER]: ADMIN_ROLE },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSensors(((await res.json()) as Sensor[]) ?? []);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    refresh();
  }, [tenantId]);

  const submit = async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(bulkText);
    } catch (err) {
      setError(`${t("admin.error.invalidJSON")}: ${(err as Error).message}`);
      return;
    }
    if (!Array.isArray(parsed)) {
      setError(t("sensors.error.notArray"));
      return;
    }
    try {
      const res = await fetch(`${TENANT_API}/${tenantId}/sensors`, {
        method: "POST",
        headers: { "content-type": "application/json", [ROLE_HEADER]: ADMIN_ROLE },
        body: JSON.stringify(parsed),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      setSavedAt(new Date().toLocaleTimeString());
      setError(null);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
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
          <h4>{t("sensors.bulkRegister")}</h4>
          <label htmlFor="sensor-bulk" className="visually-hidden">
            {t("sensors.bulkLabel")}
          </label>
          <textarea
            id="sensor-bulk"
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            spellCheck={false}
            rows={12}
          />
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
                <span className="sensor-name">{s.display_name}</span>
                <span className="sensor-meta">
                  {s.family} · {s.external_id} · {s.classification}
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
