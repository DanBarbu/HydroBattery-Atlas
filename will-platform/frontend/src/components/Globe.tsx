import { useEffect, useMemo, useRef, useState } from "react";
import {
  Cartesian3,
  Color,
  HorizontalOrigin,
  LabelStyle,
  Math as CesiumMath,
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
  observed_at: string;
}

const WS_URL =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_WS_URL ?? "ws://localhost:7000/tracks";

export function Globe() {
  const { t } = useI18n();
  const viewerRef = useRef<Viewer | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const entityBySource = useRef<Map<string, ReturnType<Viewer["entities"]["add"]>>>(
    new Map(),
  );
  const [connected, setConnected] = useState(false);
  const [tracks, setTracks] = useState<Map<string, Track>>(new Map());

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
    return () => {
      viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    for (const [source, track] of tracks) {
      const [lon, lat] = track.geometry.coordinates;
      const position = Cartesian3.fromDegrees(lon, lat, track.altitude_m ?? 0);
      const existing = entityBySource.current.get(source);
      if (existing) {
        existing.position = position as never;
      } else {
        const entity = viewer.entities.add({
          position,
          billboard: undefined,
          point: {
            pixelSize: 14,
            color: Color.fromCssColorString("#3273dc"),
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
          },
        });
        entityBySource.current.set(source, entity);
      }
    }
  }, [tracks]);

  const trackCount = tracks.size;
  const status = useMemo(
    () =>
      connected
        ? t("globe.connection.connected")
        : t("globe.connection.disconnected"),
    [connected, t],
  );

  return (
    <div className="globe-shell">
      <div className="globe-banner">{t("globe.classification.banner")}</div>
      <div className="globe-meta">
        <span>{t("globe.heading")}</span>
        <span aria-live="polite">{status}</span>
        <span>{t("globe.tracks.count", { count: trackCount })}</span>
      </div>
      <div ref={containerRef} className="globe-canvas" />
    </div>
  );
}
