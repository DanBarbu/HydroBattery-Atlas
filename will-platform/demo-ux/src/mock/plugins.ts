import type { PluginEntry } from "../types";

// Mirrors what the real plugin-loader /v1/plugins endpoint returns after a
// full `docker compose up`. Latencies jitter slightly each poll to feel live.
const base: PluginEntry[] = [
  {
    id: "atak-mil",
    name: "atak-mil",
    version: "0.1.0",
    vendor: "WILL Romania",
    contractVersion: "v1.0",
    capabilities: ["sensor.track"],
    description: "ATAK-MIL Cursor on Target adapter (Sprint 1).",
    status: "SERVING",
    latencyMs: 7,
  },
  {
    id: "mavlink",
    name: "mavlink",
    version: "0.1.0",
    vendor: "WILL Romania",
    contractVersion: "v1.0",
    capabilities: ["sensor.track"],
    description: "MAVLink UAV plugin (Sprint 2).",
    status: "SERVING",
    latencyMs: 9,
  },
  {
    id: "gmti",
    name: "gmti",
    version: "0.1.0",
    vendor: "WILL Romania",
    contractVersion: "v1.0",
    capabilities: ["sensor.track"],
    description: "STANAG 4607 GMTI adapter — WILL minimal profile (Sprint 3).",
    status: "SERVING",
    latencyMs: 12,
  },
  {
    id: "lora-bridge",
    name: "lora-bridge",
    version: "0.1.0",
    vendor: "WILL Romania",
    contractVersion: "v1.0",
    capabilities: ["sensor.track"],
    description: "LoRaWAN MQTT bridge — ChirpStack v3/v4 + WILL-native (Sprint 4).",
    status: "SERVING",
    latencyMs: 15,
  },
  {
    id: "sim-gps-puck",
    name: "sim-gps-puck",
    version: "0.1.0",
    vendor: "WILL Romania",
    contractVersion: "v1.0",
    capabilities: ["sensor.track"],
    description: "Simulated GPS puck (Sprint 0).",
    status: "SERVING",
    latencyMs: 4,
  },
  {
    id: "reference-echo",
    name: "reference-echo",
    version: "0.1.0",
    vendor: "WILL Romania",
    contractVersion: "v1.0",
    capabilities: ["sensor.track"],
    description: "Reference plugin for SDK authors (Sprint 1).",
    status: "DEGRADED",
    latencyMs: 41,
  },
];

export function pluginsNow(): PluginEntry[] {
  return base.map((p) => ({
    ...p,
    latencyMs: Math.max(1, p.latencyMs + Math.round((Math.random() - 0.5) * 4)),
  }));
}
