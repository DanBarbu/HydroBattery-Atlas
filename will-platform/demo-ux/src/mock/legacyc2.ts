// In-page mock of will-platform/services/legacy-c2. ADR-014 — BC2A/ICIS
// treated as a sensor source (northbound), with an advisory southbound
// 2525D + AdatP-3 feed for backwards compatibility. WILL never writes
// BC2A's DB; no proprietary BC2A content — public NATO standards only.

export interface LegacyTrack {
  externalId: string;
  sourceFormat: "jc3iedm" | "adatp3";
  callsign: string;
  hostility: string; // FR HO NE UK SU AF
  dimension: string; // LAND AIR SEA_SURFACE SUBSURFACE SPACE
  lat: number;
  lon: number;
  app6Sidc: string;
  classification: string;
  observedAt: string;
}

export interface IngestEntry {
  at: string;
  format: "jc3iedm" | "adatp3";
  raw: string;
  externalId: string;
}

export interface Southbound {
  trackExternalId: string;
  app6Sidc: string;
  adatp3: string;
  renderedAt: string;
}

const C_LAT = 45.8696;
const C_LON = 24.7753;
const EARTH_R = 6_378_137.0;
const start = Date.now();

function offset(lat: number, lon: number, n: number, e: number): [number, number] {
  const dlat = (n / EARTH_R) * (180 / Math.PI);
  const dlon = (e / (EARTH_R * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
  return [lat + dlat, lon + dlon];
}

function sidc(host: string, dim: string): string {
  const a = ({ FR: "F", HO: "H", NE: "N", SU: "S", AF: "A" } as Record<string, string>)[host] ?? "U";
  const d = ({ AIR: "A", SEA_SURFACE: "S", SUBSURFACE: "U", SPACE: "P" } as Record<string, string>)[dim] ?? "G";
  return `S${a}${d}P-----------`;
}

const CLASS_MAP: Record<string, string> = {
  NU: "NESECRET", RS: "SECRET_DE_SERVICIU", CO: "SECRET", SE: "STRICT_SECRET",
};

function isoNow(): string {
  return new Date().toISOString();
}

let ingestLog: IngestEntry[] = [];

function pushIngest(e: IngestEntry) {
  ingestLog = [e, ...ingestLog].slice(0, 12);
}

export function tracks(): LegacyTrack[] {
  const e = (Date.now() - start) / 1000;
  const [flat, flon] = offset(C_LAT, C_LON, 1500 * Math.sin(e / 60), 1500 * Math.cos(e / 60));
  const [ulat, ulon] = offset(C_LAT, C_LON, 4000, 6000 - ((e * 25) % 12000));
  const [rlat, rlon] = offset(C_LAT, C_LON, -1200, 1200 * Math.cos(e / 45));
  return [
    {
      externalId: "OI-LF-21", sourceFormat: "jc3iedm", callsign: "Cp 2 Vânători",
      hostility: "FR", dimension: "LAND", lat: flat, lon: flon,
      app6Sidc: sidc("FR", "LAND"), classification: CLASS_MAP.RS, observedAt: isoNow(),
    },
    {
      externalId: "OI-UNK-77", sourceFormat: "jc3iedm", callsign: "Unknown vehicle",
      hostility: "UK", dimension: "LAND", lat: ulat, lon: ulon,
      app6Sidc: sidc("UK", "LAND"), classification: CLASS_MAP.NU, observedAt: isoNow(),
    },
    {
      externalId: "TN-RECCE-3", sourceFormat: "adatp3", callsign: "CERCETAS-3",
      hostility: "FR", dimension: "LAND", lat: rlat, lon: rlon,
      app6Sidc: sidc("FR", "LAND"), classification: CLASS_MAP.NU, observedAt: isoNow(),
    },
  ];
}

export function ingest(): IngestEntry[] {
  const t = tracks();
  // Simulate the latest replication blocks.
  pushIngest({
    at: isoNow(), format: "jc3iedm", externalId: "OI-LF-21",
    raw: `{"object_item_id":"OI-LF-21","hostility":"FR","dimension":"LAND","classification":"RS",...}`,
  });
  pushIngest({
    at: isoNow(), format: "adatp3", externalId: "TN-RECCE-3",
    raw: `MSGID/TRACKREP/WILL// TRACKNO/TN-RECCE-3// IDENT/FR/LAND// CLASS/NU//`,
  });
  void t;
  return ingestLog;
}

export function southbound(): Southbound[] {
  const t = tracks().find((x) => x.externalId === "OI-UNK-77")!;
  const adatp3 =
    `MSGID/TRACKREP/WILL//\nTRACKNO/OI-UNK-77//\nAMPN/Unknown vehicle//\n` +
    `POSIT/${t.lat.toFixed(6)}/${t.lon.toFixed(6)}/470.0//\nIDENT/UK/LAND//\nCLASS/NU//\n` +
    `TIMEPOS/${isoNow()}//`;
  return [
    { trackExternalId: "OI-UNK-77", app6Sidc: sidc("UK", "LAND"), adatp3, renderedAt: isoNow() },
  ];
}
