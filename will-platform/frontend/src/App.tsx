import { useState } from "react";
import { Login } from "./components/Login";
import { Globe } from "./components/Globe";
import { LanguageToggle } from "./components/LanguageToggle";
import { PluginInfo } from "./components/PluginInfo";
import { useI18n } from "./i18n";

export function App() {
  const { t } = useI18n();
  const [authenticated, setAuthenticated] = useState(false);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>{t("app.title")}</h1>
        <LanguageToggle />
      </header>
      <main>
        {authenticated ? (
          <div className="ops-grid">
            <Globe />
            <PluginInfo />
          </div>
        ) : (
          <Login onAuthenticated={() => setAuthenticated(true)} />
        )}
      </main>
    </div>
  );
}
