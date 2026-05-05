import { useEffect, useState } from "react";
import { useI18n } from "../i18n";

interface PluginEntry {
  id: string;
  name: string;
  version: string;
  vendor: string;
  contract_version: string;
  capabilities: string[];
  description: string;
  status: string;
  last_seen: string;
  latency_ms: number;
}

const PLUGIN_API =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_PLUGIN_API ?? "http://localhost:8080/v1/plugins";

const POLL_MS = 5_000;

export function PluginInfo() {
  const { t } = useI18n();
  const [plugins, setPlugins] = useState<PluginEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const res = await fetch(PLUGIN_API);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as PluginEntry[];
        if (!cancelled) {
          setPlugins(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    };
    fetchOnce();
    const id = window.setInterval(fetchOnce, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return (
    <aside className="plugin-info">
      <h3>{t("plugins.heading")}</h3>
      {error && (
        <p className="plugin-info-error" role="alert">
          {t("plugins.error")}: {error}
        </p>
      )}
      {plugins.length === 0 && !error && <p>{t("plugins.empty")}</p>}
      <ul>
        {plugins.map((p) => (
          <li key={p.id} className={`plugin-status-${p.status.toLowerCase()}`}>
            <div className="plugin-name">{p.name}</div>
            <div className="plugin-meta">
              <span>v{p.version}</span>
              <span>{p.contract_version}</span>
              <span>{p.status}</span>
              <span>{p.latency_ms} ms</span>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
