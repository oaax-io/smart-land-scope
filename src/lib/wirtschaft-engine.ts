// Single Source of Truth für BKP-Kosten und Residualwert.
// Reines TypeScript – keine React-/Supabase-Imports.

export type FloorInput = { index: number; bgfM2: number | null; heightM: number | null };

export type CostInput = {
  kennwertOberProM3: number;
  kennwertUgProM3: number;
  kennwertInklHonorare: boolean;
  honorarPctMin: number;
  honorarPctMax: number;
  bkp1Pct: number;
  abbruchM3: number;
  abbruchProM3: number;
  umgebungProM2: number;
  bkp5PctMin: number;
  bkp5PctMax: number;
  bkp6PctMin: number;
  bkp6PctMax: number;
};

export type RevenueInput = {
  nwfFaktor: number;
  marktpreisProM2: number | null;
  aussenflaecheM2: number;
  aussenAnrechnung: number;
  parkplaetze: number;
  preisProParkplatz: number;
};

export type ResidualInput = {
  entwicklergewinnPct: number;
  vermarktungPct: number;
  finanzierungPct: number;
  grundstuecksNebenkostenPct: number;
  sicherheitsabschlagPct: number;
};

export type EngineInput = {
  parcelAreaM2: number | null;
  footprintM2: number | null;
  floors: FloorInput[];
  cost: CostInput;
  revenue: RevenueInput;
  residual: ResidualInput;
};

export type MinMax = { min: number | null; max: number | null };
export type TraceEntry = { label: string; formula: string; value: number | null };

export type EngineResult = {
  bgfOber: number | null;
  bgfUg: number | null;
  volOber: number | null;
  volUg: number | null;
  bkp1: number | null;
  bkp2: MinMax;
  honorarAnteil: MinMax;
  bkp4: number | null;
  bkp5: MinMax;
  bkp6: MinMax;
  anlagekosten: { min: number | null; max: number | null; mittel: number | null };
  nwf: number | null;
  erloes: { wohnen: number | null; aussen: number | null; parkplaetze: number | null; total: number | null };
  entwicklergewinn: number | null;
  vermarktung: number | null;
  finanzierung: number | null;
  residualVorNebenkosten: number | null;
  residualwertLand: number | null;
  residualwertProM2: number | null;
  ratio: MinMax;
  marge: MinMax;
  warnings: string[];
  trace: TraceEntry[];
};

export const DEFAULT_COST: CostInput = {
  kennwertOberProM3: 950,
  kennwertUgProM3: 550,
  kennwertInklHonorare: true,
  honorarPctMin: 12,
  honorarPctMax: 15,
  bkp1Pct: 2,
  abbruchM3: 0,
  abbruchProM3: 45,
  umgebungProM2: 150,
  bkp5PctMin: 3,
  bkp5PctMax: 5,
  bkp6PctMin: 5,
  bkp6PctMax: 8,
};

export const DEFAULT_REVENUE: RevenueInput = {
  nwfFaktor: 0.65,
  marktpreisProM2: null,
  aussenflaecheM2: 0,
  aussenAnrechnung: 0.35,
  parkplaetze: 0,
  preisProParkplatz: 0,
};

export const DEFAULT_RESIDUAL: ResidualInput = {
  entwicklergewinnPct: 12,
  vermarktungPct: 2,
  finanzierungPct: 3,
  grundstuecksNebenkostenPct: 3,
  sicherheitsabschlagPct: 0,
};

const isNum = (v: number | null | undefined): v is number =>
  typeof v === "number" && Number.isFinite(v);

