// In-page mock of the will-platform/services/bms surface. Mirrors the state
// machine in services/bms/internal/api so the operator UX behaves the same
// way it will against the real backend.
//
// Sprint-5-extension additions:
//   - F2T2EA timeline tracked per engagement
//   - TST classification on threats
//   - PNT status on threats and effectors
//   - Defended Asset List (DAL) and Engagement Zones (EZ)
//   - After-Action Review (AAR) generator
//   - Predictive analysis: track propagation, COA recommendation

export type ThreatClass = "cruise" | "ballistic" | "uav_one_way" | "aircraft" | "surface" | "swarm" | "unknown";

export type PNTStatus = "NOMINAL" | "DEGRADED" | "DENIED" | "SPOOFED_SUSPECTED";

export interface DefendedAsset {
  id: string;
  externalId: string;
  name: string;
  lat: number;
  lon: number;
  criticality: number;
}

export type EngagementZoneKind = "WEZ" | "HIDACZ" | "JEZ" | "MEZ" | "FEZ" | "ROZ";

export interface EngagementZone {
  id: string;
  name: string;
  kind: EngagementZoneKind;
  /** GeoJSON-style outer ring [[lon, lat], ...] */
  polygon: Array<[number, number]>;
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
  pntStatus: PNTStatus;
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
  pntStatus: PNTStatus;
  isTst: boolean;
  observedAt: string;
}

export type EngagementStatus = "PROPOSED" | "EXECUTING" | "COMPLETED" | "ABORTED" | "REJECTED";

export interface F2T2EAStamps {
  find?: string;
  fix?: string;
  track?: string;
  target?: string;
  engage?: string;
  assess?: string;
}

export interface Engagement {
  id: string;
  threatId: string;
  effectorId: string;
  status: EngagementStatus;
  probabilityOfKill: number;
  timeToInterceptS: number;
  isTst: boolean;
  timeline: F2T2EAStamps;
  proposedAt: string;
  approvedAt?: string;
  completedAt?: string;
  notes?: string;
}

export interface AAR {
  engagementId: string;
  threatId: string;
  effectorId: string;
  finalStatus: EngagementStatus;
  isTst: boolean;
  timeline: F2T2EAStamps;
  durationsS: {
    findToFix: number;
    fixToTrack: number;
    trackToTarget: number;
    targetToEngage: number;
    engageToAssess: number;
    findToAssess: number;
  };
  probabilityOfKill: number;
  timeToInterceptS: number;
  rationale: Record<string, number>;
  notes?: string;
  generatedAt: string;
}

// ---------------- seeds ----------------

const ASSETS: DefendedAsset[] = [
  { id: "dal-1", externalId: "cincu-hq", name: "Cincu HQ", lat: 45.8696, lon: 24.7753, criticality: 5 },
  { id: "dal-2", externalId: "constanta-naval", name: "Constanța naval area", lat: 44.1733, lon: 28.6383, criticality: 4 },
];

const ZONES: EngagementZone[] = [
  {
    id: "ez-1", name: "Cincu WEZ", kind: "WEZ",
    polygon: [
      [24.55, 45.80], [25.00, 45.80], [25.00, 45.95], [24.55, 45.95], [24.55, 45.80],
    ],
  },
  {
    id: "ez-2", name: "Constanța MEZ", kind: "MEZ",
    polygon: [
      [28.40, 44.05], [28.85, 44.05], [28.85, 44.30], [28.40, 44.30], [28.40, 44.05],
    ],
  },
];

