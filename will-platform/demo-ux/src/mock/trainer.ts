// In-page mock of will-platform/services/trainer. ADR-013 — EXERCISE
// isolated: nothing here injects into the live picture. wargame-nexus
// progression model (tiers + prerequisite gating + badges), Lattice-style
// run lifecycle ending in a graded debrief.

export interface Objective {
  id: string;
  title: string;
  weight: number;
  kind: "graded" | "pass_fail";
  target: string;
}

export interface Scenario {
  slug: string;
  title: string;
  description: string;
  difficulty: number;
  domains: string[];
  objectives: Objective[];
  prerequisites: string[];
  badge: string;
  estimatedMin: number;
}

export interface ObjectiveResult {
  objectiveId: string;
  title: string;
  weight: number;
  kind: string;
  score: number;
  passed: boolean;
}

export type RunStatus = "PLANNED" | "RUNNING" | "PAUSED" | "COMPLETE" | "ABORTED";

export interface Run {
  id: string;
  scenarioSlug: string;
  trainee: string;
  exerciseId: string;
  status: RunStatus;
  score: number;
  grade: string;
  badgeAwarded: string;
  assessment: ObjectiveResult[];
}

export const LIBRARY: Scenario[] = [
  {
    slug: "first-light", title: "First Light — Operator Basics",
    description: "Read the COP at Cincu: CoT, MAVLink and GMTI tracks, classification banner, layer toggles.",
    difficulty: 1, domains: ["cop"], prerequisites: [], badge: "WILL Operator Basic", estimatedMin: 15,
    objectives: [
      { id: "classify", title: "Correctly classify 8 of 10 tracks", weight: 60, kind: "graded", target: ">=0.8" },
      { id: "layers", title: "Isolate the GMTI picture via layer toggles", weight: 20, kind: "pass_fail", target: "demonstrated" },
      { id: "banner", title: "State the active classification", weight: 20, kind: "pass_fail", target: "correct" },
    ],
  },
  {
    slug: "cincu-gmti-drill", title: "Cincu GMTI Drill",
    description: "Hold a STANAG 4607 ground picture of a convoy through clutter.",
    difficulty: 1, domains: ["gmti"], prerequisites: ["first-light"], badge: "", estimatedMin: 20,
    objectives: [
      { id: "track-hold", title: "Hold continuous track for 5 min", weight: 70, kind: "graded", target: "continuity" },
      { id: "radial", title: "Read radial velocity sign + magnitude", weight: 30, kind: "pass_fail", target: "correct" },
    ],
  },
  {
    slug: "black-sea-swarm", title: "Black Sea Swarm",
    description: "UAV swarm + cruise on a defended asset; pair/approve, avoid friendly fire, respect the ACA.",
    difficulty: 2, domains: ["air-defence", "bft", "fires"], prerequisites: ["cincu-gmti-drill"], badge: "Air Defence Operator", estimatedMin: 30,
    objectives: [
      { id: "leakers", title: "<=1 leaker reaches the asset", weight: 40, kind: "graded", target: "<=1" },
      { id: "friendly-fire", title: "Zero friendly fire (BFT cross-check)", weight: 30, kind: "pass_fail", target: "0" },
      { id: "aca", title: "Zero ACA violations (fires deconfliction)", weight: 30, kind: "pass_fail", target: "0" },
    ],
  },
  {
    slug: "bmd-intercept", title: "BMD Intercept",
    description: "Ballistic threat at Cincu HQ; Patriot PAC-3 MSE pairing inside the window.",
    difficulty: 2, domains: ["air-defence"], prerequisites: ["cincu-gmti-drill"], badge: "", estimatedMin: 20,
    objectives: [
      { id: "pairing", title: "Patriot paired to the ballistic", weight: 50, kind: "pass_fail", target: "correct" },
      { id: "window", title: "Approve within the window", weight: 50, kind: "graded", target: "time" },
    ],
  },
  {
    slug: "emcon-silent", title: "EMCON SILENT",
    description: "Corvette loses SATCOM; keep the picture offline and resync cleanly.",
    difficulty: 3, domains: ["maritime", "edge"], prerequisites: ["black-sea-swarm"], badge: "Maritime Operator", estimatedMin: 25,
    objectives: [
      { id: "offline", title: "Maintain own-ship + COP offline", weight: 50, kind: "pass_fail", target: "no loss" },
      { id: "resync", title: "Edge outbox drains within SLA", weight: 50, kind: "graded", target: "drain time" },
    ],
  },
  {
    slug: "tst-under-pressure", title: "TST Lane Under Pressure",
    description: "Multiple TSTs at once; fast-lane within SLA, clean AAR.",
    difficulty: 3, domains: ["air-defence", "fires"], prerequisites: ["bmd-intercept", "black-sea-swarm"], badge: "", estimatedMin: 30,
    objectives: [
      { id: "tst-sla", title: "All TSTs approved within SLA", weight: 60, kind: "graded", target: "median" },
      { id: "aar", title: "AAR has no unexplained ABORT/REJECT", weight: 40, kind: "pass_fail", target: "clean" },
    ],
  },
  {
    slug: "excon-controller", title: "EXCON Controller",
    description: "Run a scenario for a cohort as the white cell: start, inject, pause, debrief.",
    difficulty: 4, domains: ["excon"], prerequisites: ["tst-under-pressure", "emcon-silent"], badge: "EXCON Controller", estimatedMin: 45,
    objectives: [
      { id: "control", title: "Drive all phases without desync", weight: 60, kind: "pass_fail", target: "demonstrated" },
      { id: "debrief", title: "Structured debrief mapped to objectives", weight: 40, kind: "graded", target: "rubric" },
    ],
  },
];

