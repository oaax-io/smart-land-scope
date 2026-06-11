import { generateObject } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

// Strict response shape requested by the product spec.
export const AnalysisAnswerSchema = z.object({
  allowed_use: z.string().min(1).max(2000),
  zone: z.string().min(1).max(200),
  max_floors: z.string().min(1).max(50),
  max_height: z.string().min(1).max(50),
  restrictions: z.array(z.string().min(1).max(400)).max(20),
  development_potential: z.enum(["low", "medium", "high", "very_high"]),
  reasoning: z.string().min(20).max(3000),
});

export type AnalysisAnswer = z.infer<typeof AnalysisAnswerSchema>;

export type ParcelInput = {
  address: string | null;
  postal_code: string | null;
  municipality: string | null;
  canton: string | null;
  parcel_number: string | null;
  area_size: number | null;
};

export type DocumentInput = {
  kind: "bzr" | "bzo" | "zonenplan" | "other";
  file_name: string;
  excerpt: string;
};

const SYSTEM_PROMPT = [
  "Du bist ein Experte für Schweizer Bau- und Zonenrecht.",
  "Antworte ausschliesslich auf Deutsch (Schweizer Hochdeutsch, kein ß).",
  "Antworte ausschliesslich als gültiges JSON gemäss vorgegebenem Schema — keinen Fliesstext ausserhalb.",
  "Wenn Werte aus den Dokumenten nicht klar hervorgehen, formuliere plausible Annahmen für eine typische Wohnzone und kennzeichne Unsicherheiten im Feld 'reasoning'.",
].join(" ");

function buildUserPrompt(parcel: ParcelInput, docs: DocumentInput[]): string {
  const docBlock = docs.length
    ? docs
        .map((d) => `--- ${d.kind.toUpperCase()} — ${d.file_name} ---\n${d.excerpt}`)
        .join("\n\n")
    : "Keine Dokumente verfügbar. Bitte plausible Annahmen treffen.";

  return [
    "Beantworte für das folgende Schweizer Grundstück präzise:",
    "1. Was darf gebaut werden? (allowed_use)",
    "2. Welche Nutzungsarten sind zulässig? (in allowed_use erwähnen)",
    "3. Wie viele Vollgeschosse sind erlaubt? (max_floors als Zahl/Bereich, z. B. \"3\" oder \"3-4\")",
    "4. Welche maximale Gebäudehöhe ist zulässig? (max_height inkl. Einheit, z. B. \"12 m\")",
    "5. Welche Einschränkungen bestehen? (restrictions als Stichpunkt-Array)",
    "6. Wie hoch ist das Entwicklungspotenzial? (development_potential: low | medium | high | very_high)",
    "Begründe deine Einschätzung kompakt im Feld 'reasoning'.",
    "",
    "Grundstücksdaten:",
    `- Adresse: ${parcel.address ?? "—"}`,
    `- PLZ / Ort: ${[parcel.postal_code, parcel.municipality].filter(Boolean).join(" ") || "—"}`,
    `- Kanton: ${parcel.canton ?? "—"}`,
    `- Parzelle: ${parcel.parcel_number ?? "—"}`,
    `- Fläche: ${parcel.area_size ? `${parcel.area_size} m²` : "unbekannt"}`,
    "",
    "Dokumenteninhalte (BZR / BZO / Zonenplan, gekürzt):",
    docBlock,
  ].join("\n");
}

/**
 * Core AI Analysis Service.
 * Returns a strictly-typed JSON object suitable for direct database storage.
 */
export async function analyseParcel(params: {
  parcel: ParcelInput;
  documents: DocumentInput[];
  apiKey: string;
  model?: string;
}): Promise<AnalysisAnswer> {
  const gateway = createLovableAiGatewayProvider(params.apiKey);
  const { object } = await generateObject({
    model: gateway(params.model ?? "google/gemini-2.5-flash"),
    schema: AnalysisAnswerSchema,
    system: SYSTEM_PROMPT,
    prompt: buildUserPrompt(params.parcel, params.documents),
  });
  return object;
}
