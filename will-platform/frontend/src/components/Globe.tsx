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

  // Pull the active tenant's theme on mount; refresh every 60 s so admin edits
  // surface without a page reload.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${TENANT_API}/${DEFAULT_TENANT_ID}`);
        if (!res.ok) return;
        const data = (await res.json()) as { theme?: ThemeOverride };
        if (!cancelled && data.theme) setTheme(data.theme);
      } catch {
        // Theme overrides are optional; fall back to defaults silently.
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

  // Sprint 1 retro action #2: collision-aware labels.
  // Strategy: hide labels when camera is far (eye altitude > 30 km), and
  // shrink labels with distance. Beyond 250 km no labels are drawn. This
  // makes a dense COP readable without per-entity collision detection.
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
      const [lon, lat] = track.geometry.coordinates;
      const position = Cartesian3.fromDegrees(lon, lat, track.altitude_m ?? 0);
      const colour = affiliationColour(track.app6d_sidc, theme);
      const existing = entityBySource.current.get(source);
      if (existing) {
        existing.position = position as never;
        if (existing.point) existing.point.color = colour as never;
      } else {
        const entity = viewer.entities.add({
          position,
          point: {
            pixelSize: 14,
            color: colour,
            outlineColor: Color.WHITE,
            outlineWidth: 2,
          },
          label: {
            text: source,
            font: "12px sans-serif",
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
  }, [tracks, theme, labelDistanceCondition, labelScaleByDistance]);

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
      <div ref={containerRef} className="globe-canvas" />
    </div>
  );
}
