import { useEffect, useMemo, useRef, useState } from "react";
import {
  Cartesian3,
  Color,
  DistanceDisplayCondition,
  HorizontalOrigin,
  LabelStyle,
  Math as CesiumMath,
  NearFarScalar,
  PolygonHierarchy,
  TileMapServiceImageryProvider,
  Viewer,
  VerticalOrigin,
  buildModuleUrl,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { useI18n } from "../i18n";
import { tracksAt, CINCU } from "../mock/tracks";
import { tenantStore } from "../mock/tenants";
import { bms } from "../mock/bms";
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

// Sentinel show-flags for BMS overlay groups so we can toggle without touching the per-entity layer.
const overlayFlag = {
  dal: "__will_dal__",
  zones: "__will_zones__",
  prediction: "__will_pred__",
};

export function Globe() {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const entityBySource = useRef<Map<string, ReturnType<Viewer["entities"]["add"]>>>(new Map());
  const overlayEntities = useRef<Map<string, ReturnType<Viewer["entities"]["add"]>>>(new Map());
  const [ready, setReady] = useState(false);
  const [layers, setLayers] = useState<LayerState>(DEFAULT_LAYERS);
  const [showDAL, setShowDAL] = useState(true);
  const [showZones, setShowZones] = useState(true);
  const [showPrediction, setShowPrediction] = useState(true);
  const [count, setCount] = useState(0);
  const startRef = useRef<number>(Date.now());

  // Cesium viewer lifecycle.
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;
    let cancelled = false;
    (async () => {
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

  // BMS overlays (DAL pins + EZ polygons). Created once; toggled via `show`.
  useEffect(() => {
    if (!ready) return;
    const viewer = viewerRef.current;
    if (!viewer) return;

    // DAL pins.
    for (const a of bms.defendedAssets()) {
      const key = `${overlayFlag.dal}/${a.id}`;
      if (overlayEntities.current.has(key)) continue;
      const entity = viewer.entities.add({
        position: Cartesian3.fromDegrees(a.lon, a.lat, 0),
        show: showDAL,
        point: { pixelSize: 18, color: Color.fromCssColorString("#ff8a3d"), outlineColor: Color.WHITE, outlineWidth: 3 },
        label: {
          text: `★ ${a.name}`,
          font: "12px sans-serif",
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          style: LabelStyle.FILL_AND_OUTLINE,
          horizontalOrigin: HorizontalOrigin.LEFT,
          verticalOrigin: VerticalOrigin.CENTER,
          pixelOffset: new Cartesian3(14, 0, 0),
        },
      });
      overlayEntities.current.set(key, entity);
    }

    // EZ polygons.
    for (const z of bms.zones()) {
      const key = `${overlayFlag.zones}/${z.id}`;
      if (overlayEntities.current.has(key)) continue;
      const positions = z.polygon.map(([lon, lat]) => Cartesian3.fromDegrees(lon, lat));
      const entity = viewer.entities.add({
        show: showZones,
        polygon: {
          hierarchy: new PolygonHierarchy(positions),
          material: Color.fromCssColorString(zoneColour(z.kind)).withAlpha(0.18),
          outline: true,
          outlineColor: Color.fromCssColorString(zoneColour(z.kind)),
        },
        label: {
          text: `${z.kind} · ${z.name}`,
          font: "11px sans-serif",
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          style: LabelStyle.FILL_AND_OUTLINE,
          horizontalOrigin: HorizontalOrigin.CENTER,
          verticalOrigin: VerticalOrigin.CENTER,
          // Place label at the polygon centroid.
          pixelOffset: new Cartesian3(0, 0, 0),
        },
        position: Cartesian3.fromDegrees(
          z.polygon.reduce((s, p) => s + p[0], 0) / z.polygon.length,
          z.polygon.reduce((s, p) => s + p[1], 0) / z.polygon.length,
        ),
      });
      overlayEntities.current.set(key, entity);
    }
  }, [ready, showDAL, showZones]);

  // Toggle visibility of overlay groups.
  useEffect(() => {
    for (const [key, ent] of overlayEntities.current) {
      if (key.startsWith(overlayFlag.dal)) ent.show = showDAL as never;
      if (key.startsWith(overlayFlag.zones)) ent.show = showZones as never;
      if (key.startsWith(overlayFlag.prediction)) ent.show = showPrediction as never;
    }
  }, [showDAL, showZones, showPrediction]);

  // Mock track feed.
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

  // Prediction overlay: projected paths for active threats + intercept geometry for EXECUTING engagements.
  useEffect(() => {
    if (!ready) return;
    const viewer = viewerRef.current;
    if (!viewer) return;
    const refresh = () => {
      // Drop any prior prediction entities.
      for (const [key, ent] of overlayEntities.current) {
        if (key.startsWith(overlayFlag.prediction)) {
          viewer.entities.remove(ent);
          overlayEntities.current.delete(key);
        }
      }

      // Projected paths for hostile/unknown threats.
      for (const t of bms.threats()) {
        if (t.affiliation === "F" || t.affiliation === "N") continue;
        const wps = bms.propagate(t);
        if (wps.length < 2) continue;
        const positions = wps.map((w) => Cartesian3.fromDegrees(w.lon, w.lat, t.altitudeM));
        const colour = Color.fromCssColorString(t.affiliation === "H" ? "#e63946" : "#f4d35e").withAlpha(0.55);
        const path = viewer.entities.add({
          show: showPrediction,
          polyline: {
            positions,
            width: 1.5,
            material: colour,
          },
        });
        overlayEntities.current.set(`${overlayFlag.prediction}/path/${t.id}`, path);

        // Uncertainty endpoint dot.
        const last = wps[wps.length - 1];
        const dot = viewer.entities.add({
          show: showPrediction,
          position: Cartesian3.fromDegrees(last.lon, last.lat, t.altitudeM),
          point: {
            pixelSize: 6,
            color: colour,
            outlineColor: Color.WHITE,
            outlineWidth: 1,
          },
          label: {
            text: `+${Math.round(last.uncertaintyM)} m σ3`,
            font: "10px sans-serif",
            fillColor: Color.WHITE,
            outlineColor: Color.BLACK,
            outlineWidth: 1.5,
            style: LabelStyle.FILL_AND_OUTLINE,
            horizontalOrigin: HorizontalOrigin.LEFT,
            pixelOffset: new Cartesian3(8, 0, 0),
            distanceDisplayCondition: new DistanceDisplayCondition(0, 250_000),
          },
        });
        overlayEntities.current.set(`${overlayFlag.prediction}/dot/${t.id}`, dot);
      }

      // Intercept geometry: for each EXECUTING engagement, draw effector → predicted impact line.
      for (const eng of bms.engagements()) {
        if (eng.status !== "EXECUTING") continue;
        const t = bms.threats().find((x) => x.id === eng.threatId);
        const e = bms.effectors().find((x) => x.id === eng.effectorId);
        if (!t || !e) continue;
        const wps = bms.propagate(t);
        // Pick the predicted position at TTI seconds.
        const idx = Math.min(wps.length - 1, Math.max(0, Math.round(eng.timeToInterceptS / 10)));
        const aim = wps[idx];
        const intercept = viewer.entities.add({
          show: showPrediction,
          polyline: {
            positions: [
              Cartesian3.fromDegrees(e.lon, e.lat, 0),
              Cartesian3.fromDegrees(aim.lon, aim.lat, t.altitudeM),
            ],
            width: 2,
            material: Color.fromCssColorString("#3273dc").withAlpha(0.85),
          },
        });
        overlayEntities.current.set(`${overlayFlag.prediction}/intercept/${eng.id}`, intercept);
      }
    };
    refresh();
    const id = window.setInterval(refresh, 2_500);
    return () => window.clearInterval(id);
  }, [ready, showPrediction]);

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
      <div className="overlay-toggles" role="group" aria-label={t("layers.bmsOverlays")}>
        <label className="layer-toggle">
          <input type="checkbox" checked={showDAL} onChange={(e) => setShowDAL(e.target.checked)} /> {t("layers.dal")}
        </label>
        <label className="layer-toggle">
          <input type="checkbox" checked={showZones} onChange={(e) => setShowZones(e.target.checked)} /> {t("layers.zones")}
        </label>
        <label className="layer-toggle">
          <input type="checkbox" checked={showPrediction} onChange={(e) => setShowPrediction(e.target.checked)} /> {t("layers.prediction")}
        </label>
      </div>
      <div ref={containerRef} className="globe-canvas" />
    </div>
  );
}

function zoneColour(kind: string): string {
  switch (kind) {
    case "WEZ": return "#3ddc97";
    case "MEZ": return "#3273dc";
    case "HIDACZ": return "#f4d35e";
    case "JEZ": return "#b388ff";
    case "FEZ": return "#ff8a3d";
    default: return "#8b949e";
  }
}
