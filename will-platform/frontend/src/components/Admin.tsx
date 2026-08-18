import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { SensorAdmin } from "./SensorAdmin";
import { MembersAdmin } from "./MembersAdmin";

interface Tenant {
  id: string;
  slug: string;
  display_name: string;
  theme: Record<string, unknown>;
  features: Record<string, unknown>;
  terminology: Record<string, unknown>;
}

type Tab = "theme" | "sensors" | "members";

const TENANT_API =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_TENANT_API ?? "http://localhost:8081/v1/tenants";
const ROLE_HEADER = "X-Will-Role";
const ADMIN_ROLE = "admin";

export function Admin() {
  const { t } = useI18n();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selected, setSelected] = useState<Tenant | null>(null);
  const [tab, setTab] = useState<Tab>("theme");
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("{}");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const fetchAll = async () => {
    try {
      const res = await fetch(TENANT_API, { headers: { [ROLE_HEADER]: ADMIN_ROLE } });
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

  const select = (tn: Tenant) => {
    setSelected(tn);
    setDraft(JSON.stringify(tn.theme, null, 2));
    setSavedAt(null);
  };

  const saveTheme = async () => {
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
        headers: { "content-type": "application/json", [ROLE_HEADER]: ADMIN_ROLE },
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
            <nav className="admin-tabs" aria-label="Admin sections">
              {(["theme", "sensors", "members"] as Tab[]).map((x) => (
                <button
                  key={x}
                  type="button"
                  onClick={() => setTab(x)}
                  aria-pressed={tab === x}
                  className={tab === x ? "active" : ""}
                >
                  {t(`admin.tab.${x}`)}
                </button>
              ))}
            </nav>

            {tab === "theme" && (
              <>
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
                  <button type="button" onClick={saveTheme}>
                    {t("admin.save")}
                  </button>
                  {savedAt && (
                    <span className="admin-saved" aria-live="polite">
                      {t("admin.savedAt")}: {savedAt}
                    </span>
                  )}
                </div>
              </>
            )}

            {tab === "sensors" && <SensorAdmin tenantId={selected.id} />}
            {tab === "members" && <MembersAdmin tenantId={selected.id} />}
          </>
        ) : (
          <p>{t("admin.selectPrompt")}</p>
        )}
      </section>
    </div>
  );
}
