import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { trainer, type Run, type Scenario } from "../mock/trainer";

const TRAINEE = "op-1";

function gradeClass(g: string): string {
  switch (g) {
    case "DISTINCTION": return "g-distinction";
    case "MERIT": return "g-merit";
    case "PASS": return "g-pass";
    case "FAIL": return "g-fail";
    default: return "";
  }
}

export function Training() {
  const { t } = useI18n();
  const [bump, setBump] = useState(0);
  const refresh = () => setBump((b) => b + 1);

  const library = useMemo<Scenario[]>(() => trainer.library(), []);
  const unlocked = useMemo(() => trainer.unlocked(), [bump]);
  const completed = useMemo(() => new Set(trainer.completed()), [bump]);
  const run = useMemo<Run | null>(() => trainer.activeRun(), [bump]);
  const [lastResult, setLastResult] = useState<Run | null>(null);
  const [badges, setBadges] = useState<string[]>([]);

  useEffect(() => {
    const id = window.setInterval(() => setBump((b) => b + 1), 1500);
    return () => window.clearInterval(id);
  }, []);

  const start = (slug: string) => {
    const r = trainer.start(slug, TRAINEE);
    if (!r.ok) setLastResult(null);
    refresh();
  };
  const ctrl = (a: "pause" | "resume" | "abort") => { trainer.control(a); refresh(); };
  const finish = (perfect: boolean) => {
    const done = trainer.complete(perfect);
    if (done) {
      setLastResult(done);
      if (done.badgeAwarded && !badges.includes(done.badgeAwarded)) {
        setBadges((b) => [...b, done.badgeAwarded]);
      }
    }
    refresh();
  };

  const byTier = useMemo(() => {
    const m = new Map<number, Scenario[]>();
    for (const s of library) {
      const arr = m.get(s.difficulty) ?? [];
      arr.push(s);
      m.set(s.difficulty, arr);
    }
    return m;
  }, [library]);

  return (
    <div className="training-shell">
      {run && (run.status === "RUNNING" || run.status === "PAUSED") && (
        <div className="exercise-banner" role="alert">
          {t("training.exerciseBanner")} · {run.exerciseId} · {run.scenarioSlug} · {run.status}
        </div>
      )}

      <header className="training-header">
        <h2>{t("training.heading")}</h2>
        <p className="admin-hint">{t("training.hint")}</p>
        {badges.length > 0 && (
          <div className="badge-row">
            {t("training.badges")}: {badges.map((b) => <span key={b} className="award-badge">🏅 {b}</span>)}
          </div>
        )}
      </header>

      {run && (
        <section className="bms-panel run-panel">
          <h3>{t("training.activeRun")} <span className="badge">{run.status}</span></h3>
          <div className="run-line">
            <strong>{trainer.library().find((s) => s.slug === run.scenarioSlug)?.title}</strong>
            <span className="run-ex">{run.exerciseId}</span>
          </div>
          <div className="run-controls">
            {run.status === "RUNNING" && <button type="button" onClick={() => ctrl("pause")}>{t("training.pause")}</button>}
            {run.status === "PAUSED" && <button type="button" onClick={() => ctrl("resume")}>{t("training.resume")}</button>}
            <button type="button" onClick={() => finish(true)}>{t("training.completePass")}</button>
            <button type="button" onClick={() => finish(false)}>{t("training.completePartial")}</button>
            <button type="button" className="danger" onClick={() => ctrl("abort")}>{t("training.abort")}</button>
          </div>
        </section>
      )}

      {lastResult && (
        <section className={`bms-panel result-panel ${gradeClass(lastResult.grade)}`}>
          <h3>{t("training.debrief")} — <span className="result-grade">{lastResult.grade}</span> · {lastResult.score.toFixed(1)}/100
            {lastResult.badgeAwarded && <span className="award-badge">🏅 {lastResult.badgeAwarded}</span>}</h3>
          <ul className="assess-list">
            {lastResult.assessment.map((a) => (
              <li key={a.objectiveId} className={a.passed ? "obj-ok" : "obj-bad"}>
                <span>{a.title}</span>
                <span className="obj-score">{a.score.toFixed(1)} / {a.weight}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="training-grid">
        {[1, 2, 3, 4].filter((tr) => byTier.has(tr)).map((tier) => (
          <section key={tier} className="bms-panel">
            <h3>{t("training.tier")} {tier} <span className="badge">{byTier.get(tier)!.length}</span></h3>
            <ul className="scenario-list">
              {byTier.get(tier)!.map((s) => {
                const isUnlocked = unlocked.has(s.slug);
                const isDone = completed.has(s.slug);
                return (
                  <li key={s.slug} className={isUnlocked ? "sc-open" : "sc-locked"}>
                    <div className="sc-line">
                      <strong>{s.title}</strong>
                      {isDone && <span className="sc-done">✓ {t("training.completed")}</span>}
                      {!isUnlocked && <span className="sc-lock">🔒 {t("training.locked")}</span>}
                    </div>
                    <p className="sc-desc">{s.description}</p>
                    <div className="sc-meta">
                      <span>{s.domains.join(" · ")}</span>
                      <span>~{s.estimatedMin} min</span>
                      {s.badge && <span>🏅 {s.badge}</span>}
                    </div>
                    {s.prerequisites.length > 0 && (
                      <div className="sc-prereq">{t("training.requires")}: {s.prerequisites.join(", ")}</div>
                    )}
                    <button
                      type="button"
                      disabled={!isUnlocked || !!run}
                      onClick={() => start(s.slug)}
                    >
                      {t("training.start")}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <section className="bms-panel">
        <h3>{t("training.leaderboard")}</h3>
        <p className="admin-hint">{t("training.leaderboardNote")}</p>
      </section>
    </div>
  );
}
