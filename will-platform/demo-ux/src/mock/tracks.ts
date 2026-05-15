import type { Track, Affiliation } from "../types";

// All mock motion is centred on the Cincu Joint National Training Centre.
const CENTER_LAT = 45.8696;
const CENTER_LON = 24.7753;
const EARTH_R = 6_378_137.0;

function offset(lat: number, lon: number, northM: number, eastM: number): [number, number] {
  const dlat = (northM / EARTH_R) * (180 / Math.PI);
  const dlon = (eastM / (EARTH_R * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
  return [lon + dlon, lat + dlat];
}

// Deterministic LoRa scatter so the same nodes appear every run.
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const loraNodes = (() => {
  const rng = lcg(4607);
  const out: { id: string; lon: number; lat: number }[] = [];
  for (let i = 0; i < 100; i++) {
    const angle = rng() * Math.PI * 2;
    const radiusKm = 0.2 + rng() * 8;
    const [lon, lat] = offset(CENTER_LAT, CENTER_LON, Math.sin(angle) * radiusKm * 1000, Math.cos(angle) * radiusKm * 1000);
    out.push({ id: `sim-node-${i.toString().padStart(3, "0")}`, lon, lat });
  }
  return out;
})();

function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Produce the full track set for a given elapsed-seconds value. Pure function:
 * the UI calls it on a timer so the same elapsed value always yields the same
 * picture (handy for screenshots / regression).
 */
export function tracksAt(elapsedS: number): Track[] {
  const out: Track[] = [];

  // CoT friendly — slow circle, 1.2 km radius.
  {
    const theta = (elapsedS / 45) * Math.PI * 2;
    const [lon, lat] = offset(CENTER_LAT, CENTER_LON, Math.sin(theta) * 1200, Math.cos(theta) * 1200);
    out.push({
      trackId: "cot-tablet-7",
      source: "atak-mil/tablet-7",
      kind: "cot",
      lon,
      lat,
      altitudeM: 500,
      affiliation: "F",
      classification: "NESECRET",
      callsign: "ALFA-1",
      observedAt: nowISO(),
    });
  }

  // CoT hostile — east-to-west transit at 5 km north.
  {
    const eastM = 6000 - ((elapsedS * 35) % 12000);
    const [lon, lat] = offset(CENTER_LAT, CENTER_LON, 5000, eastM);
    out.push({
      trackId: "cot-track-99",
      source: "atak-mil/track-99",
      kind: "cot",
      lon,
      lat,
      altitudeM: 3000,
      affiliation: "H",
      classification: "NESECRET",
      callsign: "BANDIT-99",
      observedAt: nowISO(),
    });
  }

  // MAVLink UAV — circle at 500 m, 1.5 km radius.
  {
    const theta = (elapsedS / 60) * Math.PI * 2;
    const [lon, lat] = offset(CENTER_LAT, CENTER_LON, Math.sin(theta) * 1500, Math.cos(theta) * 1500);
    out.push({
      trackId: "mavlink-sys1",
      source: "mavlink/sys1",
      kind: "mavlink",
      lon,
      lat,
      altitudeM: 500,
      affiliation: "F",
      classification: "NESECRET",
      callsign: "UAV-1",
      observedAt: nowISO(),
    });
  }

  // GMTI — three ground vehicles with radial velocities.
  const gmtiAff: Affiliation = "U";
  {
    const [lon1, lat1] = offset(CENTER_LAT, CENTER_LON, Math.sin(elapsedS / 30) * 1500, Math.cos(elapsedS / 30) * 1500);
    out.push({
      trackId: "gmti-mti-1",
      source: "gmti/RAT-31DL/job7/mti1",
      kind: "gmti",
      lon: lon1,
      lat: lat1,
      altitudeM: 480,
      affiliation: gmtiAff,
      classification: "NESECRET",
      radialVelocityMps: 9 * Math.sin(elapsedS / 12),
      snrDb: 18,
      observedAt: nowISO(),
    });
    const [lon2, lat2] = offset(CENTER_LAT, CENTER_LON, 2500 - elapsedS * 4, -2000 + elapsedS * 3);
    out.push({
      trackId: "gmti-mti-2",
      source: "gmti/RAT-31DL/job7/mti2",
      kind: "gmti",
      lon: lon2,
      lat: lat2,
      altitudeM: 470,
      affiliation: gmtiAff,
      classification: "NESECRET",
      radialVelocityMps: 6.5,
      snrDb: 14,
      observedAt: nowISO(),
    });
    const [lon3, lat3] = offset(CENTER_LAT, CENTER_LON, -800, 3000 - elapsedS * 5);
    out.push({
      trackId: "gmti-mti-3",
      source: "gmti/RAT-31DL/job7/mti3",
      kind: "gmti",
      lon: lon3,
      lat: lat3,
      altitudeM: 510,
      affiliation: gmtiAff,
      classification: "NESECRET",
      radialVelocityMps: -4,
      snrDb: 11,
      observedAt: nowISO(),
    });
  }

  // LoRa — 100 static points.
  for (const n of loraNodes) {
    out.push({
      trackId: `lora-${n.id}`,
      source: `lora/${n.id}`,
      kind: "point",
      lon: n.lon,
      lat: n.lat,
      altitudeM: 480,
      affiliation: "U",
      classification: "NESECRET",
      observedAt: nowISO(),
    });
  }

  return out;
}

export const CINCU = { lon: CENTER_LON, lat: CENTER_LAT };
