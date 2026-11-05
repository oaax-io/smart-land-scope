// Mapping DB → EngineInput. Reines TypeScript (kein React), damit Card, Bericht,
// PDF und Skripte exakt denselben Input für computeWirtschaft() erzeugen.
import {
  buildFloorsFromZone,
  resolveZoneInputs,
  DEFAULT_COST,
  DEFAULT_REVENUE,
  DEFAULT_RESIDUAL,
  type EngineInput,
  type FloorInput,
} from "./wirtschaft-engine";

export type WirtschaftMode = "quick" | "detail";

export type AnalysisForEngine = {
  area_size?: unknown;
  building_coverage_ratio?: unknown;
  utilization_ratio?: unknown;
  max_floors?: unknown;
  max_height?: unknown;
  extracted_data?: unknown;
};

export type FloorRow = {
  floor_index: number;
  gross_area_m2: number | string | null;
  floor_height_m: number | string | null;
};

/** Alle Spalten aus analysis_wirtschaft, die die Engine braucht (alle optional → Defaults). */
export type WirtschaftRow = Partial<{
  kosten_oberirdisch_pro_m3: number | string | null;
  kosten_ug_pro_m3: number | string | null;
  kennwert_inkl_honorare: boolean | null;
  sia_honorare_min: number | string | null;
  sia_honorare_max: number | string | null;
  bkp1_pct: number | string | null;
  abbruch_m3: number | string | null;
  abbruch_pro_m3: number | string | null;
  umgebung_pro_m2: number | string | null;
  bkp5_min: number | string | null;
  bkp5_max: number | string | null;
  bkp6_min: number | string | null;
  bkp6_max: number | string | null;
  nwf_faktor: number | string | null;
  marktpreis_pro_m2: number | string | null;
  aussenflaeche_m2: number | string | null;
  aussenflaeche_anrechnungsfaktor: number | string | null;
  parkplaetze: number | string | null;
  preis_pro_parkplatz: number | string | null;
  entwicklergewinn_pct: number | string | null;
  vermarktung_pct: number | string | null;
  finanzierung_pct: number | string | null;
  grundstuecks_nebenkosten_pct: number | string | null;
  sicherheitsabschlag_pct: number | string | null;
  parzellenpreis: number | string | null;
  slider_bandbreite: number | string | null;
}>;

const num = (v: unknown, fallback: number): number => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
};
const posOrNull = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
};

/** Default-Modus wie in der Card: Detail, sobald Geschosse erfasst sind. */
export function defaultWirtschaftMode(floorRows: FloorRow[] | null | undefined): WirtschaftMode {
  return floorRows && floorRows.length > 0 ? "detail" : "quick";
}

/** Zonen-Vorschlag – identisch zum FloorCalculatorCard. */
export function zoneSuggestion(analysis: AnalysisForEngine) {
  const z = resolveZoneInputs(analysis);
  const r = buildFloorsFromZone({
    parcelAreaM2: z.parcelAreaM2,
    uez: z.uez,
    az: z.az,
    maxFloors: z.maxFloors,
    maxHeightM: z.maxHeightM,
    maxFacadeHeightM: z.maxFacadeHeightM,
  });
  const ug = r.floors.find((f) => f.index < 0)?.bgfM2 ?? null;
  return {
    ...r,
    zone: z,
    footprintOber: r.footprintM2 !== null ? Math.round(r.footprintM2) : null,
    footprintUg: ug !== null ? Math.round(ug) : null,
    nOber: r.floors.filter((f) => f.index >= 0).length,
  };
}

/** DB-Geschosse → FloorInput[]; leere BGF bekommt den Zonen-Vorschlag (wie im Rechner). */
export function floorsFromRows(analysis: AnalysisForEngine, rows: FloorRow[]): FloorInput[] {
  const s = zoneSuggestion(analysis);
  return [...rows]
    .sort((a, b) => a.floor_index - b.floor_index)
    .map((f) => {
      const entered = posOrNull(f.gross_area_m2);
      const bgf = entered ?? (f.floor_index < 0 ? s.footprintUg : s.footprintOber);
      return { index: f.floor_index, bgfM2: bgf, heightM: posOrNull(f.floor_height_m) };
    });
}

