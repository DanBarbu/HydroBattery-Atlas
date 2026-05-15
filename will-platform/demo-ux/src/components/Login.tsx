import { useState, type FormEvent } from "react";
import { useI18n } from "../i18n";
import { LanguageToggle } from "./LanguageToggle";

export function Login({ onAuthenticated }: { onAuthenticated: (user: string) => void }) {
  const { t } = useI18n();
  const [username, setUsername] = useState("operator");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError(t("login.error.required"));
      return;
    }
    if (password !== "will-dev") {
      setError(t("login.error.invalid"));
      return;
    }
    setError(null);
    onAuthenticated(username.trim());
  };

  return (
    <div className="login-page">
      <div className="login-topbar">
        <span className="brand">WILL</span>
        <LanguageToggle />
      </div>
      <form className="login-form" onSubmit={submit} noValidate>
        <h2>{t("login.heading")}</h2>
        <p className="hint">{t("login.hint")}</p>
        <label htmlFor="u">{t("login.username")}</label>
        <input id="u" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <label htmlFor="p">{t("login.password")}</label>
        <input id="p" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit">{t("login.submit")}</button>
      </form>
    </div>
  );
}
