/**
 * Server-only helper: schlägt für Stadt-Luzern-Parzellen (deren kantonaler
 * Zonenplan-Layer AZ/ÜZ nicht liefert) den wahrscheinlichsten BZR-Zonencode
 * aus den importierten `knowledge_entries` vor. Nutzt die WFS-Merkmale
 * (Fassadenhöhe, Bauweise, Zonenkategorie) plus Adresse/Kontext und die KI,
 * um aus den Kandidaten die passendste Zone (WO18x, WA10, …) zu wählen.
 */
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { parseJsonObject, asRecord, readString, readNumber } from "./ai-json.server";

type KnowledgeRow = { category: string; key: string; value: string | null };

export type BzrCandidate = {
  code: string;
  zone: string | null;
  nutzung: string | null;
  ueberbauungsziffer: number | null;
  ausnuetzungsziffer: number | null;
  vollgeschosse: number | null;
  fassadenhoehe: number | null;
  gebaeudelaenge: number | null;
  bauweise: string | null;
  gesamthoehe_flach: number | null;
  gesamthoehe_schraeg: number | null;
  weitere: string | null;
};

export type BzrSuggestInput = {
  address: string | null;
  municipality: string | null;
  wfsZoneCategory: string | null;
  wfsZoneLabel: string | null;
  wfsFacadeHeightMax: number | null;
  wfsBuildingType: string | null;
  wfsNoiseClass: string | null;
  candidates: BzrCandidate[];
  apiKey: string;
  model?: string;
};

export type BzrSuggestResult = {
  code: string;
  confidence: number;
  reasoning: string;
  candidate: BzrCandidate;
} | null;

/** Baut aus flachen knowledge_entries (Category/Key/Value) Kandidatenobjekte pro Zonencode. */
export function groupKnowledgeIntoCandidates(rows: KnowledgeRow[]): BzrCandidate[] {
  const map = new Map<string, BzrCandidate>();
  for (const r of rows) {
    if (!r.key) continue;
    let c = map.get(r.key);
    if (!c) {
      c = {
        code: r.key,
        zone: null,
        nutzung: null,
        ueberbauungsziffer: null,
        ausnuetzungsziffer: null,
        vollgeschosse: null,
        fassadenhoehe: null,
        gebaeudelaenge: null,
        bauweise: null,
        gesamthoehe_flach: null,
        gesamthoehe_schraeg: null,
        weitere: null,
      };
      map.set(r.key, c);
    }
    const num = r.value ? Number(String(r.value).replace(",", ".")) : NaN;
    switch (r.category) {
      case "Zone":
        c.zone = r.value;
        break;
      case "Nutzung":
        c.nutzung = r.value;
        break;
      case "Überbauungsziffer":
        if (Number.isFinite(num)) c.ueberbauungsziffer = num;
        break;
      case "Ausnützungsziffer":
      case "AZ":
        if (Number.isFinite(num)) c.ausnuetzungsziffer = num;
        break;
      case "Vollgeschosse":
        if (Number.isFinite(num)) c.vollgeschosse = num;
        break;
      case "Fassadenhöhe m":
        if (Number.isFinite(num)) c.fassadenhoehe = num;
        break;
      case "Gebäudelänge m":
        if (Number.isFinite(num)) c.gebaeudelaenge = num;
        break;
      case "Bauweise":
        c.bauweise = r.value;
        break;
      case "Gesamthöhe Flachdach m":
        if (Number.isFinite(num)) c.gesamthoehe_flach = num;
        break;
      case "Gesamthöhe Schrägdach m":
        if (Number.isFinite(num)) c.gesamthoehe_schraeg = num;
        break;
      case "Weitere Bestimmungen":
        c.weitere = r.value;
        break;
    }
  }
  return Array.from(map.values());
}