const effectors: Effector[] = [
  { id: "eff-1", kind: "sam_area", displayName: "Patriot Bn 1", lat: 45.87, lon: 24.78, minRangeM: 3000, maxRangeM: 80_000, minAltitudeM: 50, maxAltitudeM: 25_000, maxTargetSpeedMps: 2400, roundsRemaining: 8, status: "READY", pntStatus: "NOMINAL" },
  { id: "eff-2", kind: "sam_point", displayName: "C-RAM Section", lat: 45.87, lon: 24.78, minRangeM: 50, maxRangeM: 4_000, minAltitudeM: 0, maxAltitudeM: 1_500, maxTargetSpeedMps: 700, roundsRemaining: 2000, status: "READY", pntStatus: "NOMINAL" },
  { id: "eff-3", kind: "nsm_coastal", displayName: "NSM Coastal Bty", lat: 44.20, lon: 28.65, minRangeM: 3_000, maxRangeM: 200_000, minAltitudeM: -10, maxAltitudeM: 5_000, maxTargetSpeedMps: 700, roundsRemaining: 4, status: "READY", pntStatus: "NOMINAL" },
  { id: "eff-4", kind: "c_uas", displayName: "C-UAS RF Mast", lat: 45.873, lon: 24.776, minRangeM: 50, maxRangeM: 2_500, minAltitudeM: 0, maxAltitudeM: 600, maxTargetSpeedMps: 60, roundsRemaining: 200, status: "READY", pntStatus: "NOMINAL" },
];

let threats: Threat[] = [];
let engagements: Engagement[] = [];
let seq = 0;

function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function nowISO(): string { return new Date().toISOString(); }

// ---------------- math helpers ----------------

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
function offsetLatLon(lat: number, lon: number, northM: number, eastM: number): [number, number] {
  const R = 6_378_137.0;
  const dlat = (northM / R) * (180 / Math.PI);
  const dlon = (eastM / (R * Math.cos(deg2rad(lat)))) * (180 / Math.PI);
  return [lat + dlat, lon + dlon];
}

// ---------------- scoring (mirrors services/bms/internal/scoring) ----------------

const WEIGHTS = { kinematics: 0.20, affiliation: 0.25, heading: 0.15, proximity: 0.25, classification: 0.15 };
const CLASS_SCALE: Record<ThreatClass, number> = { ballistic: 1, cruise: 0.9, swarm: 0.75, uav_one_way: 0.6, aircraft: 0.5, surface: 0.3, unknown: 0.4 };
const AFF_MAP: Record<Threat["affiliation"], number> = { H: 1, U: 0.4, N: 0, F: 0 };

function score(t: Pick<Threat, "lat" | "lon" | "speedMps" | "headingDeg" | "affiliation" | "threatClass" | "pntStatus">): { score: number; components: Record<string, number> } {
  const kinematics = clamp01(t.speedMps / 900);
  const affiliation = AFF_MAP[t.affiliation] ?? 0.5;
  let heading = 0, proximity = 0;
  for (const a of ASSETS) {
    const bearing = bearingDeg(t.lat, t.lon, a.lat, a.lon);
    const delta = angleDelta(t.headingDeg, bearing);
    heading = Math.max(heading, 1 - delta / 180);
    const d = haversineM(t.lat, t.lon, a.lat, a.lon);
    proximity = Math.max(proximity, d >= 50_000 ? 0 : 1 - d / 50_000);
  }
  const classification = CLASS_SCALE[t.threatClass] ?? 0.4;
  let raw =
    WEIGHTS.kinematics * kinematics +
    WEIGHTS.affiliation * affiliation +
    WEIGHTS.heading * heading +
    WEIGHTS.proximity * proximity +
    WEIGHTS.classification * classification;
  // PNT haircut.
  if (t.pntStatus === "DEGRADED") raw *= 0.92;
  if (t.pntStatus === "DENIED" || t.pntStatus === "SPOOFED_SUSPECTED") raw *= 0.8;
  return { score: clamp01(raw), components: { kinematics, affiliation, heading, proximity, classification } };
}

// ---------------- TST classification ----------------

const FAST_CLASSES: Record<string, boolean> = { cruise: true, ballistic: true, swarm: true };
function isTST(t: Threat): boolean {
  if (t.priorityScore >= 0.75) return true;
  if (!FAST_CLASSES[t.threatClass]) return false;
  let nearestM = Infinity;
  for (const a of ASSETS) {
    const d = haversineM(t.lat, t.lon, a.lat, a.lon);
    if (d < nearestM) nearestM = d;
  }
  if (t.speedMps <= 0 || nearestM === Infinity) return false;
  return nearestM / t.speedMps <= 30;
}

