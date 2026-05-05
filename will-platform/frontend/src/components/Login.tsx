import { useState, type FormEvent } from "react";
import { useI18n } from "../i18n";

interface LoginProps {
  onAuthenticated: () => void;
}

export function Login({ onAuthenticated }: LoginProps) {
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError(t("login.error.required"));
      return;
    }
    if (password !== "will-dev") {
      setError(t("login.error.invalid"));
      return;
    }
    setError(null);
    onAuthenticated();
  };

  return (
    <form className="login-form" onSubmit={handleSubmit} noValidate>
      <h2>{t("login.heading")}</h2>
      <p className="hint">{t("login.placeholder.note")}</p>

      <label htmlFor="login-username">{t("login.username")}</label>
      <input
        id="login-username"
        autoComplete="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />

      <label htmlFor="login-password">{t("login.password")}</label>
      <input
        id="login-password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      {error && (
        <p className="login-error" role="alert">
          {error}
        </p>
      )}

      <button type="submit">{t("login.submit")}</button>
    </form>
  );
}