const fmt = (v: number | null, d = 0): string =>
  v === null
    ? "–"
    : v.toLocaleString("de-CH", { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/[’]/g, "'");

const add = (...xs: (number | null)[]): number | null =>
  xs.every(isNum) ? (xs as number[]).reduce((a, b) => a + b, 0) : null;
const mul = (a: number | null, b: number): number | null => (isNum(a) ? a * b : null);

function floorLabel(index: number): string {
  if (index < 0) return index === -1 ? "UG" : `${-index}. UG`;
  return index === 0 ? "EG" : `${index}. OG`;
}

export function computeWirtschaft(input: EngineInput): EngineResult {
  const { cost: c, revenue: rv, residual: rs } = input;
  const warnings: string[] = [];
  const trace: TraceEntry[] = [];
  const t = (label: string, formula: string, value: number | null) => {
    trace.push({ label, formula, value });
    return value;
  };

  // --- Geschosse ---
  let bgfOber: number | null = null;
  let bgfUg: number | null = null;
  let volOber: number | null = null;
  let volUg: number | null = null;
  let volOberBroken = false;
  let volUgBroken = false;

  for (const f of input.floors) {
    const lbl = floorLabel(f.index);
    const ug = f.index < 0;
    if (!isNum(f.bgfM2) || f.bgfM2 <= 0) {
      warnings.push(`Keine BGF für ${lbl} erfasst – Geschoss ignoriert`);
      continue;
    }
    if (ug) bgfUg = (bgfUg ?? 0) + f.bgfM2;
    else bgfOber = (bgfOber ?? 0) + f.bgfM2;
    if (!isNum(f.heightM) || f.heightM <= 0) {
      warnings.push(`Keine Geschosshöhe für ${lbl} erfasst`);
      if (ug) volUgBroken = true;
      else volOberBroken = true;
      continue;
    }
    const v = f.bgfM2 * f.heightM;
    if (ug) volUg = (volUg ?? 0) + v;
    else volOber = (volOber ?? 0) + v;
  }
  if (volOberBroken) volOber = null;
  if (volUgBroken) volUg = null;
  if (bgfOber === null) warnings.push("Keine oberirdischen Geschosse mit BGF erfasst");

  t("BGF oberirdisch", "Σ BGF Geschosse ≥ EG", bgfOber);
  t("BGF UG", "Σ BGF Geschosse < EG", bgfUg);
  t("Volumen oberirdisch (SIA 416)", "Σ BGF × Geschosshöhe", volOber);
  t("Volumen UG (SIA 416)", "Σ BGF × Geschosshöhe", volUg);

  // --- BKP 2 ---
  const hasOber = bgfOber !== null;
  const hasUg = bgfUg !== null;
  let gebaeude: number | null = null;
  if ((hasOber && volOber === null) || (hasUg && volUg === null) || (!hasOber && !hasUg)) {
    gebaeude = null;
    warnings.push("Gebäudevolumen unvollständig – BKP 2 nicht berechenbar");
  } else {
    gebaeude = (volOber ?? 0) * c.kennwertOberProM3 + (volUg ?? 0) * c.kennwertUgProM3;
  }
  const gebFormula = `${fmt(volOber)} m³ × ${fmt(c.kennwertOberProM3)} + ${fmt(volUg ?? 0)} m³ × ${fmt(c.kennwertUgProM3)}`;

  let bkp2: MinMax;
  let honorarAnteil: MinMax;
  if (c.kennwertInklHonorare) {
    t("BKP 2 Gebäude (inkl. Honorare)", gebFormula, gebaeude);
    bkp2 = { min: gebaeude, max: gebaeude };
    honorarAnteil = {
      min: mul(gebaeude, c.honorarPctMin / (100 + c.honorarPctMin)),
      max: mul(gebaeude, c.honorarPctMax / (100 + c.honorarPctMax)),
    };
    t("davon BKP 29 Honorare (min)", `BKP 2 × ${c.honorarPctMin}/(100+${c.honorarPctMin})`, honorarAnteil.min);
    t("davon BKP 29 Honorare (max)", `BKP 2 × ${c.honorarPctMax}/(100+${c.honorarPctMax})`, honorarAnteil.max);
  } else {
    t("BKP 21–28", gebFormula, gebaeude);
    honorarAnteil = {
      min: mul(gebaeude, c.honorarPctMin / 100),
      max: mul(gebaeude, c.honorarPctMax / 100),
    };
    t("BKP 29 Honorare (min)", `BKP 21–28 × ${c.honorarPctMin}%`, honorarAnteil.min);
    t("BKP 29 Honorare (max)", `BKP 21–28 × ${c.honorarPctMax}%`, honorarAnteil.max);
    bkp2 = { min: add(gebaeude, honorarAnteil.min), max: add(gebaeude, honorarAnteil.max) };
    t("BKP 2 (min)", "BKP 21–28 + BKP 29 min", bkp2.min);
    t("BKP 2 (max)", "BKP 21–28 + BKP 29 max", bkp2.max);
  }

  // --- BKP 1 (auf Basis Gebäudekosten / BKP2 min) ---
  const abbruch = c.abbruchM3 * c.abbruchProM3;
  const bkp1 = isNum(bkp2.min) ? bkp2.min * (c.bkp1Pct / 100) + abbruch : null;
  t("BKP 1 Vorbereitung", `BKP 2 × ${c.bkp1Pct}% + ${fmt(c.abbruchM3)} m³ × ${fmt(c.abbruchProM3)}`, bkp1);

  // --- BKP 4 ---
  let bkp4: number | null = null;
  if (!isNum(input.parcelAreaM2) || !isNum(input.footprintM2)) {
    warnings.push("Parzellenfläche oder bebaute Fläche fehlt – BKP 4 Umgebung nicht berechenbar");
  } else {
    bkp4 = Math.max(0, input.parcelAreaM2 - input.footprintM2) * c.umgebungProM2;
  }
  t(
    "BKP 4 Umgebung",
    `max(0, ${fmt(input.parcelAreaM2)} − ${fmt(input.footprintM2)}) m² × ${fmt(c.umgebungProM2)}`,
    bkp4,
  );

  // --- BKP 5 / 6 ---
  const base5Min = add(bkp1, bkp2.min, bkp4);
  const base5Max = add(bkp1, bkp2.max, bkp4);
  const bkp5: MinMax = { min: mul(base5Min, c.bkp5PctMin / 100), max: mul(base5Max, c.bkp5PctMax / 100) };
  t("BKP 5 Nebenkosten (min)", `(BKP1+BKP2+BKP4) × ${c.bkp5PctMin}%`, bkp5.min);
  t("BKP 5 Nebenkosten (max)", `(BKP1+BKP2+BKP4) × ${c.bkp5PctMax}%`, bkp5.max);

  const base6Min = add(base5Min, bkp5.min);
  const base6Max = add(base5Max, bkp5.max);
  const bkp6: MinMax = { min: mul(base6Min, c.bkp6PctMin / 100), max: mul(base6Max, c.bkp6PctMax / 100) };
  t("BKP 6 Reserve (min)", `(BKP1+BKP2+BKP4+BKP5) × ${c.bkp6PctMin}%`, bkp6.min);
  t("BKP 6 Reserve (max)", `(BKP1+BKP2+BKP4+BKP5) × ${c.bkp6PctMax}%`, bkp6.max);

  const akMin = add(base6Min, bkp6.min);
  const akMax = add(base6Max, bkp6.max);
  const akMid = isNum(akMin) && isNum(akMax) ? (akMin + akMax) / 2 : null;
  const anlagekosten = { min: akMin, max: akMax, mittel: akMid };
  t("Anlagekosten (min)", "BKP1+BKP2+BKP4+BKP5+BKP6", akMin);
  t("Anlagekosten (max)", "BKP1+BKP2+BKP4+BKP5+BKP6", akMax);
  t("Anlagekosten (mittel)", `(${fmt(akMin)} + ${fmt(akMax)}) / 2`, akMid);

  // --- Erlös ---
  const nwf = mul(bgfOber, rv.nwfFaktor);
  t("NWF (nur oberirdisch)", `${fmt(bgfOber)} m² × ${rv.nwfFaktor}`, nwf);

  let erloes: EngineResult["erloes"] = { wohnen: null, aussen: null, parkplaetze: null, total: null };
  const mp = rv.marktpreisProM2;
  if (!isNum(mp) || mp <= 0) {
    warnings.push("Kein Marktpreis erfasst – Erlös und Residualwert nicht berechenbar");
  } else {
    const wohnen = mul(nwf, mp);
    const aussen = rv.aussenflaecheM2 * rv.aussenAnrechnung * mp;
    const pp = rv.parkplaetze * rv.preisProParkplatz;
    erloes = { wohnen, aussen, parkplaetze: pp, total: add(wohnen, aussen, pp) };
    t("Erlös Wohnen", `${fmt(nwf)} m² × ${fmt(mp)}`, wohnen);
    t("Erlös Aussenflächen", `${fmt(rv.aussenflaecheM2)} m² × ${rv.aussenAnrechnung} × ${fmt(mp)}`, aussen);
    t("Erlös Parkplätze", `${rv.parkplaetze} × ${fmt(rv.preisProParkplatz)}`, pp);
    t("Erlös total", "Wohnen + Aussen + Parkplätze", erloes.total);
  }

  // --- Residual ---
  const E = erloes.total;
  const entwicklergewinn = mul(E, rs.entwicklergewinnPct / 100);
  const vermarktung = mul(E, rs.vermarktungPct / 100);
  const finanzierung = mul(akMid, rs.finanzierungPct / 100);
  const residualVorNebenkosten =
    isNum(E) && isNum(akMid) && isNum(entwicklergewinn) && isNum(vermarktung) && isNum(finanzierung)
      ? E - akMid - entwicklergewinn - vermarktung - finanzierung
      : null;
  t("Entwicklergewinn", `Erlös × ${rs.entwicklergewinnPct}%`, entwicklergewinn);
  t("Vermarktung", `Erlös × ${rs.vermarktungPct}%`, vermarktung);
  t("Finanzierung", `Anlagekosten mittel × ${rs.finanzierungPct}%`, finanzierung);
  t(
    "Residual vor Landnebenkosten",
    `${fmt(E)} − ${fmt(akMid)} − ${fmt(entwicklergewinn)} − ${fmt(vermarktung)} − ${fmt(finanzierung)}`,
    residualVorNebenkosten,
  );

  const residualwertLand = isNum(residualVorNebenkosten)
    ? (residualVorNebenkosten / (1 + rs.grundstuecksNebenkostenPct / 100)) * (1 - rs.sicherheitsabschlagPct / 100)
    : null;
  t(
    "Residualwert Land",
    `R / (1 + ${rs.grundstuecksNebenkostenPct}%) × (1 − ${rs.sicherheitsabschlagPct}%)`,
    residualwertLand,
  );
  if (isNum(residualwertLand) && residualwertLand < 0) warnings.push("Residualwert negativ – Projekt unwirtschaftlich");

  let residualwertProM2: number | null = null;
  if (isNum(residualwertLand)) {
    if (isNum(input.parcelAreaM2) && input.parcelAreaM2 > 0) residualwertProM2 = residualwertLand / input.parcelAreaM2;
    else warnings.push("Parzellenfläche fehlt – Residualwert pro m² nicht berechenbar");
  }
  t("Residualwert pro m² Parzelle", `Residualwert / ${fmt(input.parcelAreaM2)} m²`, residualwertProM2);

  const ratio: MinMax = {
    min: isNum(E) && isNum(akMax) && akMax > 0 ? E / akMax : null,
    max: isNum(E) && isNum(akMin) && akMin > 0 ? E / akMin : null,
  };
  const marge: MinMax = {
    min: isNum(E) && isNum(akMax) ? E - akMax : null,
    max: isNum(E) && isNum(akMin) ? E - akMin : null,
  };
  t("Erlös/Kosten (min)", "Erlös / Anlagekosten max", ratio.min);
  t("Erlös/Kosten (max)", "Erlös / Anlagekosten min", ratio.max);
  t("Marge (min)", "Erlös − Anlagekosten max", marge.min);
  t("Marge (max)", "Erlös − Anlagekosten min", marge.max);

  return {
    bgfOber, bgfUg, volOber, volUg, bkp1, bkp2, honorarAnteil, bkp4, bkp5, bkp6, anlagekosten,
    nwf, erloes, entwicklergewinn, vermarktung, finanzierung, residualVorNebenkosten,
    residualwertLand, residualwertProM2, ratio, marge, warnings, trace,
  };
}

// --- Schnellschätzung aus Zonenwerten ---

function normZiffer(v: number | null | undefined): number | null {
  if (!isNum(v) || v <= 0) return null;
  return v > 10 ? v / 100 : v;
}

export function buildFloorsFromZone(args: {
  parcelAreaM2: number | null;
  uez: number | null;
  az: number | null;
  maxFloors: number | null;
  maxHeightM: number | null;
  geschossHoeheM?: number;
  ugFaktor?: number;
}): { floors: FloorInput[]; footprintM2: number | null; source: string; warnings: string[] } {
  const gh = args.geschossHoeheM ?? 3.0;
  const ugF = args.ugFaktor ?? 1.0;
  const warnings: string[] = [];
  const uez = normZiffer(args.uez);
  const az = normZiffer(args.az);
  const parcel = isNum(args.parcelAreaM2) && args.parcelAreaM2 > 0 ? args.parcelAreaM2 : null;
  const maxFloors = isNum(args.maxFloors) && args.maxFloors > 0 ? Math.floor(args.maxFloors) : null;
  const maxH = isNum(args.maxHeightM) && args.maxHeightM > 0 ? args.maxHeightM : null;

  const empty = (msg: string) => {
    warnings.push(msg);
    return { floors: [] as FloorInput[], footprintM2: null, source: msg, warnings };
  };
  if (parcel === null) return empty("Parzellenfläche fehlt – keine Schnellschätzung möglich");

  let footprint: number;
  let n: number;
  let source: string;

  if (uez !== null) {
    footprint = parcel * uez;
    let nSrc: string;
    if (maxFloors !== null) {
      n = maxFloors;
      nSrc = "aus max. Geschosszahl";
    } else if (maxH !== null) {
      n = Math.floor(maxH / gh);
      nSrc = `aus Höhe ${fmt(maxH, 0)} m`;
    } else {
      return empty("Weder max. Geschosszahl noch max. Höhe vorhanden – Geschosse nicht ableitbar");
    }
    if (n <= 0) return empty("Max. Höhe ergibt weniger als ein Geschoss");
    source = `ÜZ ${uez.toFixed(2)} × ${fmt(parcel)} m² = ${fmt(footprint)} m² pro Obergeschoss, ${n} Obergeschosse (${nSrc})`;
  } else if (az !== null) {
    const bgf = parcel * az;
    if (maxFloors !== null) n = maxFloors;
    else {
      n = 3;
      warnings.push("Keine max. Geschosszahl – Annahme 3 Obergeschosse");
    }
    footprint = bgf / n;
    source = `AZ ${az.toFixed(2)} × ${fmt(parcel)} m² = ${fmt(bgf)} m² BGF oberirdisch, verteilt auf ${n} Obergeschosse à ${fmt(footprint)} m²`;
  } else {
    return empty("Weder ÜZ noch AZ vorhanden – keine Schnellschätzung möglich");
  }

  const floors: FloorInput[] = [{ index: -1, bgfM2: footprint * ugF, heightM: 3.0 }];
  for (let i = 0; i < n; i++) floors.push({ index: i, bgfM2: footprint, heightM: gh });
  return { floors, footprintM2: footprint, source, warnings };
}
