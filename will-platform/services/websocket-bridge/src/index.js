// WILL WebSocket Bridge — Sprint 0 (S0-05).
// Subscribes to MQTT telemetry topics, dedups by (source, observed_at),
// and pushes JSON track records to all connected WebSocket clients.

import http from "node:http";
import mqtt from "mqtt";
import { WebSocketServer } from "ws";

const MQTT_URL = process.env.MQTT_URL ?? "mqtt://emqx:1883";
// Sprint 1: widen subscription beyond GPS-only to catch any plugin's telemetry
// (telemetry/<source>/<id>). The dedup key ensures sources do not duplicate
// each other on the wire.
const MQTT_TOPIC = process.env.MQTT_TOPIC ?? "telemetry/#";
const WS_PORT = Number.parseInt(process.env.WS_PORT ?? "7000", 10);

const dedupWindow = new Map(); // key: `${source}|${observed_at}` -> timestamp
const DEDUP_TTL_MS = 5_000;

setInterval(() => {
  const cutoff = Date.now() - DEDUP_TTL_MS;
  for (const [key, ts] of dedupWindow) {
    if (ts < cutoff) dedupWindow.delete(key);
  }
}, 1_000).unref();

const httpServer = http.createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok", component: "websocket-bridge" }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: httpServer, path: "/tracks" });

wss.on("connection", (ws) => {
  console.log("[ws-bridge] client connected; total =", wss.clients.size);
  ws.on("close", () => {
    console.log("[ws-bridge] client disconnected; total =", wss.clients.size);
  });
});

const client = mqtt.connect(MQTT_URL, {
  reconnectPeriod: 2_000,
  connectTimeout: 10_000,
});

client.on("connect", () => {
  console.log(`[ws-bridge] mqtt connected; subscribing ${MQTT_TOPIC}`);
  client.subscribe(MQTT_TOPIC, { qos: 0 }, (err) => {
    if (err) console.error("[ws-bridge] subscribe error:", err);
  });
});

client.on("error", (err) => console.error("[ws-bridge] mqtt error:", err));

client.on("message", (_topic, payload) => {
  let msg;
  try {
    msg = JSON.parse(payload.toString("utf8"));
  } catch (err) {
    console.warn("[ws-bridge] dropping non-JSON payload:", err.message);
    return;
  }

  const key = `${msg.source ?? "?"}|${msg.observed_at ?? ""}`;
  if (dedupWindow.has(key)) return;
  dedupWindow.set(key, Date.now());

  const data = JSON.stringify(msg);
  for (const ws of wss.clients) {
    if (ws.readyState === ws.OPEN) ws.send(data);
  }
});

httpServer.listen(WS_PORT, () => {
  console.log(`[ws-bridge] listening on :${WS_PORT}`);
});
