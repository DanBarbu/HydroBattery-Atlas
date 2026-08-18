// In-page mock of the will-platform/services/bft surface. Mirrors the
// store + stale-detection behaviour so the Forces UX behaves the same way
// it will against the real backend. Situational awareness only — no
// targeting linkage (ADR-010).

export type Branch = "land" | "air" | "naval" | "sof" | "joint";
export type Echelon = "team" | "squad" | "platoon" | "company" | "battalion" | "brigade" | "unknown";
export type AssetStatus = "OPERATIONAL" | "DEGRADED" | "MAINTENANCE" | "NO_COMMS" | "BINGO" | "WINCHESTER";

export interface FriendlyAsset {
  id: string;
  externalId: string;
  callsign: string;
  platformType: string;
  branch: Branch;
  echelon: Echelon;
  lat: number;
  lon: number;
  headingDeg: number;
  speedMps: number;
  status: AssetStatus;
  lastReportAt: string;
}

const CENTER_LAT = 45.8696;
const CENTER_LON = 24.7753;
const EARTH_R = 6_378_137.0;

function offset(lat: number, lon: number, northM: number, eastM: number): [number, number] {
  const dlat = (northM / EARTH_R) * (180 / Math.PI);
  const dlon = (eastM / (EARTH_R * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
  return [lat + dlat, lon + dlon];
}

// (externalId, callsign, platformType, branch, echelon, ringRadiusM, speedMps, phase)
const OOB: Array<[string, string, string, Branch, Echelon, number, number, number]> = [
  ["LYNX-21", "VANATOR-21", "lynx_kf41", "land", "company", 1800, 7, 0],
  ["LYNX-22", "VANATOR-22", "lynx_kf41", "land", "company", 1800, 7, 1],
  ["ABRAMS-07", "TUNARI-07", "m1a2_abrams", "land", "battalion", 2600, 6, 0.7],
  ["COBRA-3", "LUPUL-3", "cobra_ii", "land", "platoon", 1200, 12, 2.1],
  ["PIRANHA-5", "SCORPION-5", "piranha_v", "land", "company", 3000, 9, 3.4],
  ["F16-01", "SOIM-01", "f16", "air", "squad", 9000, 220, 0],
  ["F16-02", "SOIM-02", "f16", "air", "squad", 9000, 220, 3.14],
  ["DISM-1", "CERCETAS-1", "dismounted", "sof", "team", 600, 1.4, 5],
];

const start = Date.now();
// One asset is deliberately left without comms to exercise NO_COMMS.
const NO_COMMS_ID = "COBRA-3";

export function friendlyAssets(): FriendlyAsset[] {
  const elapsed = (Date.now() - start) / 1000;
  const out: FriendlyAsset[] = [];
  for (const [ext, cs, ptype, branch, ech, radius, speed, phase] of OOB) {
    const omega = radius ? speed / radius : 0;
    const theta = phase + omega * elapsed;
    const [lat, lon] = offset(CENTER_LAT, CENTER_LON, radius * Math.sin(theta), radius * Math.cos(theta));
    let status: AssetStatus = "OPERATIONAL";
    if (ext === "F16-02" && Math.floor(elapsed) % 120 > 90) status = "BINGO";
    const noComms = ext === NO_COMMS_ID && Math.floor(elapsed) % 60 > 35;
    if (noComms) status = "NO_COMMS";
    out.push({
      id: `fa-${ext}`,
      externalId: ext,
      callsign: cs,
      platformType: ptype,
      branch,
      echelon: ech,
      lat: noComms ? lat : lat, // last-known position holds during no-comms
      lon,
      headingDeg: ((theta * 180) / Math.PI + 90) % 360,
      speedMps: status === "NO_COMMS" ? 0 : speed,
      status,
      lastReportAt: new Date(
        Date.now() - (status === "NO_COMMS" ? 75_000 : 1_000),
      ).toISOString(),
    });
  }
  return out;
}

export const PLATFORM_LABEL: Record<string, string> = {
  lynx_kf41: "Lynx KF41 IFV",
  m1a2_abrams: "M1A2 Abrams MBT",
  cobra_ii: "Otokar Cobra II",
  piranha_iii: "Piranha III",
  piranha_v: "Piranha V",
  f16: "F-16",
  f35: "F-35A",
  watchkeeper: "Watchkeeper X",
  dismounted: "Dismounted",
  naval: "Naval",
  other: "Other",
};