export function buildEngineInput(
  analysis: AnalysisForEngine,
  floorRows: FloorRow[],
  w: WirtschaftRow | null | undefined,
  mode: WirtschaftMode,
  floorsOverride?: FloorInput[],
): EngineInput {
  const s = zoneSuggestion(analysis);
  const floors: FloorInput[] =
    mode === "quick" ? s.floors : floorsOverride && floorsOverride.length > 0 ? floorsOverride : floorsFromRows(analysis, floorRows);
  const eg = floors.find((f) => f.index === 0)?.bgfM2 ?? null;
  const r = w ?? {};
  return {
    parcelAreaM2: s.zone.parcelAreaM2,
    footprintM2: s.footprintM2 ?? eg,
    floors,
    cost: {
      kennwertOberProM3: num(r.kosten_oberirdisch_pro_m3, DEFAULT_COST.kennwertOberProM3),
      kennwertUgProM3: num(r.kosten_ug_pro_m3, DEFAULT_COST.kennwertUgProM3),
      kennwertInklHonorare: r.kennwert_inkl_honorare ?? DEFAULT_COST.kennwertInklHonorare,
      honorarPctMin: num(r.sia_honorare_min, DEFAULT_COST.honorarPctMin),
      honorarPctMax: num(r.sia_honorare_max, DEFAULT_COST.honorarPctMax),
      bkp1Pct: num(r.bkp1_pct, DEFAULT_COST.bkp1Pct),
      abbruchM3: num(r.abbruch_m3, DEFAULT_COST.abbruchM3),
      abbruchProM3: num(r.abbruch_pro_m3, DEFAULT_COST.abbruchProM3),
      umgebungProM2: num(r.umgebung_pro_m2, DEFAULT_COST.umgebungProM2),
      bkp5PctMin: num(r.bkp5_min, DEFAULT_COST.bkp5PctMin),
      bkp5PctMax: num(r.bkp5_max, DEFAULT_COST.bkp5PctMax),
      bkp6PctMin: num(r.bkp6_min, DEFAULT_COST.bkp6PctMin),
      bkp6PctMax: num(r.bkp6_max, DEFAULT_COST.bkp6PctMax),
    },
    revenue: {
      nwfFaktor: num(r.nwf_faktor, DEFAULT_REVENUE.nwfFaktor),
      marktpreisProM2: posOrNull(r.marktpreis_pro_m2) ?? DEFAULT_REVENUE.marktpreisProM2,
      aussenflaecheM2: num(r.aussenflaeche_m2, DEFAULT_REVENUE.aussenflaecheM2),
      aussenAnrechnung: num(r.aussenflaeche_anrechnungsfaktor, DEFAULT_REVENUE.aussenAnrechnung),
      parkplaetze: num(r.parkplaetze, DEFAULT_REVENUE.parkplaetze),
      preisProParkplatz: num(r.preis_pro_parkplatz, DEFAULT_REVENUE.preisProParkplatz),
    },
    residual: {
      entwicklergewinnPct: num(r.entwicklergewinn_pct, DEFAULT_RESIDUAL.entwicklergewinnPct),
      vermarktungPct: num(r.vermarktung_pct, DEFAULT_RESIDUAL.vermarktungPct),
      finanzierungPct: num(r.finanzierung_pct, DEFAULT_RESIDUAL.finanzierungPct),
      grundstuecksNebenkostenPct: num(r.grundstuecks_nebenkosten_pct, DEFAULT_RESIDUAL.grundstuecksNebenkostenPct),
      sicherheitsabschlagPct: num(r.sicherheitsabschlag_pct, DEFAULT_RESIDUAL.sicherheitsabschlagPct),
    },
  };
}
