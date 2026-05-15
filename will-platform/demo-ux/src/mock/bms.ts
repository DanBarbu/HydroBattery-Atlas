// In-page mock of the will-platform/services/bms surface. Mirrors the state
// machine in services/bms/internal/api so the operator UX behaves the same
// way it will against the real backend.

export type ThreatClass = "cruise" | "ballistic" | "uav_one_way" | "aircraft" | "surface" | "swarm" | "unknown";

export interface DefendedAsset {
  name: string;
  lat: number;
  lon: number;
}

export interface Effector {
  id: string;
  kind: "sam_area" | "sam_point" | "nsm_coastal" | "jammer_rf" | "c_uas";
  displayName: string;
  lat: number;
  lon: number;
  minRangeM: number;
  maxRangeM: number;
  minAltitudeM: number;
  maxAltitudeM: number;
  maxTargetSpeedMps: number;
  roundsRemaining: number;
  status: "READY" | "ENGAGING" | "RELOADING" | "MAINTENANCE" | "OFFLINE";
}

export interface Threat {
  id: string;
  trackId: string;
  threatClass: ThreatClass;
  affiliation: "F" | "H" | "N" | "U";
  priorityScore: number;
  rationale: Record<string, number>;
  lat: number;
  lon: number;
  altitudeM: number;
  speedMps: number;
  headingDeg: number;
  observedAt: string;
}

export type EngagementStatus = "PROPOSED" | "APPROVED" | "EXECUTING" | "COMPLETED" | "ABORTED" | "REJECTED";

export interface Engagement {
  id: string;
  threatId: string;
  effectorId: string;
  status: EngagementStatus;
  probabilityOfKill: number;
  timeToInterceptS: number;
  proposedAt: string;
  approvedAt?: string;
  completedAt?: string;
  notes?: string;
}

const ASSETS: DefendedAsset[] = [
  { name: "Cincu HQ", lat: 45.8696, lon: 24.7753 },
  { name: "Constanța naval area", lat: 44.1733, lon: 28.6383 },
];

const effectors: Effector[] = [
  { id: "eff-1", kind: "sam_area", displayName: "Patriot Bn 1", lat: 45.87, lon: 24.78, minRangeM: 3000, maxRangeM: 80_000, minAltitudeM: 50, maxAltitudeM: 25_000, maxTargetSpeedMps: 2400, roundsRemaining: 8, status: "READY" },
  { id: "eff-2", kind: "sam_point", displayName: "C-RAM Section", lat: 45.87, lon: 24.78, minRangeM: 50, maxRangeM: 4_000, minAltitudeM: 0, maxAltitudeM: 1_500, maxTargetSpeedMps: 700, roundsRemaining: 2000, status: "READY" },
  { id: "eff-3", kind: "nsm_coastal", displayName: "NSM Coastal Bty", lat: 44.20, lon: 28.65, minRangeM: 3_000, maxRangeM: 200_000, minAltitudeM: -10, maxAltitudeM: 5_000, maxTargetSpeedMps: 700, roundsRemaining: 4, status: "READY" },
  { id: "eff-4", kind: "c_uas", displayName: "C-UAS RF Mast", lat: 45.873, lon: 24.776, minRangeM: 50, maxRangeM: 2_500, minAltitudeM: 0, maxAltitudeM: 600, maxTargetSpeedMps: 60, roundsRemaining: 200, status: "READY" },
];

let threats: Threat[] = [
  seedThreat("track-cruise-1", "cruise", "H", 45.92, 24.78, 200, 260, 180),
  seedThreat("track-uav-1", "uav_one_way", "H", 45.876, 24.781, 90, 28, 195),
  seedThreat("track-aircraft-1", "aircraft", "U", 45.95, 24.65, 6000, 200, 120),
  seedThreat("track-surface-1", "surface", "H", 44.25, 28.70, 0, 28, 270),
];

let engagements: Engagement[] = [];

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function seedThreat(trackId: string, kind: ThreatClass, affiliation: Threat["affiliation"], lat: number, lon: number, alt: number, speed: number, heading: number): Threat {
  const t: Threat = {
    id: nextId("thr"), trackId, threatClass: kind, affiliation,
    priorityScore: 0, rationale: {},
    lat, lon, altitudeM: alt, speedMps: speed, headingDeg: heading,
    observedAt: new Date().toISOString(),
  };
  const res = score(t);
  t.priorityScore = res.score;
  t.rationale = res.components;
  return t;
}

// ---------- scoring (mirrors services/bms/internal/scoring/threat.go) ----------

const WEIGHTS = { kinematics: 0.20, affiliation: 0.25, heading: 0.15, proximity: 0.25, classification: 0.15 };

function clamp01(x: number): number { return x < 0 ? 0 : x > 1 ? 1 : x; }
function deg2rad(x: number): number { return (x * Math.PI) / 180; }
function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6_371_000;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = deg2rad(lat1), φ2 = deg2rad(lat2), λ1 = deg2rad(lon1), λ2 = deg2rad(lon2);
  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
