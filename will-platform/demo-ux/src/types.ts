export type TrackKind = "point" | "cot" | "mavlink" | "gmti";

export type Affiliation = "F" | "H" | "N" | "U";

export interface Track {
  trackId: string;
  source: string;
  kind: TrackKind;
  lon: number;
  lat: number;
  altitudeM: number;
  affiliation: Affiliation;
  classification: string;
  /** GMTI only */
  radialVelocityMps?: number;
  /** GMTI only */
  snrDb?: number;
  callsign?: string;
  observedAt: string;
}

export interface PluginEntry {
  id: string;
  name: string;
  version: string;
  vendor: string;
  contractVersion: string;
  capabilities: string[];
  description: string;
  status: "SERVING" | "DEGRADED" | "NOT_SERVING" | "UNKNOWN";
  latencyMs: number;
}

export interface Tenant {
  id: string;
  slug: string;
  displayName: string;
  theme: {
    primaryColor?: string;
    bannerLabel?: string;
    affiliationColors?: Partial<Record<Affiliation, string>>;
    logoUrl?: string;
  };
  terminology: Record<string, string>;
  features: Record<string, boolean>;
}

export interface Sensor {
  id: string;
  externalId: string;
  family: "lora" | "gmti" | "cot" | "mavlink" | "other";
  displayName: string;
  classification: string;
  enabled: boolean;
}

export type Role = "viewer" | "operator" | "admin" | "auditor" | "cross_tenant_auditor";

export interface Membership {
  userId: string;
  role: Role;
}
