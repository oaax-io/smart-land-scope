// Bewertungssystem für Entwicklungspotenziale (0–100)
// Rein client-seitige Heuristik auf Basis der gespeicherten Analyse-Felder.

export type ScoreCategory = "weak" | "medium" | "good" | "very_attractive";

export type DevelopmentScore = {
  score: number; // 0–100
  category: ScoreCategory;
  categoryLabel: string;
  reasoning: string;
  opportunities: string[];
  risks: string[];
  recommendation: string;
  breakdown: { label: string; points: number; max: number; note?: string }[];
};

export const SCORE_CATEGORY: Record<
  ScoreCategory,
  { label: string; tone: string; range: string }
> = {
  weak: { label: "Schwach", tone: "bg-muted text-foreground", range: "0–25" },
  medium: { label: "Mittel", tone: "bg-secondary/20 text-secondary-foreground", range: "26–50" },
  good: { label: "Gut", tone: "bg-primary/15 text-primary", range: "51–75" },
  very_attractive: {
    label: "Sehr attraktiv",
    tone: "bg-primary text-primary-foreground",
    range: "76–100",
  },
};

function categorize(score: number): ScoreCategory {
  if (score <= 25) return "weak";
  if (score <= 50) return "medium";
  if (score <= 75) return "good";
  return "very_attractive";
}

