/**
 * Einheitliche Einheiten-/Zahlenformatierung für die Machbarkeitsstudie.
 *
 * Alle strukturierten Zonenplan-Felder liefern SI-Basiseinheiten:
 *  - Höhen, Längen, Breiten, Abstände: Meter (m)
 *  - Flächen: Quadratmeter (m²)
 *  - Volumen: Kubikmeter (m³)
 *  - Ziffern (AZ/ÜZ/GFZ/BMZ): dimensionslos
 *
 * Diese Helper werden in ALLEN Berichtsteilen verwendet, damit
 * Einheiten und Dezimalstellen konsistent dargestellt werden.
 */

const LOCALE = "de-CH";

export const UNIT = {
  meter: "m",
  squareMeter: "m²",
  cubicMeter: "m³",
  floor: "Vollgeschosse",
  ratio: "",
} as const;

export type NumericInput = number | string | null | undefined;

/** Parst Zahl aus number oder string ("1,25" / "1.25"). Ungültig → null. */
export function parseNumeric(value: NumericInput): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function formatNumber(value: NumericInput, digits = 2): string {
  const n = parseNumeric(value);
  if (n == null) return "–";
  return n.toLocaleString(LOCALE, { maximumFractionDigits: digits });
}

/** Länge/Breite/Höhe in Metern — konsistent auf 2 Dezimalen, Einheit "m". */
export function formatMeters(value: NumericInput, digits = 2): string {
  const n = parseNumeric(value);
  if (n == null) return "–";
  return `${n.toLocaleString(LOCALE, { maximumFractionDigits: digits })} ${UNIT.meter}`;
}

/** Fläche in m² — Ganzzahl (m² sind meist gerundet). */
export function formatSquareMeters(value: NumericInput, digits = 0): string {
  const n = parseNumeric(value);
  if (n == null) return "–";
  return `${n.toLocaleString(LOCALE, { maximumFractionDigits: digits })} ${UNIT.squareMeter}`;
}

/** Volumen in m³. */
export function formatCubicMeters(value: NumericInput, digits = 0): string {
  const n = parseNumeric(value);
  if (n == null) return "–";
  return `${n.toLocaleString(LOCALE, { maximumFractionDigits: digits })} ${UNIT.cubicMeter}`;
}

/** Ausnützungs-/Überbauungsziffer etc. — dimensionslos, 2–3 Nachkommastellen. */
export function formatRatio(value: NumericInput, digits = 2): string {
  const n = parseNumeric(value);
  if (n == null) return "–";
  return n.toLocaleString(LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  });
}

/** Vollgeschosse. */
export function formatFloors(value: NumericInput): string {
  const n = parseNumeric(value);
  if (n == null) return "–";
  const rounded = Math.round(n * 10) / 10;
  return `${rounded.toLocaleString(LOCALE)} ${UNIT.floor}`;
}