function makeThreat(input: { trackId: string; threatClass: ThreatClass; affiliation: Threat["affiliation"]; lat: number; lon: number; altitudeM: number; speedMps: number; headingDeg: number; pntStatus?: PNTStatus }): Threat {
  const t: Threat = {
    id: nextId("thr"),
    trackId: input.trackId,
    threatClass: input.threatClass,
    affiliation: input.affiliation,
    priorityScore: 0,
    rationale: {},
    lat: input.lat,
    lon: input.lon,
    altitudeM: input.altitudeM,
    speedMps: input.speedMps,
    headingDeg: input.headingDeg,
    pntStatus: input.pntStatus ?? "NOMINAL",
    isTst: false,
    observedAt: nowISO(),
  };
  const res = score(t);
  t.priorityScore = res.score;
  t.rationale = res.components;
  t.isTst = isTST(t);
  return t;
}

// Seeds.
threats = [
  makeThreat({ trackId: "track-cruise-1", threatClass: "cruise", affiliation: "H", lat: 45.92, lon: 24.78, altitudeM: 200, speedMps: 260, headingDeg: 180 }),
  makeThreat({ trackId: "track-uav-1", threatClass: "uav_one_way", affiliation: "H", lat: 45.876, lon: 24.781, altitudeM: 90, speedMps: 28, headingDeg: 195 }),
  makeThreat({ trackId: "track-aircraft-1", threatClass: "aircraft", affiliation: "U", lat: 45.95, lon: 24.65, altitudeM: 6000, speedMps: 200, headingDeg: 120 }),
  makeThreat({ trackId: "track-surface-1", threatClass: "surface", affiliation: "H", lat: 44.25, lon: 28.70, altitudeM: 0, speedMps: 28, headingDeg: 270 }),
];

// ---------------- pairing (mirrors internal/pairing) ----------------

const KIND_COMPAT: Record<Effector["kind"], Partial<Record<ThreatClass, boolean>>> = {
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
    if (!KIND_COMPAT[e.kind][t.threatClass]) continue;
    if (t.speedMps > e.maxTargetSpeedMps) continue;
    if (t.altitudeM < e.minAltitudeM || t.altitudeM > e.maxAltitudeM) continue;
    const r = haversineM(t.lat, t.lon, e.lat, e.lon);
    if (r < e.minRangeM || r > e.maxRangeM) continue;
    const margin = e.maxRangeM - r;
    if (!best) { best = { effector: e, rangeMarginM: margin, slantRangeM: r }; continue; }
    const rank = margin + e.roundsRemaining * 100;
    const bestRank = best.rangeMarginM + best.effector.roundsRemaining * 100;
    if (rank > bestRank) best = { effector: e, rangeMarginM: margin, slantRangeM: r };
  }
  return best;
}

function estimatePK(t: Threat, m: NonNullable<ReturnType<typeof bestEffector>>): number {
  const mid = (m.effector.minRangeM + m.effector.maxRangeM) / 2;
  const span = (m.effector.maxRangeM - m.effector.minRangeM) / 2 || 1;
  const closeness = Math.max(0, 1 - Math.abs(m.slantRangeM - mid) / span);
  const base = 0.5 + 0.4 * closeness;
  const speedPenalty = Math.min(1, t.speedMps / m.effector.maxTargetSpeedMps);
  return clamp01(base * (1 - 0.2 * speedPenalty));
}

// ---------------- predictive analysis ----------------

export interface Waypoint {
  t: string;
  lat: number;
  lon: number;
  uncertaintyM: number;
}

const PREDICT_HORIZON_S = 120;
const PREDICT_STEP_S = 10;