const completed = new Set<string>();
let activeRun: Run | null = null;
let seq = 0;

function id(p: string): string {
  seq += 1;
  return `${p}-${seq.toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

export function bySlug(slug: string): Scenario | undefined {
  return LIBRARY.find((s) => s.slug === slug);
}

export function unlocked(): Set<string> {
  const u = new Set<string>();
  for (const s of LIBRARY) {
    if (s.prerequisites.every((p) => completed.has(p))) u.add(s.slug);
  }
  return u;
}

export function getActiveRun(): Run | null {
  return activeRun;
}

export const trainer = {
  library: (): Scenario[] => LIBRARY,
  completed: (): string[] => [...completed],
  unlocked,
  activeRun: getActiveRun,

  start(slug: string, trainee: string): { ok: true; run: Run } | { ok: false; reason: string } {
    if (!unlocked().has(slug)) return { ok: false, reason: "scenario locked — prerequisites not met" };
    activeRun = {
      id: id("run"),
      scenarioSlug: slug,
      trainee,
      exerciseId: id("EX").toUpperCase(),
      status: "RUNNING",
      score: 0,
      grade: "",
      badgeAwarded: "",
      assessment: [],
    };
    return { ok: true, run: activeRun };
  },

  control(action: "pause" | "resume" | "abort"): Run | null {
    if (!activeRun) return null;
    if (action === "pause" && activeRun.status === "RUNNING") activeRun.status = "PAUSED";
    else if (action === "resume" && activeRun.status === "PAUSED") activeRun.status = "RUNNING";
    else if (action === "abort") {
      activeRun.status = "ABORTED";
      const done = activeRun;
      activeRun = null;
      return done;
    }
    return activeRun;
  },

  // Auto-score the active run with a plausible outcome (the demo stands in
  // for the EXCON assessment the real /complete endpoint receives).
  complete(perfect: boolean): Run | null {
    if (!activeRun || (activeRun.status !== "RUNNING" && activeRun.status !== "PAUSED")) return null;
    const sc = bySlug(activeRun.scenarioSlug);
    if (!sc) return null;
    let total = 0;
    let allPF = true;
    const breakdown: ObjectiveResult[] = sc.objectives.map((o) => {
      let s = 0;
      let passed = false;
      if (o.kind === "pass_fail") {
        passed = perfect;
        if (passed) s = o.weight;
        else allPF = false;
      } else {
        const a = perfect ? 1 : 0.55;
        s = o.weight * a;
        passed = a > 0;
      }
      total += s;
      return { objectiveId: o.id, title: o.title, weight: o.weight, kind: o.kind, score: Math.round(s * 10) / 10, passed };
    });
    let grade = "FAIL";
    if (total >= 90 && allPF) grade = "DISTINCTION";
    else if (total >= 75 && allPF) grade = "MERIT";
    else if (total >= 60 && allPF) grade = "PASS";
    const badge = grade !== "FAIL" && sc.badge ? sc.badge : "";
    activeRun.status = "COMPLETE";
    activeRun.score = Math.round(total * 10) / 10;
    activeRun.grade = grade;
    activeRun.badgeAwarded = badge;
    activeRun.assessment = breakdown;
    if (grade !== "FAIL") completed.add(sc.slug);
    const done = activeRun;
    activeRun = null;
    return done;
  },
};
