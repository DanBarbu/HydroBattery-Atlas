import { useState } from "react";
import { Login } from "./components/Login";
import { Globe } from "./components/Globe";
import { LanguageToggle } from "./components/LanguageToggle";
import { PluginInfo } from "./components/PluginInfo";
import { Admin } from "./components/Admin";
import { useI18n } from "./i18n";

type View = "ops" | "admin";

export function App() {
  const { t } = useI18n();
  const [authenticated, setAuthenticated] = useState(false);
  const [view, setView] = useState<View>("ops");

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>{t("app.title")}</h1>
        <nav className="view-toggle" aria-label={t("nav.label")}>
          {authenticated && (
            <>
              <button
                type="button"
                onClick={() => setView("ops")}
                aria-pressed={view === "ops"}
                className={view === "ops" ? "active" : ""}
              >
                {t("nav.ops")}
              </button>
              <button
                type="button"
                onClick={() => setView("admin")}
                aria-pressed={view === "admin"}
                className={view === "admin" ? "active" : ""}
              >
                {t("nav.admin")}
              </button>
            </>
          )}
        </nav>
        <LanguageToggle />
      </header>
      <main>
        {!authenticated ? (
          <Login onAuthenticated={() => setAuthenticated(true)} />
        ) : view === "ops" ? (
          <div className="ops-grid">
            <Globe />
            <PluginInfo />
          </div>
        ) : (
          <Admin />
        )}
      </main>
    </div>
  );
}
