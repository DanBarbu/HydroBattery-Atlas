// In-page mock of will-platform/services/metoc. ADR-015 — ADVISORY ONLY.
// Mirrors the Go impact engine (GO/CAUTION/NO_GO per asset class) and the
// Lagrangian parcel-drift advection. Nothing here tasks, launches, or
// commands anything; it answers "is this asset GO?" and "where will this
// parcel drift?" for the operator.

export type Status = "GO" | "CAUTION" | "NO_GO";

export interface Conditions {
  ceilingM: number; // 0 = none reported
  visibilityM: number;
  windSpeedMps: number;
  gustMps: number;
  tempC: number;
  precip: "none" | "light" | "moderate" | "heavy";
  seaState: number; // Douglas 0..9
  waveHeightM: number;
}

export interface ImpactResult {
  assetKind: string;
  status: Status;
  reasons: string[];
}

export const ASSET_KINDS = [
  "air_intercept", "uav", "eo_ir", "c_uas", "gmti_radar", "gun_shorad",
  "nsm_coastal", "naval", "sam_area",
];

export const ASSET_LABEL: Record<string, string> = {
  air_intercept: "CAP fighter",
  uav: "UAV (MAVLink)",
  eo_ir: "EO/IR",
  c_uas: "C-UAS (EO)",
  gmti_radar: "GMTI radar",
  gun_shorad: "Gun SHORAD",
  nsm_coastal: "NSM coastal",
  naval: "Naval surface",
  sam_area: "SAM (Patriot)",
};

function rank(s: Status): number {
  return s === "NO_GO" ? 2 : s === "CAUTION" ? 1 : 0;
}
function worst(a: Status, b: Status): Status {
  return rank(b) > rank(a) ? b : a;
}
function icingRisk(c: Conditions): boolean {
  return c.tempC <= 2 && c.tempC >= -10 && (c.precip === "moderate" || c.precip === "heavy");
}

export function assess(c: Conditions, assetKind: string): ImpactResult {
  let st: Status = "GO";
  const reasons: string[] = [];
  const add = (s: Status, why: string) => {
    st = worst(st, s);
    reasons.push(why);
  };
  const vis = c.visibilityM;
  const ceil = c.ceilingM;

  switch (assetKind) {
    case "air_intercept":
      if (ceil > 0 && ceil < 150) add("NO_GO", "ceiling below recovery minima");
      else if (ceil > 0 && ceil < 450) add("CAUTION", "low ceiling");
      if (vis > 0 && vis < 1600) add("NO_GO", "visibility below minima");
      else if (vis > 0 && vis < 5000) add("CAUTION", "reduced visibility");
      if (c.gustMps >= 18) add("CAUTION", "strong gusts (crosswind risk)");
      if (icingRisk(c)) add("CAUTION", "airframe icing risk");
      break;
    case "uav":
      if (c.windSpeedMps >= 15 || c.gustMps >= 18) add("NO_GO", "wind/gust exceeds UAV launch-recovery limit");
      else if (c.windSpeedMps >= 10) add("CAUTION", "elevated wind");
      if (icingRisk(c)) add("NO_GO", "icing — UAV not cleared");
      if (vis > 0 && vis < 800) add("CAUTION", "low visibility for visual recovery");
      break;
    case "eo_ir":
    case "c_uas":
      if (vis > 0 && vis < 1000) add("NO_GO", "EO/IR ineffective in low visibility");
      else if (vis > 0 && vis < 4000) add("CAUTION", "EO/IR degraded");
      if (ceil > 0 && ceil < 300) add("CAUTION", "low cloud limits EO/IR slant range");
      if (c.precip === "heavy") add("CAUTION", "heavy precipitation attenuates EO/IR");
      break;
    case "gmti_radar":
      if (c.precip === "heavy") add("CAUTION", "heavy precipitation attenuates radar");
      break;
    case "gun_shorad":
      if (vis > 0 && vis < 1000) add("CAUTION", "EO tracking degraded; radar mode advised");
      if (c.precip === "heavy") add("CAUTION", "heavy precipitation");
      break;
    case "nsm_coastal":
    case "naval":
      if (c.seaState >= 6 || c.waveHeightM >= 4) add("NO_GO", "sea state exceeds safe operating limit");
      else if (c.seaState >= 4 || c.waveHeightM >= 2.5) add("CAUTION", "elevated sea state");
      break;
    case "sam_area":
      if (c.precip === "heavy") add("CAUTION", "heavy precipitation (minor radar effect)");
      break;
    default:
      if (vis > 0 && vis < 1000) add("CAUTION", "low visibility");
  }
  if (reasons.length === 0) reasons.push("within operating limits");
  return { assetKind, status: st, reasons };
}