function angleDelta(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function score(t: Threat): { score: number; components: Record<string, number> } {
  const kinematics = clamp01(t.speedMps / 900);
  const affMap: Record<Threat["affiliation"], number> = { H: 1, U: 0.4, N: 0, F: 0 };
  const affiliation = affMap[t.affiliation] ?? 0.5;
  let heading = 0, proximity = 0;
  for (const a of ASSETS) {
    const bearing = bearingDeg(t.lat, t.lon, a.lat, a.lon);
    const delta = angleDelta(t.headingDeg, bearing);
    heading = Math.max(heading, 1 - delta / 180);
    const d = haversineM(t.lat, t.lon, a.lat, a.lon);
    proximity = Math.max(proximity, d >= 50_000 ? 0 : 1 - d / 50_000);
  }
  const classScale: Record<ThreatClass, number> = { ballistic: 1, cruise: 0.9, swarm: 0.75, uav_one_way: 0.6, aircraft: 0.5, surface: 0.3, unknown: 0.4 };
  const classification = classScale[t.threatClass] ?? 0.4;
  const raw =
    WEIGHTS.kinematics * kinematics +
    WEIGHTS.affiliation * affiliation +
    WEIGHTS.heading * heading +
    WEIGHTS.proximity * proximity +
    WEIGHTS.classification * classification;
  return { score: clamp01(raw), components: { kinematics, affiliation, heading, proximity, classification } };
}

// ---------- pairing (mirrors internal/pairing/pairing.go) ----------

const compatibility: Record<Effector["kind"], Partial<Record<ThreatClass, boolean>>> = {
  sam_area: { cruise: true, aircraft: true, uav_one_way: true, swarm: true },
  sam_point: { cruise: true, uav_one_way: true, swarm: true },
  nsm_coastal: { surface: true },
  jammer_rf: { uav_one_way: true, swarm: true },
  c_uas: { uav_one_way: true, swarm: true },
};

export function bestEffector(t: Threat): { effector: Effector; rangeMarginM: number; slantRangeM: number } | null {
  let best: { effector: Effector; rangeMarginM: number; slantRangeM: number } | null = null;
  for (const e of effectors) {
    if (e.status !== "READY" || e.roundsRemaining <= 0) continue;
    if (!compatibility[e.kind][t.threatClass]) continue;
    if (t.speedMps > e.maxTargetSpeedMps) continue;
    if (t.altitudeM < e.minAltitudeM || t.altitudeM > e.maxAltitudeM) continue;
    const r = haversineM(t.lat, t.lon, e.lat, e.lon);
    if (r < e.minRangeM || r > e.maxRangeM) continue;
    const margin = e.maxRangeM - r;
    const rank = margin + e.roundsRemaining * 100;
    if (!best || rank > best.rangeMarginM + best.effector.roundsRemaining * 100) {
      best = { effector: e, rangeMarginM: margin, slantRangeM: r };
    }
  }
  return best;
}

// ---------- API ----------

export const bms = {
  effectors: (): Effector[] => effectors.slice(),
  threats: (): Threat[] => threats.slice().sort((a, b) => b.priorityScore - a.priorityScore),
  engagements: (): Engagement[] => engagements.slice().sort((a, b) => b.proposedAt.localeCompare(a.proposedAt)),
  defendedAssets: (): DefendedAsset[] => ASSETS.slice(),

  propose(threatId: string): { ok: true; engagement: Engagement } | { ok: false; reason: string } {
    const t = threats.find((x) => x.id === threatId);
    if (!t) return { ok: false, reason: "threat not found" };
    const match = bestEffector(t);
    if (!match) return { ok: false, reason: "no compatible effector available" };
    const eng: Engagement = {
      id: nextId("eng"), threatId, effectorId: match.effector.id,
      status: "PROPOSED",
      probabilityOfKill: estimatePK(t, match),
      timeToInterceptS: match.slantRangeM / 500,
      proposedAt: new Date().toISOString(),
    };
    engagements = [...engagements, eng];
    return { ok: true, engagement: eng };
  },

  transition(id: string, action: "approve" | "abort" | "complete", notes?: string): Engagement | null {
    const idx = engagements.findIndex((x) => x.id === id);
    if (idx < 0) return null;
    const e = engagements[idx];
    let next: Engagement | null = null;
    const now = new Date().toISOString();
    if (action === "approve" && e.status === "PROPOSED") next = { ...e, status: "EXECUTING", approvedAt: now, notes };
    if (action === "abort" && e.status === "EXECUTING") next = { ...e, status: "ABORTED", completedAt: now, notes };
    if (action === "complete" && e.status === "EXECUTING") {
      next = { ...e, status: "COMPLETED", completedAt: now, notes };
      const effIdx = effectors.findIndex((x) => x.id === e.effectorId);
      if (effIdx >= 0 && effectors[effIdx].roundsRemaining > 0) effectors[effIdx].roundsRemaining -= 1;
    }
    if (!next) return null;
    engagements = engagements.map((x, i) => (i === idx ? next! : x));
    return next;
  },

  injectThreat(input: { trackId: string; threatClass: ThreatClass; affiliation: Threat["affiliation"]; lat: number; lon: number; altitudeM: number; speedMps: number; headingDeg: number }): Threat {
    const t = seedThreat(input.trackId, input.threatClass, input.affiliation, input.lat, input.lon, input.altitudeM, input.speedMps, input.headingDeg);
    threats = [...threats, t];
    return t;
  },
};

function estimatePK(t: Threat, m: NonNullable<ReturnType<typeof bestEffector>>): number {
  const mid = (m.effector.minRangeM + m.effector.maxRangeM) / 2;
  const span = (m.effector.maxRangeM - m.effector.minRangeM) / 2 || 1;
  const closeness = Math.max(0, 1 - Math.abs(m.slantRangeM - mid) / span);
  const base = 0.5 + 0.4 * closeness;
  const speedPenalty = Math.min(1, t.speedMps / m.effector.maxTargetSpeedMps);
  return clamp01(base * (1 - 0.2 * speedPenalty));
}
