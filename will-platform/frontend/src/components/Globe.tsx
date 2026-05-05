import { useEffect, useMemo, useRef, useState } from "react";
import {
  Cartesian3,
  Color,
  DistanceDisplayCondition,
  HorizontalOrigin,
  LabelStyle,
  Math as CesiumMath,
  NearFarScalar,
  Viewer,
  VerticalOrigin,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { useI18n } from "../i18n";

interface Track {
  track_id: string;
  source: string;
  geometry: { type: "Point"; coordinates: [number, number] };
  altitude_m?: number;
  classification?: string;
  app6d_sidc?: string;
  observed_at: string;
  track_kind?: string;
  velocity_radial_mps?: number;
  snr_db?: number;
}

interface ThemeOverride {
  primaryColor?: string;
  bannerLabel?: string;
  affiliationColors?: { F?: string; H?: string; N?: string; U?: string };
}

const WS_URL =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_WS_URL ?? "ws://localhost:7000/tracks";
const TENANT_API =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_TENANT_API ?? "http://localhost:8081/v1/tenants";
const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";

const FALLBACK_AFFILIATION: Record<string, string> = {
  F: "#3273dc",
  H: "#e63946",
  N: "#3ddc97",
  U: "#f4d35e",
};

function affiliationColour(sidc: string | undefined, theme: ThemeOverride): Color {
  if (!sidc || sidc.length < 2) return Color.fromCssColorString("#888888");
  const aff = sidc[1];
  const themeMap = theme.affiliationColors ?? {};
  const css =
    (themeMap as Record<string, string>)[aff] ??
    FALLBACK_AFFILIATION[aff] ??
    "#888888";
  return Color.fromCssColorString(css);
}

interface LayerToggles {
  point: boolean;
  cot: boolean;
  mavlink: boolean;
  gmti: boolean;
}

const DEFAULT_LAYERS: LayerToggles = { point: true, cot: true, mavlink: true, gmti: true };

function trackKind(t: Track): keyof LayerToggles {
  const k = (t.track_kind ?? "").toLowerCase();
  if (k === "gmti" || k === "cot" || k === "mavlink") return k;
  if (t.source.startsWith("gmti/")) return "gmti";
  if (t.source.startsWith("atak-mil/")) return "cot";
  if (t.source.startsWith("mavlink/")) return "mavlink";
  return "point";
}

export function Globe() {
  const { t } = useI18n();
  const viewerRef = useRef<Viewer | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const entityBySource = useRef<Map<string, ReturnType<Viewer["entities"]["add"]>>>(
    new Map(),
  );
  const [viewerReady, setViewerReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [tracks, setTracks] = useState<Map<string, Track>>(new Map());
  const [theme, setTheme] = useState<ThemeOverride>({});
  const [layers, setLayers] = useState<LayerToggles>(DEFAULT_LAYERS);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${TENANT_API}/${DEFAULT_TENANT_ID}`);
        if (!res.ok) return;
        const data = (await res.json()) as { theme?: ThemeOverride };
        if (!cancelled && data.theme) setTheme(data.theme);
      } catch {
        // silent fallback
      }
    };
    load();
    const id = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;
    const viewer = new Viewer(containerRef.current, {
      timeline: false,
      animation: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
    });
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(24.7753, 45.8696, 200_000),
      orientation: { heading: 0, pitch: CesiumMath.toRadians(-60), roll: 0 },
      duration: 0,
    });
    viewerRef.current = viewer;

    const removePostRender = viewer.scene.postRender.addEventListener(() => {
      setViewerReady(true);
      removePostRender();
    });

    return () => {
      viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!viewerReady) return;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        reconnectTimer = setTimeout(connect, 2_000);
      };
      ws.onerror = () => ws?.close();
      ws.onmessage = (event) => {
        try {
          const track: Track = JSON.parse(event.data);
          setTracks((prev) => {
            const next = new Map(prev);
            next.set(track.source, track);
            return next;
          });
        } catch (err) {
          console.warn("[ws] parse error", err);
        }
      };
    };

    connect();
    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [viewerReady]);

  const labelDistanceCondition = useMemo(
    () => new DistanceDisplayCondition(0, 250_000),
    [],
  );
  const labelScaleByDistance = useMemo(
    () => new NearFarScalar(2_000, 1.0, 50_000, 0.6),
    [],
  );

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    for (const [source, track] of tracks) {
      const kind = trackKind(track);
      const visible = layers[kind];
      const [lon, lat] = track.geometry.coordinates;
      const position = Cartesian3.fromDegrees(lon, lat, track.altitude_m ?? 0);
      const colour = affiliationColour(track.app6d_sidc, theme);
      const isGmti = kind === "gmti";
      const existing = entityBySource.current.get(source);
      if (existing) {
        existing.position = position as never;
        if (existing.point) existing.point.color = colour as never;
        existing.show = visible as never;
      } else {
        const entity = viewer.entities.add({
          position,
          show: visible,
          point: {
            pixelSize: isGmti ? 10 : 14,
            color: colour,
            outlineColor: isGmti ? Color.BLACK : Color.WHITE,
            outlineWidth: isGmti ? 3 : 2,
          },
          label: {
            text: gmtiLabel(track) ?? source,
            font: isGmti ? "11px sans-serif" : "12px sans-serif",
            fillColor: Color.WHITE,
            outlineColor: Color.BLACK,
            outlineWidth: 2,
            style: LabelStyle.FILL_AND_OUTLINE,
            horizontalOrigin: HorizontalOrigin.LEFT,
            verticalOrigin: VerticalOrigin.CENTER,
            pixelOffset: new Cartesian3(12, 0, 0),
            distanceDisplayCondition: labelDistanceCondition,
            scaleByDistance: labelScaleByDistance,
          },
        });
        entityBySource.current.set(source, entity);
      }
    }
  }, [tracks, theme, layers, labelDistanceCondition, labelScaleByDistance]);

  const trackCount = tracks.size;
  const status = useMemo(
    () =>
      connected
        ? t("globe.connection.connected")
        : t("globe.connection.disconnected"),
    [connected, t],
  );
  const banner = theme.bannerLabel || t("globe.classification.banner");

  return (
    <div className="globe-shell">
      <div className="globe-banner" style={{ background: theme.primaryColor }}>
        {banner}
      </div>
      <div className="globe-meta">
        <span>{t("globe.heading")}</span>
        <span aria-live="polite">{status}</span>
        <span>{t("globe.tracks.count", { count: trackCount })}</span>
      </div>
      <div className="layer-toggles" role="group" aria-label={t("layers.label")}>
        {(["point", "cot", "mavlink", "gmti"] as const).map((k) => (
          <label key={k} className={`layer-toggle layer-${k}`}>
            <input
              type="checkbox"
              checked={layers[k]}
              onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })}
            />
            <span>{t(`layers.${k}`)}</span>
          </label>
        ))}
      </div>
      <div ref={containerRef} className="globe-canvas" />
    </div>
  );
}

function gmtiLabel(t: Track): string | null {
  if (trackKind(t) !== "gmti") return null;
  const v = t.velocity_radial_mps;
  if (v === undefined) return t.source;
  const arrow = v >= 0 ? "→" : "←";
  return `${t.source} ${arrow} ${Math.abs(v).toFixed(1)} m/s`;
}
