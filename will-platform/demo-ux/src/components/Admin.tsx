import { useState } from "react";
import { useI18n } from "../i18n";
import { tenantStore } from "../mock/tenants";
import { SensorAdmin } from "./SensorAdmin";
import { MembersAdmin } from "./MembersAdmin";
import type { Tenant } from "../types";

type Tab = "theme" | "terminology" | "sensors" | "members";

export function Admin({ onTenantChanged }: { onTenantChanged: () => void }) {
  const { t } = useI18n();
  const [tenants] = useState<Tenant[]>(tenantStore.list());
  const [selected, setSelected] = useState<Tenant>(tenantStore.active());
  const [tab, setTab] = useState<Tab>("theme");
  const [themeDraft, setThemeDraft] = useState(JSON.stringify(selected.theme, null, 2));
  const [termDraft, setTermDraft] = useState(JSON.stringify(selected.terminology, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const select = (tn: Tenant) => {
    setSelected(tn);
    setThemeDraft(JSON.stringify(tn.theme, null, 2));
    setTermDraft(JSON.stringify(tn.terminology, null, 2));
    setSavedAt(null);
    setError(null);
  };

  const makeActive = (tn: Tenant) => {
    tenantStore.setActive(tn.id);
    select(tn);
    onTenantChanged();
  };

  const parseObject = (raw: string): Record<string, unknown> | null => {
    let v: unknown;
    try {
      v = JSON.parse(raw);
    } catch (e) {
      setError(`${t("admin.error.invalidJSON")}: ${(e as Error).message}`);
      return null;
    }
    if (typeof v !== "object" || v === null || Array.isArray(v)) {
      setError(t("admin.error.notObject"));
      return null;
    }
    return v as Record<string, unknown>;
  };

  const saveTheme = () => {
    const obj = parseObject(themeDraft);
    if (!obj) return;
    const updated = tenantStore.updateTheme(selected.id, obj as Tenant["theme"]);
    setSelected(updated);
    setSavedAt(new Date().toLocaleTimeString());
    setError(null);
    onTenantChanged();
  };

  const saveTerminology = () => {
    const obj = parseObject(termDraft);
    if (!obj) return;
    const updated = tenantStore.updateTerminology(selected.id, obj as Record<string, string>);
    setSelected(updated);
    setSavedAt(new Date().toLocaleTimeString());
    setError(null);
    onTenantChanged();
  };

  return (
    <div className="admin-shell">
      <aside className="admin-tenants">
        <h3>{t("admin.tenants")}</h3>
        <ul>
          {tenants.map((tn) => (
            <li key={tn.id} className={selected.id === tn.id ? "selected" : ""}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => select(tn)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    select(tn);
                  }
                }}
              >
                <div className="tenant-name">{tn.displayName}</div>
                <div className="tenant-slug">{tn.slug}</div>
              </div>
              <button
                type="button"
                className={`make-active ${tenantStore.active().id === tn.id ? "is-active" : ""}`}
                onClick={() => makeActive(tn)}
              >
                {tenantStore.active().id === tn.id ? "✓ active" : "set active"}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="admin-editor">
        <h3>
          {t("admin.editing")}: {selected.displayName}
        </h3>
        <nav className="admin-tabs" aria-label="Admin sections">
          {(["theme", "terminology", "sensors", "members"] as Tab[]).map((x) => (
            <button key={x} type="button" onClick={() => setTab(x)} aria-pressed={tab === x} className={tab === x ? "active" : ""}>
              {t(`admin.tab.${x}`)}
            </button>
          ))}
        </nav>

        {error && (
          <p className="admin-error" role="alert">
            {error}
          </p>
        )}

        {tab === "theme" && (
          <>
            <p className="admin-hint">{t("admin.themeHint")}</p>
            <textarea value={themeDraft} onChange={(e) => setThemeDraft(e.target.value)} spellCheck={false} rows={16} />
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

        {tab === "terminology" && (
          <>
            <p className="admin-hint">{t("admin.terminologyHint")}</p>
            <textarea value={termDraft} onChange={(e) => setTermDraft(e.target.value)} spellCheck={false} rows={12} />
            <div className="admin-actions">
              <button type="button" onClick={saveTerminology}>
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
      </section>
    </div>
  );
}
