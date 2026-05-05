import { useEffect, useMemo, useState } from "react";
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

interface Tenant {
  terminology?: Record<string, string>;
}

const PLUGIN_API =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_PLUGIN_API ?? "http://localhost:8080/v1/plugins";
const TENANT_API =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_TENANT_API ?? "http://localhost:8081/v1/tenants";
const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";

const POLL_MS = 5_000;
const TENANT_POLL_MS = 60_000;

// Sprint 2 retro carry-over: apply tenant terminology overrides to all
// platform-canonical strings rendered in this panel.
function applyTerminology(text: string, terminology: Record<string, string>): string {
  if (!text || !terminology || Object.keys(terminology).length === 0) return text;
  let out = text;
  for (const [from, to] of Object.entries(terminology)) {
    const re = new RegExp(`\\b${escapeRegex(from)}\\b`, "gi");
    out = out.replace(re, (match) => preserveCase(match, to));
  }
  return out;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function preserveCase(original: string, replacement: string): string {
  if (original === original.toUpperCase()) return replacement.toUpperCase();
  if (original[0] === original[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

export function PluginInfo() {
  const { t } = useI18n();
  const [plugins, setPlugins] = useState<PluginEntry[]>([]);
  const [terminology, setTerminology] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const res = await fetch(PLUGIN_API);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as PluginEntry[];
        if (!cancelled) {
          setPlugins(data ?? []);
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

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${TENANT_API}/${DEFAULT_TENANT_ID}`);
        if (!res.ok) return;
        const data = (await res.json()) as Tenant;
        if (!cancelled && data.terminology) {
          setTerminology(data.terminology as Record<string, string>);
        }
      } catch {
        // silent fallback
      }
    };
    load();
    const id = window.setInterval(load, TENANT_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const heading = useMemo(
    () => applyTerminology(t("plugins.heading"), terminology),
    [t, terminology],
  );
  const empty = useMemo(
    () => applyTerminology(t("plugins.empty"), terminology),
    [t, terminology],
  );

  return (
    <aside className="plugin-info">
      <h3>{heading}</h3>
      {error && (
        <p className="plugin-info-error" role="alert">
          {applyTerminology(t("plugins.error"), terminology)}: {error}
        </p>
      )}
      {plugins.length === 0 && !error && <p>{empty}</p>}
      <ul>
        {plugins.map((p) => (
          <li key={p.id} className={`plugin-status-${p.status.toLowerCase()}`}>
            <div className="plugin-name">{applyTerminology(p.name, terminology)}</div>
            <div className="plugin-meta">
              <span>v{p.version}</span>
              <span>{p.contract_version}</span>
              <span>{p.status}</span>
              <span>{p.latency_ms} ms</span>
            </div>
            {p.description && (
              <div className="plugin-description">
                {applyTerminology(p.description, terminology)}
              </div>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
