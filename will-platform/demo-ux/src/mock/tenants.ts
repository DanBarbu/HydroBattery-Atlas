import type { Tenant, Sensor, Membership } from "../types";

// In-memory tenant store. Mutations from the Admin UI persist for the life of
// the page (no backend). Reload resets to these seeds.

let tenants: Tenant[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    slug: "default",
    displayName: "WILL Romania (default)",
    theme: { primaryColor: "#3273dc", bannerLabel: "NESECRET" },
    terminology: {},
    features: { ai_prediction: false, link22: false },
  },
  {
    id: "11111111-1111-1111-1111-111111111111",
    slug: "br2vm-demo",
    displayName: "Brigada 2 Vânători de Munte (Demo)",
    theme: {
      primaryColor: "#0b6e4f",
      bannerLabel: "BR2VM — INSTRUIRE",
      affiliationColors: { F: "#3273dc", H: "#e63946", N: "#3ddc97", U: "#f4d35e" },
    },
    terminology: { plugin: "modul", sensor: "activ", track: "contact" },
    features: { ai_prediction: false, link22: false, lora: true, gmti: true },
  },
];

let sensors: Record<string, Sensor[]> = {
  "11111111-1111-1111-1111-111111111111": [
    { id: "s-1", externalId: "RAT-31DL/job7", family: "gmti", displayName: "Radar antenă lungă Cincu", classification: "NESECRET", enabled: true },
    { id: "s-2", externalId: "atak-mil/tablet-7", family: "cot", displayName: "ATAK ALFA-1", classification: "NESECRET", enabled: true },
    { id: "s-3", externalId: "mavlink/sys1", family: "mavlink", displayName: "UAV instruire 1", classification: "NESECRET", enabled: true },
    { id: "s-4", externalId: "lora/cluster-A", family: "lora", displayName: "Cluster IoT Cincu (100 noduri)", classification: "NESECRET", enabled: true },
  ],
};

let members: Record<string, Membership[]> = {
  "00000000-0000-0000-0000-000000000001": [
    { userId: "00000000-0000-0000-0000-0000000000a1", role: "admin" },
    { userId: "00000000-0000-0000-0000-0000000000a2", role: "operator" },
    { userId: "00000000-0000-0000-0000-0000000000a3", role: "auditor" },
  ],
  "11111111-1111-1111-1111-111111111111": [
    { userId: "00000000-0000-0000-0000-0000000000a1", role: "admin" },
    { userId: "00000000-0000-0000-0000-0000000000a2", role: "operator" },
  ],
};

let activeTenantId = "11111111-1111-1111-1111-111111111111";

export const tenantStore = {
  list(): Tenant[] {
    return tenants;
  },
  get(id: string): Tenant | undefined {
    return tenants.find((t) => t.id === id);
  },
  active(): Tenant {
    return tenants.find((t) => t.id === activeTenantId) ?? tenants[0];
  },
  setActive(id: string): void {
    activeTenantId = id;
  },
  updateTheme(id: string, theme: Tenant["theme"]): Tenant {
    tenants = tenants.map((t) => (t.id === id ? { ...t, theme } : t));
    return this.get(id)!;
  },
  updateTerminology(id: string, terminology: Record<string, string>): Tenant {
    tenants = tenants.map((t) => (t.id === id ? { ...t, terminology } : t));
    return this.get(id)!;
  },
  sensors(id: string): Sensor[] {
    return sensors[id] ?? [];
  },
  bulkRegisterSensors(id: string, items: Omit<Sensor, "id" | "enabled">[]): Sensor[] {
    const existing = sensors[id] ?? [];
    const created: Sensor[] = items
      .filter((it) => !existing.some((e) => e.externalId === it.externalId))
      .map((it, i) => ({ ...it, id: `s-${Date.now()}-${i}`, enabled: true }));
    sensors = { ...sensors, [id]: [...existing, ...created] };
    return created;
  },
  members(id: string): Membership[] {
    return members[id] ?? [];
  },
  grant(id: string, m: Membership): void {
    const existing = members[id] ?? [];
    if (!existing.some((e) => e.userId === m.userId && e.role === m.role)) {
      members = { ...members, [id]: [...existing, m] };
    }
  },
  revoke(id: string, m: Membership): void {
    members = { ...members, [id]: (members[id] ?? []).filter((e) => !(e.userId === m.userId && e.role === m.role)) };
  },
};
