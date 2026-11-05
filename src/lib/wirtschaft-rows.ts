// Darstellung des Engine-Ergebnisses als Tabellenzeilen – gemeinsam für Card, Bericht und PDF.
// Keine Rechnung: es werden nur Werte aus EngineResult ausgewählt und formatiert.
import type { EngineInput, EngineResult } from "./wirtschaft-engine";

export type WirtschaftRowView = {
  label: string;
  min: string;
  max: string;
  formula: string;
  indent?: boolean;
  strong?: boolean;
  highlight?: boolean;
};

const nf = (d = 0) => new Intl.NumberFormat("de-CH", { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtNum = (v: number | null | undefined, d = 0) => (v == null || !Number.isFinite(v) ? "–" : nf(d).format(v));
export const fmtChf = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "–" : `CHF ${nf(0).format(Math.round(v))}`);
const fmtM2 = (v: number | null) => (v == null ? "–" : `${fmtNum(v)} m²`);
const fmtRatio = (v: number | null) => (v == null ? "–" : v.toFixed(2));

export function buildWirtschaftRows(r: EngineResult, input: EngineInput): WirtschaftRowView[] {
  const tr = new Map(r.trace.map((t) => [t.label, t.formula]));
  const f = (...labels: string[]) =>
    labels
      .map((l) => (tr.has(l) ? `${l}: ${tr.get(l)}` : null))
      .filter(Boolean)
      .join("\n");
  const c = input.cost;
  const inkl = c.kennwertInklHonorare;
  return [
    { label: "BKP 1 Vorbereitung", min: fmtChf(r.bkp1), max: fmtChf(r.bkp1), formula: f("BKP 1 Vorbereitung") },
    {
      label: inkl ? "BKP 2 Gebäude (inkl. Honorare)" : "BKP 2 Gebäude",
      min: fmtChf(r.bkp2.min),
      max: fmtChf(r.bkp2.max),
      formula: inkl ? f("BKP 2 Gebäude (inkl. Honorare)") : f("BKP 21–28", "BKP 2 (min)", "BKP 2 (max)"),
      strong: true,
    },
    {
      label: `oberirdisch ${fmtNum(r.volOber)} m³ × CHF ${fmtNum(c.kennwertOberProM3)}`,
      min: fmtChf(r.bkp2Teile.ober),
      max: fmtChf(r.bkp2Teile.ober),
      formula: f("Volumen oberirdisch (SIA 416)"),
      indent: true,
    },
    {
      label: `UG ${fmtNum(r.volUg)} m³ × CHF ${fmtNum(c.kennwertUgProM3)}`,
      min: fmtChf(r.bkp2Teile.ug),
      max: fmtChf(r.bkp2Teile.ug),
      formula: f("Volumen UG (SIA 416)"),
      indent: true,
    },
    {
      label: inkl
        ? `davon Honorare BKP 29 (${c.honorarPctMin}–${c.honorarPctMax}%)`
        : `+ Honorare BKP 29 (${c.honorarPctMin}–${c.honorarPctMax}%)`,
      min: fmtChf(r.honorarAnteil.min),
      max: fmtChf(r.honorarAnteil.max),
      formula: inkl
        ? f("davon BKP 29 Honorare (min)", "davon BKP 29 Honorare (max)")
        : f("BKP 29 Honorare (min)", "BKP 29 Honorare (max)"),
      indent: true,
    },
    { label: "BKP 4 Umgebung", min: fmtChf(r.bkp4), max: fmtChf(r.bkp4), formula: f("BKP 4 Umgebung") },
    {
      label: `BKP 5 Nebenkosten (${c.bkp5PctMin}–${c.bkp5PctMax}%)`,
      min: fmtChf(r.bkp5.min),
      max: fmtChf(r.bkp5.max),
      formula: f("BKP 5 Nebenkosten (min)", "BKP 5 Nebenkosten (max)"),
    },
    {
      label: `BKP 6 Reserve (${c.bkp6PctMin}–${c.bkp6PctMax}%)`,
      min: fmtChf(r.bkp6.min),
      max: fmtChf(r.bkp6.max),
      formula: f("BKP 6 Reserve (min)", "BKP 6 Reserve (max)"),
    },
    {
      label: "= Anlagekosten",
      min: fmtChf(r.anlagekosten.min),
      max: fmtChf(r.anlagekosten.max),
      formula: f("Anlagekosten (min)", "Anlagekosten (max)"),
      strong: true,
      highlight: true,
    },
    {
      label: "Anlagekosten mittel",
      min: fmtChf(r.anlagekosten.mittel),
      max: "",
      formula: f("Anlagekosten (mittel)"),
      strong: true,
    },
    { label: "NWF (nur oberirdisch)", min: fmtM2(r.nwf), max: "", formula: f("NWF (nur oberirdisch)") },
    { label: "Erlös Wohnen", min: fmtChf(r.erloes.wohnen), max: "", formula: f("Erlös Wohnen") },
    { label: "Erlös Aussenflächen", min: fmtChf(r.erloes.aussen), max: "", formula: f("Erlös Aussenflächen") },
    { label: "Erlös Parkplätze", min: fmtChf(r.erloes.parkplaetze), max: "", formula: f("Erlös Parkplätze") },
    { label: "Erlös total", min: fmtChf(r.erloes.total), max: "", formula: f("Erlös total"), strong: true },
    { label: `− Entwicklergewinn (${input.residual.entwicklergewinnPct}%)`, min: fmtChf(r.entwicklergewinn), max: "", formula: f("Entwicklergewinn") },
    { label: `− Vermarktung (${input.residual.vermarktungPct}%)`, min: fmtChf(r.vermarktung), max: "", formula: f("Vermarktung") },
    { label: `− Finanzierung (${input.residual.finanzierungPct}%)`, min: fmtChf(r.finanzierung), max: "", formula: f("Finanzierung") },
    {
      label: "= Residual vor Landnebenkosten",
      min: fmtChf(r.residualVorNebenkosten),
      max: "",
      formula: f("Residual vor Landnebenkosten"),
      strong: true,
    },
    {
      label: "Residualwert Land",
      min: fmtChf(r.residualwertLand),
      max: "",
      formula: f("Residualwert Land"),
      strong: true,
      highlight: true,
    },
    {
      label: "pro m² Parzelle",
      min: r.residualwertProM2 == null ? "–" : `${fmtChf(r.residualwertProM2)}/m²`,
      max: "",
      formula: f("Residualwert pro m² Parzelle"),
    },
    {
      label: "Erlös/Kosten-Ratio",
      min: fmtRatio(r.ratio.min),
      max: fmtRatio(r.ratio.max),
      formula: f("Erlös/Kosten (min)", "Erlös/Kosten (max)"),
    },
    {
      label: "Marge",
      min: fmtChf(r.marge.min),
      max: fmtChf(r.marge.max),
      formula: f("Marge (min)", "Marge (max)"),
      strong: true,
    },
  ];
}