export function impactMatrix(c: Conditions): ImpactResult[] {
  return ASSET_KINDS.map((k) => assess(c, k));
}

// Weather cycle near Cincu (LRCV): clear -> fog -> high wind -> icing.
const CONDS: Array<{ label: string; metar: string; c: Conditions }> = [
  { label: "Clear", metar: "LRCV 18004KT 9999 FEW040 18/09 Q1018", c: { ceilingM: 0, visibilityM: 9999, windSpeedMps: 2, gustMps: 0, tempC: 18, precip: "none", seaState: 2, waveHeightM: 0.4 } },
  { label: "Fog / low ceiling", metar: "LRCV 18003KT 0800 BKN001 02/02 Q1013", c: { ceilingM: 30, visibilityM: 800, windSpeedMps: 1.5, gustMps: 0, tempC: 2, precip: "none", seaState: 3, waveHeightM: 0.7 } },
  { label: "High wind", metar: "LRCV 21016G22KT 9999 BKN030 12/04 Q1009", c: { ceilingM: 900, visibilityM: 9999, windSpeedMps: 8.2, gustMps: 11.3, tempC: 12, precip: "none", seaState: 5, waveHeightM: 2.6 } },
  { label: "Icing / snow", metar: "LRCV 02006KT 1200 -SN BKN008 00/M01 Q1011", c: { ceilingM: 240, visibilityM: 1200, windSpeedMps: 3, gustMps: 0, tempC: 0, precip: "moderate", seaState: 3, waveHeightM: 0.8 } },
];

const start = Date.now();
export function currentConditions(): { label: string; metar: string; c: Conditions } {
  const step = Math.floor((Date.now() - start) / 6000); // ~6 s per phase
  return CONDS[step % CONDS.length];
}

// --- Lagrangian parcel drift (mirrors internal/lagrangian) -----------------

export interface DriftParams {
  lat: number;
  lon: number;
  durationS: number;
  stepS: number;
  windage?: number;
  windUEastMps?: number;
  windVNorthMps?: number;
  spreadRateMps?: number;
}
export interface Waypoint {
  tOffsetS: number;
  lat: number;
  lon: number;
  spreadM: number;
}

// Western Black-Sea surface set (Rim Current, broadly cyclonic off Constanța).
const FALLBACK_U = -0.10;
const FALLBACK_V = 0.11;

export function advect(p: DriftParams): Waypoint[] {
  const step = p.stepS > 0 ? p.stepS : 600;
  const spreadRate = p.spreadRateMps && p.spreadRateMps > 0 ? p.spreadRateMps : 0.05;
  const windage = p.windage ?? 0;
  let lat = p.lat;
  let lon = p.lon;
  const out: Waypoint[] = [{ tOffsetS: 0, lat, lon, spreadM: 0 }];
  for (let t = step; t <= p.durationS + 1e-9; t += step) {
    const uEast = FALLBACK_U + windage * (p.windUEastMps ?? 0);
    const vNorth = FALLBACK_V + windage * (p.windVNorthMps ?? 0);
    lat += (vNorth * step) / 111320.0;
    const coslat = Math.max(Math.abs(Math.cos((lat * Math.PI) / 180)), 1e-6);
    lon += (uEast * step) / (111320.0 * coslat);
    out.push({ tOffsetS: t, lat, lon, spreadM: spreadRate * t });
  }
  return out;
}

// Demo drift: a low-cost floating sensor released off Constanța, 6 h horizon.
export function demoDrift(): { params: DriftParams; waypoints: Waypoint[] } {
  const params: DriftParams = {
    lat: 44.05, lon: 29.3, durationS: 6 * 3600, stepS: 1800,
    windage: 0.02, windUEastMps: -3.0, windVNorthMps: 1.0,
  };
  return { params, waypoints: advect(params) };
}
