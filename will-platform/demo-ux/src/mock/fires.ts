// In-page mock of will-platform/services/fires. ADR-012 — READ-ONLY
// awareness. There is no propose/task/fire here, by design; only ingest of
// FSCM + fire-mission STATUS from the (simulated) authoritative fires C2,
// and an advisory deconfliction check.

export type MeasureType = "NFA" | "RFA" | "FFA" | "CFL" | "FSCL" | "RFL" | "ACA" | "MFP";
export type MissionStatus = "PLANNED" | "IN_PROGRESS" | "SHOT" | "SPLASH" | "COMPLETE" | "CANCELLED";

export interface FSCM {
  externalId: string;
  measureType: MeasureType;
  name: string;
  polygon: Array<[number, number]>;
  minAltM?: number;
  maxAltM?: number;
  active: boolean;
}

export interface FireMission {
  externalId: string;
  status: MissionStatus;
  firingUnit: string;
  acaRef: string;
  targetLat: number;
  targetLon: number;
  etaSplash?: string;
  observedAt: string;
}

export interface DeconflictFlag {
  measureId: string;
  measureType: string;
  measureName: string;
  severity: "info" | "caution";
  advisory: string;
}

const NFA: Omit<FSCM, "active"> = {
  externalId: "NFA-CINCU-HQ",
  measureType: "NFA",
  name: "NFA Cincu HQ",
  polygon: [[24.755, 45.855], [24.795, 45.855], [24.795, 45.885], [24.755, 45.885], [24.755, 45.855]],
};
const FSCL: Omit<FSCM, "active"> = {
  externalId: "FSCL-EAST",
  measureType: "FSCL",
  name: "FSCL EAST",
  polygon: [[25.10, 45.60], [25.12, 46.10]],
};
const ACA: Omit<FSCM, "active"> = {
  externalId: "ACA-CINCU-CORRIDOR",
  measureType: "ACA",
  name: "ACA Cincu Corridor",
  polygon: [[24.80, 45.80], [25.05, 45.80], [25.05, 45.95], [24.80, 45.95], [24.80, 45.80]],
  minAltM: 300,
  maxAltM: 3000,
};

const CYCLE: MissionStatus[] = ["PLANNED", "IN_PROGRESS", "SHOT", "SPLASH", "COMPLETE"];
const start = Date.now();

function phaseNow(): MissionStatus {
  const step = Math.floor((Date.now() - start) / 6000); // ~6 s per phase
  return CYCLE[step % CYCLE.length];
}

export function fscm(): FSCM[] {
  const phase = phaseNow();
  const acaActive = phase === "IN_PROGRESS" || phase === "SHOT";
  return [
    { ...NFA, active: true },
    { ...FSCL, active: true },
    { ...ACA, active: acaActive },
  ];
}

export function fireMissions(): FireMission[] {
  const phase = phaseNow();
  return [
    {
      externalId: "FM-HIMARS-001",
      status: phase,
      firingUnit: "HIMARS Bn (display label only)",
      acaRef: "ACA-CINCU-CORRIDOR",
      targetLat: 45.905,
      targetLon: 24.93,
      etaSplash:
        phase === "IN_PROGRESS" || phase === "SHOT"
          ? new Date(Date.now() + 20_000).toISOString()
          : undefined,
      observedAt: new Date().toISOString(),
    },
  ];
}

function pointInRing(lon: number, lat: number, ring: Array<[number, number]>): boolean {
  if (ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// Advisory only. Mirrors services/fires/internal/deconflict. Never blocks.
export function deconfliction(lon: number, lat: number, altM: number): DeconflictFlag[] {
  const flags: DeconflictFlag[] = [];
  for (const m of fscm()) {
    if (!m.active) continue;
    if (!pointInRing(lon, lat, m.polygon)) continue;
    if (m.measureType === "NFA") {
      flags.push({ measureId: m.externalId, measureType: m.measureType, measureName: m.name, severity: "caution", advisory: "inside an active No-Fire Area (advisory only)" });
    } else if (m.measureType === "RFA" || m.measureType === "RFL") {
      flags.push({ measureId: m.externalId, measureType: m.measureType, measureName: m.name, severity: "caution", advisory: "inside an active restrictive measure (advisory only)" });
    } else if (m.measureType === "ACA") {
      const inBand = (m.minAltM === undefined || altM >= m.minAltM) && (m.maxAltM === undefined || altM <= m.maxAltM);
      flags.push({
        measureId: m.externalId, measureType: m.measureType, measureName: m.name,
        severity: inBand ? "caution" : "info",
        advisory: inBand ? "inside an active ACA altitude band — deconflict aircraft (advisory only)" : "inside an ACA footprint, outside its altitude band (advisory only)",
      });
    } else {
      flags.push({ measureId: m.externalId, measureType: m.measureType, measureName: m.name, severity: "info", advisory: "inside an active coordination measure (advisory only)" });
    }
  }
  return flags;
}

export const MEASURE_COLOUR: Record<string, string> = {
  NFA: "#e63946",
  RFA: "#ff8a3d",
  RFL: "#ff8a3d",
  ACA: "#3273dc",
  FSCL: "#b388ff",
  CFL: "#b388ff",
  FFA: "#3ddc97",
  MFP: "#8b949e",
};
