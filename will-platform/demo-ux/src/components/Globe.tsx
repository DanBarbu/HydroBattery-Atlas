import { useEffect, useMemo, useRef, useState } from "react";
import {
  Cartesian3,
  Color,
  DistanceDisplayCondition,
  HorizontalOrigin,
  LabelStyle,
  Math as CesiumMath,
  NearFarScalar,
  TileMapServiceImageryProvider,
  Viewer,
  VerticalOrigin,
  buildModuleUrl,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { useI18n } from "../i18n";
import { tracksAt, CINCU } from "../mock/tracks";
import { tenantStore } from "../mock/tenants";
import { LayerToggles, type LayerState } from "./LayerToggles";
import type { Affiliation, Track, TrackKind } from "../types";

const FALLBACK_AFFILIATION: Record<Affiliation, string> = {
  F: "#3273dc",
  H: "#e63946",
  N: "#3ddc97",
  U: "#f4d35e",
};

function affiliationColour(a: Affiliation): Color {
  const override = tenantStore.active().theme.affiliationColors?.[a];
  return Color.fromCssColorString(override ?? FALLBACK_AFFILIATION[a]);
}

function trackLabel(tr: Track): string {
  if (tr.kind === "gmti" && tr.radialVelocityMps !== undefined) {
    const arrow = tr.radialVelocityMps >= 0 ? "→" : "←";
    return `${tr.source} ${arrow} ${Math.abs(tr.radialVelocityMps).toFixed(1)} m/s`;
  }
  if (tr.callsign) return `${tr.source} (${tr.callsign})`;
  return tr.source;
}

const DEFAULT_LAYERS: LayerState = { point: false, cot: true, mavlink: true, gmti: true };

export function Globe() {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const entityBySource = useRef<Map<string, ReturnType<Viewer["entities"]["add"]>>>(new Map());
  const [ready, setReady] = useState(false);
  const [layers, setLayers] = useState<LayerState>(DEFAULT_LAYERS);
  const [count, setCount] = useState(0);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;
    let cancelled = false;
    (async () => {
      // Offline imagery bundled with the cesium package — no Ion token needed.
      let imageryProvider: TileMapServiceImageryProvider | undefined;
      try {
        imageryProvider = await TileMapServiceImageryProvider.fromUrl(
          buildModuleUrl("Assets/Textures/NaturalEarthII"),
        );
      } catch {
        imageryProvider = undefined;
      }
      if (cancelled || !containerRef.current) return;
      const viewer = new Viewer(containerRef.current, {
        timeline: false,
        animation: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        ...(imageryProvider ? { baseLayer: undefined, imageryProvider } : {}),
      } as never);
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(CINCU.lon, CINCU.lat, 120_000),
        orientation: { heading: 0, pitch: CesiumMath.toRadians(-60), roll: 0 },
        duration: 0,
      });
      viewerRef.current = viewer;
      const remove = viewer.scene.postRender.addEventListener(() => {
        setReady(true);
        remove();
      });
    })();
    return () => {
      cancelled = true;
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, []);

  // Mock feed: update entities every second.
  useEffect(() => {
    if (!ready) return;
    const tick = () => {
      const viewer = viewerRef.current;
      if (!viewer) return;
      const elapsed = (Date.now() - startRef.current) / 1000;
      const tracks = tracksAt(elapsed);
      let visible = 0;
      for (const tr of tracks) {
        const shown = layers[tr.kind as TrackKind];
        if (shown) visible++;
        const position = Cartesian3.fromDegrees(tr.lon, tr.lat, tr.altitudeM);
        const colour = affiliationColour(tr.affiliation);
        const isGmti = tr.kind === "gmti";
        const existing = entityBySource.current.get(tr.source);
        if (existing) {
          existing.position = position as never;
          if (existing.point) existing.point.color = colour as never;
          existing.show = shown as never;
          if (existing.label) existing.label.text = trackLabel(tr) as never;
        } else {
          const entity = viewer.entities.add({
            position,
            show: shown,
            point: {
              pixelSize: isGmti ? 10 : tr.kind === "point" ? 7 : 14,
              color: colour,
              outlineColor: isGmti ? Color.BLACK : Color.WHITE,
              outlineWidth: isGmti ? 3 : 2,
            },
            label: {
              text: trackLabel(tr),
              font: "11px sans-serif",
              fillColor: Color.WHITE,
              outlineColor: Color.BLACK,
              outlineWidth: 2,
              style: LabelStyle.FILL_AND_OUTLINE,
              horizontalOrigin: HorizontalOrigin.LEFT,
              verticalOrigin: VerticalOrigin.CENTER,
              pixelOffset: new Cartesian3(12, 0, 0),
              distanceDisplayCondition: new DistanceDisplayCondition(0, 250_000),
              scaleByDistance: new NearFarScalar(2_000, 1.0, 60_000, 0.55),
            },
          });
          entityBySource.current.set(tr.source, entity);
        }
      }
      setCount(visible);
    };
    tick();
    const id = window.setInterval(tick, 1_000);
    return () => window.clearInterval(id);
  }, [ready, layers]);

  const recentre = () => {
    viewerRef.current?.camera.flyTo({
      destination: Cartesian3.fromDegrees(CINCU.lon, CINCU.lat, 120_000),
      orientation: { heading: 0, pitch: CesiumMath.toRadians(-60), roll: 0 },
      duration: 1.2,
    });
  };

  const status = useMemo(() => t("globe.connection.connected"), [t]);

  return (
    <div className="globe-shell">
      <div className="globe-meta">
        <span>{t("globe.heading")}</span>
        <span aria-live="polite">{status}</span>
        <span>{t("globe.tracks.count", { count })}</span>
        <button type="button" className="link-button" onClick={recentre}>
          {t("globe.reset")}
        </button>
      </div>
      <LayerToggles value={layers} onChange={setLayers} />
      <div ref={containerRef} className="globe-canvas" />
    </div>
  );
}
