import { useI18n, type Locale } from "../i18n";

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="language-toggle" role="group" aria-label={t("language.toggle")}>
      {(["en", "ro"] as Locale[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          className={locale === l ? "active" : ""}
        >
          {t(`language.${l}`)}
        </button>
      ))}
    </div>
  );
}