export function propagate(t: Threat): Waypoint[] {
  const wps: Waypoint[] = [];
  const t0 = new Date(t.observedAt).getTime();
  const headingRad = deg2rad(t.headingDeg);
  const cosH = Math.cos(headingRad);
  const sinH = Math.sin(headingRad);
  const sigma0 = 30;
  for (let s = 0; s <= PREDICT_HORIZON_S; s += PREDICT_STEP_S) {
    const northM = cosH * t.speedMps * s;
    const eastM = sinH * t.speedMps * s;
    const [lat, lon] = offsetLatLon(t.lat, t.lon, northM, eastM);
    wps.push({
      t: new Date(t0 + s * 1000).toISOString(),
      lat, lon,
      uncertaintyM: 3 * (sigma0 + 3 * s),
    });
  }
  return wps;
}

export interface COAStep {
  threatId: string;
  effectorId: string | null;
  probabilityOfKill: number;
  rationale: string;
}

export function recommendCOA(): COAStep[] {
  const sorted = [...threats].sort((a, b) => b.priorityScore - a.priorityScore);
  const rounds: Record<string, number> = {};
  for (const e of effectors) rounds[e.id] = e.roundsRemaining;
  const steps: COAStep[] = [];
  for (const t of sorted) {
    let best: { e: Effector; pk: number; range: number } | null = null;
    for (const e of effectors) {
      if (rounds[e.id] <= 0 || e.status !== "READY") continue;
      if (!KIND_COMPAT[e.kind][t.threatClass]) continue;
      if (t.speedMps > e.maxTargetSpeedMps) continue;
      if (t.altitudeM < e.minAltitudeM || t.altitudeM > e.maxAltitudeM) continue;
      const r = haversineM(t.lat, t.lon, e.lat, e.lon);
      if (r < e.minRangeM || r > e.maxRangeM) continue;
      const pk = estimatePK(t, { effector: e, slantRangeM: r, rangeMarginM: e.maxRangeM - r });
      if (!best || pk > best.pk) best = { e, pk, range: r };
    }
    if (!best) {
      steps.push({ threatId: t.id, effectorId: null, probabilityOfKill: 0, rationale: "no compatible effector with rounds remaining" });
      continue;
    }
    rounds[best.e.id] -= 1;
    steps.push({ threatId: t.id, effectorId: best.e.id, probabilityOfKill: best.pk, rationale: "greedy: highest expected PK" });
  }
  return steps;
}

// ---------------- AAR ----------------

function diffSeconds(a?: string, b?: string): number {
  if (!a || !b) return 0;
  return (new Date(b).getTime() - new Date(a).getTime()) / 1000;
}

export function aarFor(engagement: Engagement): AAR | null {
  const t = threats.find((x) => x.id === engagement.threatId);
  return {
    engagementId: engagement.id,
    threatId: engagement.threatId,
    effectorId: engagement.effectorId,
    finalStatus: engagement.status,
    isTst: engagement.isTst,
    timeline: engagement.timeline,
    durationsS: {
      findToFix: diffSeconds(engagement.timeline.find, engagement.timeline.fix),
      fixToTrack: diffSeconds(engagement.timeline.fix, engagement.timeline.track),
      trackToTarget: diffSeconds(engagement.timeline.track, engagement.timeline.target),
      targetToEngage: diffSeconds(engagement.timeline.target, engagement.timeline.engage),
      engageToAssess: diffSeconds(engagement.timeline.engage, engagement.timeline.assess),
      findToAssess: diffSeconds(engagement.timeline.find, engagement.timeline.assess),
    },
    probabilityOfKill: engagement.probabilityOfKill,
    timeToInterceptS: engagement.timeToInterceptS,
    rationale: t?.rationale ?? {},
    notes: engagement.notes,
    generatedAt: nowISO(),
  };
}

// ---------------- public API ----------------