type ScoreInput = {
  zone?: string | null;
  utilization_ratio?: number | string | null;
  max_floors?: number | string | null;
  area_size?: number | string | null;
  usage_type?: unknown; // string[] expected
  restrictions?: unknown; // string[] expected
  special_provisions?: string | null;
  heritage_protected?: boolean | null;
  design_plan_required?: boolean | null;
  risks?: unknown; // Risk[]
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

export function computeDevelopmentScore(input: ScoreInput): DevelopmentScore {
  const breakdown: DevelopmentScore["breakdown"] = [];
  const opportunities: string[] = [];
  const risks: string[] = [];

  // 1) Zone (max 15)
  const zone = (input.zone ?? "").toString().toLowerCase();
  let zonePts = 6;
  let zoneNote = "Unbekannte oder gemischte Zone";
  if (/(misch|kern|zentr|wmz|wgz|geschäft)/.test(zone)) {
    zonePts = 15;
    zoneNote = "Misch-/Kernzone – sehr flexibel nutzbar";
    opportunities.push("Mischnutzung Wohnen/Gewerbe möglich");
  } else if (/(wohn|w[2-9]|wf|wohnzone)/.test(zone)) {
    zonePts = 12;
    zoneNote = "Wohnzone – klare Nutzung";
  } else if (/(gewerbe|industrie|arbeit)/.test(zone)) {
    zonePts = 8;
    zoneNote = "Gewerbe-/Industriezone";
    risks.push("Eingeschränkte Wohnnutzung in Gewerbe-/Industriezonen");
  } else if (/(landwirt|frei|grün|schutz)/.test(zone)) {
    zonePts = 2;
    zoneNote = "Nicht-Bauzone oder Schutzzone";
    risks.push("Bauen ausserhalb der Bauzone stark eingeschränkt");
  }
  breakdown.push({ label: "Zone", points: zonePts, max: 15, note: zoneNote });

  // 2) Ausnützungsziffer (max 25)
  const az = num(input.utilization_ratio);
  let azPts = 0;
  let azNote = "Keine AZ erfasst";
  if (az !== null) {
    if (az >= 1.0) { azPts = 25; azNote = `Sehr hohe AZ (${az}) – starkes Verdichtungspotenzial`; opportunities.push("Hohe Ausnützungsziffer ermöglicht dichte Bebauung"); }
    else if (az >= 0.7) { azPts = 20; azNote = `Hohe AZ (${az})`; opportunities.push("Gute Ausnützungsziffer"); }
    else if (az >= 0.5) { azPts = 14; azNote = `Mittlere AZ (${az})`; }
    else if (az >= 0.3) { azPts = 8;  azNote = `Geringe AZ (${az})`; risks.push("Niedrige Ausnützungsziffer begrenzt Volumen"); }
    else { azPts = 3; azNote = `Sehr geringe AZ (${az})`; risks.push("Sehr niedrige AZ – wenig Baumasse möglich"); }
  }
  breakdown.push({ label: "Ausnützungsziffer", points: azPts, max: 25, note: azNote });

  // 3) Geschossigkeit (max 15)
  const floors = num(input.max_floors);
  let flPts = 0;
  let flNote = "Keine Angabe";
  if (floors !== null) {
    if (floors >= 6) { flPts = 15; flNote = `${floors} Vollgeschosse – Hochbau möglich`; opportunities.push("Mehrgeschossiger Bau erlaubt"); }
    else if (floors >= 4) { flPts = 12; flNote = `${floors} Vollgeschosse`; }
    else if (floors >= 3) { flPts = 9; flNote = `${floors} Vollgeschosse`; }
    else if (floors >= 2) { flPts = 5; flNote = `${floors} Vollgeschosse`; }
    else { flPts = 2; flNote = `Nur ${floors} Vollgeschoss`; risks.push("Geringe Geschossigkeit limitiert Wohnungsanzahl"); }
  }
  breakdown.push({ label: "Geschossigkeit", points: flPts, max: 15, note: flNote });

  // 4) Grundstücksfläche (max 15)
  const area = num(input.area_size);
  let arPts = 0;
  let arNote = "Keine Fläche erfasst";
  if (area !== null) {
    if (area >= 3000) { arPts = 15; arNote = `${area} m² – grosses Entwicklungsareal`; opportunities.push("Grosses Grundstück erlaubt Etappierung & Projektvielfalt"); }
    else if (area >= 1500) { arPts = 12; arNote = `${area} m²`; }
    else if (area >= 800) { arPts = 9; arNote = `${area} m²`; }
    else if (area >= 400) { arPts = 5; arNote = `${area} m² – knapp`; }
    else { arPts = 2; arNote = `${area} m² – sehr klein`; risks.push("Sehr kleines Grundstück erschwert Wirtschaftlichkeit"); }
  }
  breakdown.push({ label: "Grundstücksfläche", points: arPts, max: 15, note: arNote });

  // 5) Nutzungsflexibilität (max 10) – Anzahl zulässiger Nutzungsarten
  const usages = arr(input.usage_type);
  let usPts = 0;
  let usNote = "Keine Nutzungsarten erfasst";
  if (usages.length >= 4) { usPts = 10; usNote = `${usages.length} Nutzungsarten zulässig`; opportunities.push("Hohe Nutzungsflexibilität"); }
  else if (usages.length === 3) { usPts = 8; usNote = "3 Nutzungsarten"; }
  else if (usages.length === 2) { usPts = 6; usNote = "2 Nutzungsarten"; }
  else if (usages.length === 1) { usPts = 3; usNote = "Nur 1 Nutzungsart"; risks.push("Geringe Nutzungsflexibilität"); }
  breakdown.push({ label: "Nutzungsflexibilität", points: usPts, max: 10, note: usNote });

  // 6) Einschränkungen (max 10) – weniger ist besser
  const restrictions = arr(input.restrictions);
  const restrictionCount = restrictions.length;
  let rePts = 10;
  let reNote = "Keine relevanten Einschränkungen";
  if (restrictionCount >= 5) { rePts = 2; reNote = `${restrictionCount} Einschränkungen`; risks.push("Zahlreiche bauliche Einschränkungen"); }
  else if (restrictionCount >= 3) { rePts = 5; reNote = `${restrictionCount} Einschränkungen`; risks.push("Mehrere Einschränkungen zu beachten"); }
  else if (restrictionCount >= 1) { rePts = 8; reNote = `${restrictionCount} Einschränkung(en)`; }
  breakdown.push({ label: "Einschränkungen", points: rePts, max: 10, note: reNote });

  // 7) Sonderauflagen (max 10) – Denkmalschutz, Gestaltungsplan, Sondervorschriften
  let soPts = 10;
  const soNotes: string[] = [];
  if (input.heritage_protected) { soPts -= 5; soNotes.push("Denkmalschutz"); risks.push("Denkmalschutz schränkt Eingriffe stark ein"); }
  if (input.design_plan_required) { soPts -= 3; soNotes.push("Gestaltungsplanpflicht"); risks.push("Gestaltungsplanpflicht verlängert Verfahren"); }
  if (input.special_provisions && input.special_provisions.trim().length > 0) {
    soPts -= 2; soNotes.push("Sondervorschriften"); risks.push("Sondervorschriften beachten");
  }
  soPts = Math.max(0, soPts);
  breakdown.push({
    label: "Sonderauflagen",
    points: soPts,
    max: 10,
    note: soNotes.length ? soNotes.join(", ") : "Keine Sonderauflagen",
  });

  const score = Math.max(0, Math.min(100, breakdown.reduce((s, b) => s + b.points, 0)));
  const category = categorize(score);
  const categoryLabel = SCORE_CATEGORY[category].label;

  const recommendation =
    category === "very_attractive"
      ? "Hervorragendes Entwicklungspotenzial – konkrete Projektierung und Wirtschaftlichkeitsstudie empfohlen."
      : category === "good"
      ? "Solides Potenzial – Vorprojekt mit Architekt erstellen und Finanzierung prüfen."
      : category === "medium"
      ? "Bedingt attraktiv – Vertiefte Abklärungen zu Einschränkungen und Marktlage notwendig."
      : "Geringes Entwicklungspotenzial – Alternative Strategien (Bestand, Verkauf, Umnutzung) prüfen.";

  const reasoning =
    `Der Score von ${score}/100 (${categoryLabel}) ergibt sich aus der Bewertung von Zone, ` +
    `Ausnützungsziffer, Geschossigkeit, Grundstücksfläche, Nutzungsflexibilität, baulichen ` +
    `Einschränkungen und Sonderauflagen. Stärkster Beitrag: ` +
    `${[...breakdown].sort((a, b) => b.points / b.max - a.points / a.max)[0].label}.`;

  // Fallbacks
  if (opportunities.length === 0) opportunities.push("Keine ausgeprägten Chancen erkennbar");
  if (risks.length === 0) risks.push("Keine wesentlichen Risiken identifiziert");

  return {
    score,
    category,
    categoryLabel,
    reasoning,
    opportunities,
    risks,
    recommendation,
    breakdown,
  };
}
