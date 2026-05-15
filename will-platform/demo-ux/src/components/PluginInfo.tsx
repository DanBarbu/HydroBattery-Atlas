import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { pluginsNow } from "../mock/plugins";
import type { PluginEntry } from "../types";

export function PluginInfo() {
  const { t } = useI18n();
  const [plugins, setPlugins] = useState<PluginEntry[]>(pluginsNow());

  useEffect(() => {
    const id = window.setInterval(() => setPlugins(pluginsNow()), 5_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <aside className="plugin-info">
      <h3>{t("plugins.heading")}</h3>
      {plugins.length === 0 && <p>{t("plugins.empty")}</p>}
      <ul>
        {plugins.map((p) => (
          <li key={p.id} className={`plugin-status-${p.status.toLowerCase()}`}>
            <div className="plugin-name">{t(p.name)}</div>
            <div className="plugin-meta">
              <span>v{p.version}</span>
              <span>{p.contractVersion}</span>
              <span>{p.status}</span>
              <span>{p.latencyMs} ms</span>
            </div>
            <div className="plugin-description">{t(p.description)}</div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