export const bms = {
  effectors: (): Effector[] => effectors.slice(),
  threats: (): Threat[] => threats.slice().sort((a, b) => b.priorityScore - a.priorityScore),
  engagements: (): Engagement[] => engagements.slice().sort((a, b) => b.proposedAt.localeCompare(a.proposedAt)),
  defendedAssets: (): DefendedAsset[] => ASSETS.slice(),
  zones: (): EngagementZone[] => ZONES.slice(),
  propagate,
  recommendCOA,
  aar: aarFor,

  propose(threatId: string): { ok: true; engagement: Engagement } | { ok: false; reason: string } {
    const t = threats.find((x) => x.id === threatId);
    if (!t) return { ok: false, reason: "threat not found" };
    const match = bestEffector(t);
    if (!match) return { ok: false, reason: "no compatible effector available" };
    const now = nowISO();
    const eng: Engagement = {
      id: nextId("eng"),
      threatId,
      effectorId: match.effector.id,
      status: "PROPOSED",
      probabilityOfKill: estimatePK(t, match),
      timeToInterceptS: match.slantRangeM / 500,
      isTst: t.isTst,
      timeline: {
        find: t.observedAt,
        fix: t.observedAt,
        track: t.observedAt,
        target: now,
      },
      proposedAt: now,
    };
    engagements = [...engagements, eng];
    return { ok: true, engagement: eng };
  },

  tstApprove(threatId: string): { ok: true; engagement: Engagement } | { ok: false; reason: string } {
    const proposed = this.propose(threatId);
    if (!proposed.ok) return proposed;
    if (!proposed.engagement.isTst) {
      // Roll back the just-proposed engagement.
      engagements = engagements.filter((x) => x.id !== proposed.engagement.id);
      return { ok: false, reason: "threat is not TST-eligible" };
    }
    const out = this.transition(proposed.engagement.id, "approve", "TST fast-lane approval");
    return out ? { ok: true, engagement: out } : { ok: false, reason: "TST approval failed" };
  },

  transition(id: string, action: "approve" | "abort" | "complete", notes?: string): Engagement | null {
    const idx = engagements.findIndex((x) => x.id === id);
    if (idx < 0) return null;
    const e = engagements[idx];
    let next: Engagement | null = null;
    const now = nowISO();
    if (action === "approve" && e.status === "PROPOSED") {
      next = { ...e, status: "EXECUTING", approvedAt: now, notes, timeline: { ...e.timeline, engage: now } };
    } else if (action === "abort" && e.status === "EXECUTING") {
      next = { ...e, status: "ABORTED", completedAt: now, notes, timeline: { ...e.timeline, assess: now } };
    } else if (action === "complete" && e.status === "EXECUTING") {
      next = { ...e, status: "COMPLETED", completedAt: now, notes, timeline: { ...e.timeline, assess: now } };
      const effIdx = effectors.findIndex((x) => x.id === e.effectorId);
      if (effIdx >= 0 && effectors[effIdx].roundsRemaining > 0) effectors[effIdx].roundsRemaining -= 1;
    }
    if (!next) return null;
    engagements = engagements.map((x, i) => (i === idx ? next! : x));
    return next;
  },

  injectThreat(input: Parameters<typeof makeThreat>[0]): Threat {
    const t = makeThreat(input);
    threats = [...threats, t];
    return t;
  },

  setThreatPNT(trackIdPart: string, status: PNTStatus): number {
    let n = 0;
    threats = threats.map((t) => {
      if (!t.trackId.includes(trackIdPart)) return t;
      const updated = { ...t, pntStatus: status };
      const res = score(updated);
      updated.priorityScore = res.score;
      updated.rationale = res.components;
      updated.isTst = isTST(updated);
      n += 1;
      return updated;
    });
    return n;
  },

  injectSwarm(): number {
    const stamp = Date.now();
    for (let i = 0; i < 5; i++) {
      this.injectThreat({
        trackId: `swarm-${stamp}-${i}`,
        threatClass: "swarm",
        affiliation: "H",
        lat: 45.88 + i * 0.005,
        lon: 24.79 + i * 0.005,
        altitudeM: 100,
        speedMps: 40,
        headingDeg: 200,
      });
    }
    return 5;
  },
};
