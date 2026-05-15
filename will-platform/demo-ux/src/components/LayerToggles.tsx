import { useI18n } from "../i18n";
import type { TrackKind } from "../types";

export type LayerState = Record<TrackKind, boolean>;

export function LayerToggles({ value, onChange }: { value: LayerState; onChange: (s: LayerState) => void }) {
  const { t } = useI18n();
  return (
    <div className="layer-toggles" role="group" aria-label={t("layers.label")}>
      {(["point", "cot", "mavlink", "gmti"] as TrackKind[]).map((k) => (
        <label key={k} className={`layer-toggle layer-${k}`}>
          <input type="checkbox" checked={value[k]} onChange={(e) => onChange({ ...value, [k]: e.target.checked })} />
          <span>{t(`layers.${k}`)}</span>
        </label>
      ))}
    </div>
  );
}
