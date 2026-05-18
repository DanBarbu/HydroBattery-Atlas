// In-page mock of will-platform/services/ownship. Two Romanian Black Sea
// vessels off Constanța; the corvette cycles EMCON SILENT (SATCOM DOWN,
// HF DEGRADED) to exercise the comms-degraded / offline-first picture.
// ADR-011: WILL integrates the vessel; the vessel CMS owns its fight.

export type CommsStatus = "UP" | "DEGRADED" | "DOWN";
export type EmconState = "FULL" | "RESTRICTED" | "SILENT";
export type PlatformStatus = "UNDERWAY" | "ANCHORED" | "ACTION_STATIONS" | "MAINTENANCE";

export interface CommsLink {
  channel: "voip" | "roip" | "hf" | "vuhf" | "satcom";
  bearer: string;
  status: CommsStatus;
  latencyMs: number;
}

export interface Payload {
  name: string;
  kind: "sensor" | "effector";
  payloadType: string;
  status: "READY" | "DEGRADED" | "OFFLINE";
}

export interface Platform {
  id: string;
  externalId: string;
  name: string;
  hullClass: "mmpv_90_corvette" | "hisar_opv" | "other";
  lat: number;
  lon: number;
  headingDeg: number;
  speedMps: number;
  status: PlatformStatus;
  emconState: EmconState;
  comms: CommsLink[];
  payloads: Payload[];
}

const C_LAT = 44.1733;
const C_LON = 28.8;
const EARTH_R = 6_378_137.0;
const start = Date.now();

function offset(lat: number, lon: number, northM: number, eastM: number): [number, number] {
  const dlat = (northM / EARTH_R) * (180 / Math.PI);
  const dlon = (eastM / (EARTH_R * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
  return [lat + dlat, lon + dlon];
}

const CORVETTE_PAYLOADS: Payload[] = [
  { name: "3D AESA radar", kind: "sensor", payloadType: "3d_radar", status: "READY" },
  { name: "Hull sonar", kind: "sensor", payloadType: "sonar", status: "READY" },
  { name: "NSM launcher", kind: "effector", payloadType: "nsm", status: "READY" },
  { name: "76 mm gun", kind: "effector", payloadType: "naval_gun", status: "READY" },
  { name: "CIWS", kind: "effector", payloadType: "ciws", status: "READY" },
  { name: "Decoy launcher", kind: "effector", payloadType: "decoy", status: "READY" },
];

const OPV_PAYLOADS: Payload[] = [
  { name: "Surface search radar", kind: "sensor", payloadType: "2d_radar", status: "READY" },
  { name: "EO/IR director", kind: "sensor", payloadType: "eo_ir", status: "READY" },
  { name: "57 mm gun", kind: "effector", payloadType: "naval_gun", status: "READY" },
];

function corvetteComms(silent: boolean): CommsLink[] {
  if (silent) {
    return [
      { channel: "voip", bearer: "intra-ship", status: "UP", latencyMs: 4 },
      { channel: "roip", bearer: "intra-ship", status: "UP", latencyMs: 6 },
      { channel: "hf", bearer: "HF-ALE", status: "DEGRADED", latencyMs: 1800 },
      { channel: "vuhf", bearer: "Link-line", status: "UP", latencyMs: 40 },
      { channel: "satcom", bearer: "Ka", status: "DOWN", latencyMs: 0 },
    ];
  }
  return [
    { channel: "voip", bearer: "intra-ship", status: "UP", latencyMs: 4 },
    { channel: "roip", bearer: "intra-ship", status: "UP", latencyMs: 6 },
    { channel: "hf", bearer: "HF-ALE", status: "UP", latencyMs: 900 },
    { channel: "vuhf", bearer: "Link-line", status: "UP", latencyMs: 35 },
    { channel: "satcom", bearer: "Ka", status: "UP", latencyMs: 620 },
  ];
}

export function platforms(): Platform[] {
  const elapsed = (Date.now() - start) / 1000;
  const silent = Math.floor(elapsed) % 120 > 80;

  const thetaC = (elapsed / 240) * 2 * Math.PI;
  const [clat, clon] = offset(C_LAT, C_LON, 9_000 * Math.sin(thetaC), 9_000 * Math.cos(thetaC));
  const thetaO = (elapsed / 480) * 2 * Math.PI;
  const [olat, olon] = offset(C_LAT, C_LON, 28_000 * Math.sin(thetaO), 30_000 * Math.cos(thetaO));

  return [
    {
      id: "plt-corvette-1",
      externalId: "CORVETTE-1",
      name: "F-Vânătorul",
      hullClass: "mmpv_90_corvette",
      lat: clat,
      lon: clon,
      headingDeg: ((thetaC * 180) / Math.PI + 90) % 360,
      speedMps: 9,
      status: silent ? "ACTION_STATIONS" : "UNDERWAY",
      emconState: silent ? "SILENT" : "FULL",
      comms: corvetteComms(silent),
      payloads: CORVETTE_PAYLOADS,
    },
    {
      id: "plt-opv-1",
      externalId: "OPV-1",
      name: "P-Bârsa",
      hullClass: "hisar_opv",
      lat: olat,
      lon: olon,
      headingDeg: ((thetaO * 180) / Math.PI + 90) % 360,
      speedMps: 6.5,
      status: "UNDERWAY",
      emconState: "FULL",
      comms: [
        { channel: "voip", bearer: "intra-ship", status: "UP", latencyMs: 4 },
        { channel: "roip", bearer: "intra-ship", status: "UP", latencyMs: 6 },
        { channel: "hf", bearer: "HF-ALE", status: "UP", latencyMs: 900 },
        { channel: "vuhf", bearer: "Link-line", status: "UP", latencyMs: 35 },
        { channel: "satcom", bearer: "Ka", status: "UP", latencyMs: 620 },
      ],
      payloads: OPV_PAYLOADS,
    },
  ];
}

export function commsDegraded(): Platform[] {
  return platforms().filter((p) => p.comms.some((c) => c.status !== "UP"));
}

export const HULL_LABEL: Record<string, string> = {
  mmpv_90_corvette: "MMPV 90 Corvette",
  hisar_opv: "Hisar-class OPV",
  other: "Vessel",
};