/** Filtert Kandidaten anhand harter WFS-Merkmale (Fassadenhöhe + Bauweise). */
export function filterCandidatesByWfs(
  all: BzrCandidate[],
  wfsFacadeHeightMax: number | null,
  wfsBuildingType: string | null,
  wfsZoneCategory: string | null,
): BzrCandidate[] {
  let out = all;
  if (wfsFacadeHeightMax != null) {
    out = out.filter((c) => c.fassadenhoehe == null || Math.abs(c.fassadenhoehe - wfsFacadeHeightMax) < 0.51);
  }
  if (wfsBuildingType) {
    const bt = wfsBuildingType.toLowerCase();
    out = out.filter((c) => !c.bauweise || c.bauweise.toLowerCase() === bt);
  }
  if (wfsZoneCategory) {
    const cat = wfsZoneCategory.toLowerCase();
    // Wohnzone → WO/WA-Codes; Zentrumszone → Z-Codes; Mischzone → M-Codes usw.
    const prefixMatch: Record<string, RegExp> = {
      wohnzone: /^(WO|WA|W)\d/i,
      kernzone: /^(K|D)\d/i,
      zentrumszone: /^Z\d/i,
      mischzone: /^M\d/i,
      arbeitszone: /^(A|G)\d/i,
    };
    for (const [k, re] of Object.entries(prefixMatch)) {
      if (cat.includes(k)) {
        out = out.filter((c) => re.test(c.code));
        break;
      }
    }
  }
  return out;
}

export async function suggestBzrCode(input: BzrSuggestInput): Promise<BzrSuggestResult> {
  const candidates = input.candidates;
  if (candidates.length === 0) return null;
  if (candidates.length === 1) {
    return {
      code: candidates[0].code,
      confidence: 0.6,
      reasoning: "Einziger Kandidat, der die WFS-Merkmale (Fassadenhöhe, Bauweise, Zonenkategorie) erfüllt.",
      candidate: candidates[0],
    };
  }

  const gateway = createLovableAiGatewayProvider(input.apiKey);
  const list = candidates
    .map(
      (c) =>
        `${c.code}: ${c.zone ?? ""} | Nutzung ${c.nutzung ?? "–"} | ÜZ ${c.ueberbauungsziffer ?? "–"} | AZ ${c.ausnuetzungsziffer ?? "–"} | Vollgesch. ${c.vollgeschosse ?? "–"} | Fassadenh. ${c.fassadenhoehe ?? "–"}m | Bauw. ${c.bauweise ?? "–"} | Länge ${c.gebaeudelaenge ?? "–"}m | Weitere: ${c.weitere ?? "–"}`,
    )
    .join("\n");

  const prompt = `Wähle den plausibelsten BZR-Zonencode der Stadt Luzern für folgende Parzelle:

Adresse: ${input.address ?? "unbekannt"}
Gemeinde: ${input.municipality ?? "–"}

Zonenplan (Kanton, WFS) liefert für diesen Punkt:
- Zonenkategorie: ${input.wfsZoneCategory ?? "–"}
- Kantonaler Zonenlabel: ${input.wfsZoneLabel ?? "–"}
- Fassadenhöhe max.: ${input.wfsFacadeHeightMax ?? "–"} m
- Bauweise: ${input.wfsBuildingType ?? "–"}
- Lärmempfindlichkeit: ${input.wfsNoiseClass ?? "–"}

Kandidaten aus dem Bau- und Zonenreglement Stadt Luzern (nur passend nach Fassadenhöhe/Bauweise vorgefiltert):
${list}

Wähle den EINEN plausibelsten Code. Berücksichtige, dass Innenstadt-/Zentrumslagen typischerweise höhere ÜZ (0.6–0.8) haben, Aussenquartiere niedrigere (0.3–0.5). Kleine 2-geschossige Wohnzonen sind selten in dichter Stadtlage.

Antworte AUSSCHLIESSLICH als JSON:
{ "code": "<Code>", "confidence": <0..1>, "reasoning": "<kurze Begründung>" }`;

  const result = await generateText({
    model: gateway(input.model ?? "google/gemini-2.5-flash"),
    prompt,
    maxOutputTokens: 400,
  });

  let parsed: Record<string, unknown> = {};
  try {
    parsed = asRecord(parseJsonObject(result.text));
  } catch (e) {
    console.warn("[bzr-suggest] JSON parse failed", e);
    return null;
  }

  const code = readString(parsed.code).trim();
  if (!code) return null;
  const chosen = candidates.find((c) => c.code.toLowerCase() === code.toLowerCase());
  if (!chosen) {
    console.warn("[bzr-suggest] AI returned unknown code", code);
    return null;
  }
  const conf = readNumber(parsed.confidence, 0.5);
  const reasoning = readString(parsed.reasoning, "");
  return { code: chosen.code, confidence: Math.max(0, Math.min(1, conf)), reasoning, candidate: chosen };
}
