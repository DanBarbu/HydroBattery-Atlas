import { useState } from "react";
import { useI18n } from "./i18n";
import { tenantStore } from "./mock/tenants";
import { Login } from "./components/Login";
import { Globe } from "./components/Globe";
import { PluginInfo } from "./components/PluginInfo";
import { Admin } from "./components/Admin";
import { BMS } from "./components/BMS";
import { LanguageToggle } from "./components/LanguageToggle";
import { ClassificationBanner } from "./components/ClassificationBanner";

type View = "ops" | "bms" | "admin";

export function App() {
  const { t } = useI18n();
  const [user, setUser] = useState<string | null>(null);
  const [view, setView] = useState<View>("ops");
  const [bump, setBump] = useState(0);

  if (!user) return <Login onAuthenticated={setUser} />;

  return (
    <div className="app-shell" key={bump}>
      <ClassificationBanner />
      <header className="app-header">
        <div className="app-title">
          <strong>{t("app.title")}</strong>
          <span className="app-subtitle">{t("app.subtitle")}</span>
        </div>
        <nav className="view-toggle" aria-label={t("nav.label")}>
          {(["ops", "bms", "admin"] as View[]).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v} className={view === v ? "active" : ""}>
              {t(`nav.${v}`)}
            </button>
          ))}
        </nav>
        <div className="header-right">
          <span className="active-tenant">
            {t("tenant.activeLabel")}: <strong>{tenantStore.active().displayName}</strong>
          </span>
          <span className="user-chip">{user}</span>
          <LanguageToggle />
          <button type="button" className="signout" onClick={() => setUser(null)}>
            {t("nav.signout")}
          </button>
        </div>
      </header>
      <main>
        {view === "ops" && (
          <div className="ops-grid">
            <Globe />
            <PluginInfo />
          </div>
        )}
        {view === "bms" && <BMS />}
        {view === "admin" && <Admin onTenantChanged={() => setBump((b) => b + 1)} />}
      </main>
    </div>
  );
}
