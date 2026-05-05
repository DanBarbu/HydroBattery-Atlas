import { useEffect, useState } from "react";
import { useI18n } from "../i18n";

interface Tenant {
  id: string;
  slug: string;
  display_name: string;
  theme: Record<string, unknown>;
  features: Record<string, unknown>;
  terminology: Record<string, unknown>;
}

const TENANT_API =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_TENANT_API ?? "http://localhost:8081/v1/tenants";

export function Admin() {
  const { t } = useI18n();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selected, setSelected] = useState<Tenant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("{}");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const fetchAll = async () => {
    try {
      const res = await fetch(TENANT_API);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Tenant[];
      setTenants(data ?? []);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const select = (t: Tenant) => {
    setSelected(t);
    setDraft(JSON.stringify(t.theme, null, 2));
    setSavedAt(null);
  };

  const save = async () => {
    if (!selected) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(draft) as Record<string, unknown>;
    } catch (err) {
      setError(`${t("admin.error.invalidJSON")}: ${(err as Error).message}`);
      return;
    }
    try {
      const res = await fetch(`${TENANT_API}/${selected.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ theme: parsed }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = (await res.json()) as Tenant;
      setSelected(updated);
      setTenants((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setSavedAt(new Date().toLocaleTimeString());
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="admin-shell">
      <aside className="admin-tenants">
        <h3>{t("admin.tenants")}</h3>
        {error && (
          <p className="admin-error" role="alert">
            {error}
          </p>
        )}
        <ul>
          {tenants.map((tn) => (
            <li
              key={tn.id}
              className={selected?.id === tn.id ? "selected" : ""}
              onClick={() => select(tn)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  select(tn);
                }
              }}
              tabIndex={0}
              role="button"
            >
              <div className="tenant-name">{tn.display_name}</div>
              <div className="tenant-slug">{tn.slug}</div>
            </li>
          ))}
        </ul>
      </aside>
      <section className="admin-editor">
        {selected ? (
          <>
            <h3>
              {t("admin.editing")}: {selected.display_name}
            </h3>
            <p className="admin-hint">{t("admin.themeHint")}</p>
            <label htmlFor="theme-editor" className="visually-hidden">
              {t("admin.themeLabel")}
            </label>
            <textarea
              id="theme-editor"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              rows={20}
            />
            <div className="admin-actions">
              <button type="button" onClick={save}>
                {t("admin.save")}
              </button>
              {savedAt && (
                <span className="admin-saved" aria-live="polite">
                  {t("admin.savedAt")}: {savedAt}
                </span>
              )}
            </div>
          </>
        ) : (
          <p>{t("admin.selectPrompt")}</p>
        )}
      </section>
    </div>
  );
}
