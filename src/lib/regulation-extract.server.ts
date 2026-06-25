/**
 * Server-only core of the regulation extraction pipeline.
 *
 * This file is named *.server.ts so the bundler blocks it from any client
 * import. The createServerFn wrapper in regulation-extract.functions.ts and
 * the LU cron tick endpoint both call runExtraction() from here.
 */

import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const ZoneSchema = z.object({
  code: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  usage_category: z.string().nullable().optional(),
  allowed_uses: z.array(z.string()).nullable().optional(),
  max_floors: z.number().nullable().optional(),
  max_height_m: z.number().nullable().optional(),
  utilization_ratio: z.number().nullable().optional(),
  building_coverage_ratio: z.number().nullable().optional(),
  setback_small_m: z.number().nullable().optional(),
  setback_large_m: z.number().nullable().optional(),
  noise_sensitivity: z.string().nullable().optional(),
  article_reference: z.string().nullable().optional(),
});

const ExtractionSchema = z.object({
  zones: z.array(ZoneSchema).nullable().optional(),
  utilization_ratio: z.number().nullable().optional(),
  building_coverage_ratio: z.number().nullable().optional(),
  max_floors: z.number().nullable().optional(),
  max_height_m: z.number().nullable().optional(),
  setback_small_m: z.number().nullable().optional(),
  setback_large_m: z.number().nullable().optional(),
  setback_water_m: z.number().nullable().optional(),
  special_provisions: z.string().nullable().optional(),
  design_plan_required: z.boolean().nullable().optional(),
  heritage_protected: z.boolean().nullable().optional(),
  water_protection: z.string().nullable().optional(),
  noise_provisions: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  fallback: z.boolean().optional(),
});

type Zone = z.infer<typeof ZoneSchema>;
type Extraction = z.infer<typeof ExtractionSchema>;

const SYSTEM_PROMPT = `Du bist Experte für Schweizer Bau- und Zonenrecht (BZR, BZO, Zonenpläne, Gestaltungspläne, Sondervorschriften).
Analysiere das beigefügte Reglementdokument und extrahiere ALLE darin definierten Nutzungszonen mit ihren Bauvorschriften strukturiert.

WICHTIG zu Schweizer Reglementen:
- Zonen werden im Reglement-Text definiert (z. B. "Wohnzone (WO)", "Arbeitszone (AR)", "Wohn- und Arbeitszone (WA)").
- Die Dichtebestimmungen (Geschosszahl, Gebäudehöhe, Ausnützungs-/Überbauungsziffer, Grenzabstände) stehen oft im ANHANG, häufig pro Ordnungsnummer/Zonenbezeichnung in Tabellenform.
- Liste JEDE Zone separat auf, auch wenn dieselbe Grundzone (z. B. WO) mit verschiedenen Ordnungsnummern (WO2, WO3, WO4) erscheint — dann erzeuge pro Variante einen Eintrag mit Code z. B. "WO3" und den jeweiligen Werten.
- Setze für jeden Wert, der im Dokument steht, den entsprechenden Zahlenwert. Setze nur dann null, wenn der Wert WIRKLICH nicht aus dem Dokument hervorgeht. Erfinde keine Zahlen.

Zonen-Kategorien (usage_category):
- "wohnen" für reine Wohnzonen (WO, W2, W3, …)
- "gewerbe" für Arbeits-/Gewerbe-/Industriezonen (AR, GE, IN, …)
- "misch" für Wohn- und Arbeitszonen / Kernzonen (WA, K, ZP, …)
- "oeffentlich" für Zonen für öffentliche Zwecke, Sport/Freizeit, Allmend
- "landwirtschaft" für Landwirtschaftszonen
- "sonstige" für Schutz-, Tourismus-, Sonderzonen

Antworte ausschliesslich im vorgegebenen JSON-Format.`;

async function loadDocumentAsBase64(filePath: string, fileName?: string | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.storage
    .from("regulation-documents")
    .download(filePath);
  if (error || !data) throw new Error(`Download fehlgeschlagen: ${error?.message ?? "leer"}`);
  const buf = Buffer.from(await data.arrayBuffer());
  const ext = (fileName ?? filePath).toLowerCase().split(".").pop() ?? "";
  let mime = data.type || "";
  if (!mime || mime === "application/octet-stream") {
    if (ext === "md" || ext === "markdown") mime = "text/markdown";
    else if (ext === "txt") mime = "text/plain";
    else if (ext === "pdf") mime = "application/pdf";
    else mime = "application/pdf";
  }
  const isText = mime.startsWith("text/");
  return {
    base64: buf.toString("base64"),
    mime,
    isText,
    text: isText ? buf.toString("utf-8") : null,
  };
}

export async function runExtraction(params: { documentId: string; force?: boolean }) {
  const { documentId, force } = params;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: doc, error: docErr } = await supabaseAdmin
    .from("regulation_documents")
    .select("id, file_path, file_name, doc_type, title, municipality_id")
    .eq("id", documentId)
    .maybeSingle();
  if (docErr || !doc) throw new Error("Dokument nicht gefunden");

  const { data: existing } = await supabaseAdmin
    .from("regulation_extractions")
    .select("id, status, zones, raw_extraction")
    .eq("document_id", doc.id)
    .maybeSingle();
  const existingRaw = existing?.raw_extraction as { fallback?: boolean } | null | undefined;
  if (
    !force &&
    existing?.status === "completed" &&
    Array.isArray(existing.zones) &&
    (existing.zones as unknown[]).length > 0 &&
    existingRaw?.fallback !== true
  ) {
    const { count, error: countErr } = await supabaseAdmin
      .from("knowledge_entries")
      .select("id", { count: "exact", head: true })
      .eq("source_document", doc.id);
    if (countErr) throw countErr;

    if ((count ?? 0) > 0) {
      return { skipped: true, rebuilt: false, extractionId: existing.id };
    }

    const storedExtraction = normalizeExtraction(
      extractionFromStored(existing.raw_extraction, existing.zones),
    );
    await buildKnowledgeBase({
      municipalityId: doc.municipality_id,
      documentId: doc.id,
      extraction: storedExtraction,
    });
    return { skipped: false, rebuilt: true, extractionId: existing.id };
  }

  const { data: extr, error: upErr } = await supabaseAdmin
    .from("regulation_extractions")
    .upsert(
      { document_id: doc.id, status: "processing", error_message: null },
      { onConflict: "document_id" },
    )
    .select("id")
    .single();
  if (upErr) throw upErr;

  try {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const { base64, mime, isText, text } = await loadDocumentAsBase64(doc.file_path, doc.file_name);
    const gateway = createLovableAiGatewayProvider(apiKey);

    const userInstruction = `Dokumenttyp: ${doc.doc_type}
Titel: ${doc.title}

Lies das gesamte Reglement INKLUSIVE Anhang/Tabellen.
Extrahiere ALLE Nutzungszonen mit ihren spezifischen Bauvorschriften.

Antworte AUSSCHLIESSLICH mit reinem JSON in genau dieser Form (keine Markdown-Fences):
{
  "zones": [
    {
      "code": "WO3",
      "name": "Wohnzone 3",
      "description": "kurzer Text",
      "usage_category": "wohnen" | "gewerbe" | "misch" | "oeffentlich" | "landwirtschaft" | "sonstige",
      "allowed_uses": ["Wohnen"],
      "max_floors": 3,
      "max_height_m": 10.5,
      "utilization_ratio": 0.6,
      "building_coverage_ratio": 0.35,
      "setback_small_m": 3.5,
      "setback_large_m": 7,
      "noise_sensitivity": "II",
      "article_reference": "Art. 12 / Anhang 1"
    }
  ],
  "special_provisions": "string oder null",
  "design_plan_required": true | false | null,
  "heritage_protected": true | false | null,
  "water_protection": "string oder null",
  "noise_provisions": "string oder null",
  "summary": "kurze Gesamtzusammenfassung"
}

Nicht im Dokument vorhandene Werte: setze null. KEINE Werte erfinden.`;

    const userContent = isText && text
      ? [
          { type: "text" as const, text: userInstruction },
          { type: "text" as const, text: `\n\n=== DOKUMENTINHALT (${mime}) ===\n${text}` },
        ]
      : [
          { type: "text" as const, text: userInstruction },
          { type: "file" as const, data: base64, mediaType: mime || "application/pdf" },
        ];

    const messages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      { role: "user" as const, content: userContent },
    ];

    let object: Extraction | null = null;
    const models = ["google/gemini-2.5-pro", "google/gemini-2.5-flash"] as const;
    for (const modelId of models) {
      try {
        const r = await generateText({
          model: gateway(modelId),
          messages,
          maxOutputTokens: 16000,
        });
        const parsed = parseExtractionJson(r.text);
        if (parsed && (parsed.zones?.length ?? 0) > 0) {
          object = parsed;
          break;
        }
        console.warn(`[extract] ${modelId} returned no zones, trying next model`);
      } catch (err) {
        console.warn(`[extract] ${modelId} failed:`, err);
      }
    }
    if (!object) {
      console.warn("[extract] all models failed, using fallback");
      object = createFallbackExtraction(doc.title, doc.file_name ?? null);
    }

    object = normalizeExtraction(object);

    const { error: saveErr } = await supabaseAdmin
      .from("regulation_extractions")
      .update({
        status: "completed",
        error_message: null,
        processed_at: new Date().toISOString(),
        zones: object.zones ?? [],
        residential_zones: (object.zones ?? []).filter((z) => z.usage_category === "wohnen"),
        commercial_zones: (object.zones ?? []).filter((z) => z.usage_category === "gewerbe"),
        mixed_zones: (object.zones ?? []).filter((z) => z.usage_category === "misch"),
        utilization_ratio: object.utilization_ratio ?? null,
        building_coverage_ratio: object.building_coverage_ratio ?? null,
        max_floors: object.max_floors != null ? Math.round(object.max_floors) : null,
        max_height_m: object.max_height_m ?? null,
        setbacks: {
          klein: object.setback_small_m ?? null,
          gross: object.setback_large_m ?? null,
          gewaesser: object.setback_water_m ?? null,
        },
        special_provisions: object.special_provisions ?? null,
        design_plan_required: object.design_plan_required ?? null,
        heritage_protected: object.heritage_protected ?? null,
        water_protection: object.water_protection ?? null,
        noise_provisions: object.noise_provisions ?? null,
        raw_extraction: object,
      })
      .eq("id", extr.id);
    if (saveErr) throw saveErr;

    await buildKnowledgeBase({
      municipalityId: doc.municipality_id,
      documentId: doc.id,
      extraction: object,
    });

    return { skipped: false, rebuilt: false, extractionId: extr.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabaseAdmin
      .from("regulation_extractions")
      .update({ status: "failed", error_message: message })
      .eq("id", extr.id);
    throw new Error(message);
  }
}

function parseExtractionJson(raw: string): Extraction | null {
  if (!raw) return null;
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  let candidate = s.slice(first, last + 1);

  const tryParse = (txt: string): unknown | null => {
    try { return JSON.parse(txt); } catch { return null; }
  };

  let obj = tryParse(candidate);
  if (!obj) { candidate = candidate.replace(/,\s*([}\]])/g, "$1"); obj = tryParse(candidate); }
  if (!obj) { candidate = candidate.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ""); obj = tryParse(candidate); }
  if (!obj) return null;

  const result = ExtractionSchema.safeParse(obj);
  if (result.success) return result.data;

  const loose = obj as Record<string, unknown>;
  const zonesIn = Array.isArray(loose.zones) ? (loose.zones as Record<string, unknown>[]) : [];
  const zones = zonesIn.map((z) => ({
    code: typeof z.code === "string" ? z.code : null,
    name: typeof z.name === "string" ? z.name : null,
    description: typeof z.description === "string" ? z.description : null,
    usage_category: typeof z.usage_category === "string" ? z.usage_category : null,
    allowed_uses: Array.isArray(z.allowed_uses)
      ? (z.allowed_uses as unknown[]).filter((u): u is string => typeof u === "string")
      : null,
    max_floors: typeof z.max_floors === "number" ? z.max_floors : null,
    max_height_m: typeof z.max_height_m === "number" ? z.max_height_m : null,
    utilization_ratio: typeof z.utilization_ratio === "number" ? z.utilization_ratio : null,
    building_coverage_ratio: typeof z.building_coverage_ratio === "number" ? z.building_coverage_ratio : null,
    setback_small_m: typeof z.setback_small_m === "number" ? z.setback_small_m : null,
    setback_large_m: typeof z.setback_large_m === "number" ? z.setback_large_m : null,
    noise_sensitivity: typeof z.noise_sensitivity === "string" ? z.noise_sensitivity : null,
    article_reference: typeof z.article_reference === "string" ? z.article_reference : null,
  }));
  return {
    zones,
    special_provisions: typeof loose.special_provisions === "string" ? loose.special_provisions : null,
    design_plan_required: typeof loose.design_plan_required === "boolean" ? loose.design_plan_required : null,
    heritage_protected: typeof loose.heritage_protected === "boolean" ? loose.heritage_protected : null,
    water_protection: typeof loose.water_protection === "string" ? loose.water_protection : null,
    noise_provisions: typeof loose.noise_provisions === "string" ? loose.noise_provisions : null,
    summary: typeof loose.summary === "string" ? loose.summary : null,
  };
}

function normalizeExtraction(extraction: Extraction): Extraction {
  const zones = (extraction.zones ?? [])
    .filter((zone) => zone && (zone.code?.trim() || zone.name?.trim()))
    .map((zone) => ({
      ...zone,
      code: zone.code?.trim() || zone.name?.trim() || null,
      name: zone.name?.trim() || zone.code?.trim() || "Zone",
      usage_category: zone.usage_category?.trim() || "sonstige",
      allowed_uses: Array.isArray(zone.allowed_uses)
        ? zone.allowed_uses.filter((use) => typeof use === "string" && use.trim()).map((u) => u.trim())
        : [],
      article_reference: zone.article_reference?.trim() || null,
    }));
  return { ...extraction, zones };
}

function extractionFromStored(raw: unknown, zones: unknown): Extraction {
  if (raw) {
    try {
      const parsed = parseExtractionJson(JSON.stringify(raw));
      if (parsed && (parsed.zones?.length ?? 0) > 0) return parsed;
    } catch { /* fallthrough */ }
  }
  return {
    zones: Array.isArray(zones)
      ? zones
          .filter((z): z is Record<string, unknown> => !!z && typeof z === "object")
          .map((z) => ({
            code: asString(z.code),
            name: asString(z.name),
            description: asString(z.description),
            usage_category: asString(z.usage_category),
            allowed_uses: Array.isArray(z.allowed_uses)
              ? z.allowed_uses.filter((u): u is string => typeof u === "string")
              : [],
            max_floors: asNumber(z.max_floors),
            max_height_m: asNumber(z.max_height_m),
            utilization_ratio: asNumber(z.utilization_ratio),
            building_coverage_ratio: asNumber(z.building_coverage_ratio),
            setback_small_m: asNumber(z.setback_small_m),
            setback_large_m: asNumber(z.setback_large_m),
            noise_sensitivity: asString(z.noise_sensitivity),
            article_reference: asString(z.article_reference),
          }))
      : [],
  };
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace("'", "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function createFallbackExtraction(title: string, fileName: string | null): Extraction {
  const label = title || fileName || "Reglement";
  return {
    zones: [
      {
        code: "DOKUMENT",
        name: label,
        description:
          "Das Dokument wurde gespeichert, aber die automatische Tabellen-Extraktion konnte kein valides Schema erzeugen. Bitte Werte im Wiki manuell prüfen oder später erneut analysieren.",
        usage_category: "sonstige",
        allowed_uses: ["Reglement als Quelle verfügbar"],
        article_reference: "Dokument",
      },
    ],
    special_provisions:
      "Automatische Extraktion ist fehlgeschlagen; das Dokument bleibt als Quelle erfasst und kann in der Wissensdatenbank nachbearbeitet werden.",
    design_plan_required: null,
    heritage_protected: null,
    water_protection: null,
    noise_provisions: null,
    summary: `Fallback-Eintrag für ${label}: Upload gespeichert, strukturierte KI-Extraktion konnte nicht validiert werden.`,
    fallback: true,
  };
}

async function buildKnowledgeBase(params: {
  municipalityId: string;
  documentId: string;
  extraction: Extraction;
}) {
  const { municipalityId, documentId, extraction } = params;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const entries: Array<{
    municipality_id: string;
    category: string;
    key: string;
    value: string;
    source_document: string;
    source_article: string | null;
  }> = [];
  const rules: Array<{
    municipality_id: string;
    zone: string | null;
    rule_type: string;
    title: string;
    description: string | null;
    source_document: string;
    article_reference: string | null;
  }> = [];

  const addEntry = (
    category: string,
    key: string,
    value: string | number | null | undefined,
    article: string | null = null,
  ) => {
    if (value == null || String(value).trim() === "") return;
    entries.push({
      municipality_id: municipalityId,
      category,
      key,
      value: String(value),
      source_document: documentId,
      source_article: article,
    });
  };

  const usageLabel = (u?: Zone["usage_category"]) =>
    u === "wohnen" ? "Wohnen"
    : u === "gewerbe" ? "Gewerbe"
    : u === "misch" ? "Wohnen + Gewerbe"
    : u === "oeffentlich" ? "Öffentliche Zwecke"
    : u === "landwirtschaft" ? "Landwirtschaft"
    : "Sonstige";

  for (const z of extraction.zones ?? []) {
    const key = (z.code || z.name || "").trim();
    if (!key) continue;
    const art = z.article_reference ?? null;

    addEntry("Zone", key, [z.name, z.description].filter(Boolean).join(" — "), art);
    addEntry("Nutzung", key, usageLabel(z.usage_category), art);
    if (z.allowed_uses?.length) addEntry("Erlaubte Nutzungen", key, z.allowed_uses.join(", "), art);
    if (z.max_floors != null)
      addEntry("Geschossigkeit", key, `Maximal ${Math.round(z.max_floors)} Vollgeschosse`, art);
    if (z.max_height_m != null) addEntry("Gebäudehöhe", key, `${z.max_height_m} Meter`, art);
    if (z.utilization_ratio != null) addEntry("Ausnützungsziffer", key, z.utilization_ratio, art);
    if (z.building_coverage_ratio != null)
      addEntry("Überbauungsziffer", key, z.building_coverage_ratio, art);
    if (z.setback_small_m != null) addEntry("Grenzabstand klein", key, `${z.setback_small_m} m`, art);
    if (z.setback_large_m != null) addEntry("Grenzabstand gross", key, `${z.setback_large_m} m`, art);
    if (z.noise_sensitivity) addEntry("Lärmempfindlichkeit", key, z.noise_sensitivity, art);

    rules.push({
      municipality_id: municipalityId,
      zone: key,
      rule_type: "Zone",
      title: `${key} — ${z.name}`,
      description: z.description ?? null,
      source_document: documentId,
      article_reference: art,
    });
  }

  const G = "ALLGEMEIN";
  addEntry("Ausnützungsziffer", G, extraction.utilization_ratio);
  addEntry("Überbauungsziffer", G, extraction.building_coverage_ratio);
  addEntry("Geschossigkeit", G,
    extraction.max_floors != null ? `Maximal ${extraction.max_floors} Vollgeschosse` : null);
  addEntry("Gebäudehöhe", G,
    extraction.max_height_m != null ? `${extraction.max_height_m} Meter` : null);
  addEntry("Grenzabstand klein", G,
    extraction.setback_small_m != null ? `${extraction.setback_small_m} m` : null);
  addEntry("Grenzabstand gross", G,
    extraction.setback_large_m != null ? `${extraction.setback_large_m} m` : null);
  addEntry("Gewässerabstand", G,
    extraction.setback_water_m != null ? `${extraction.setback_water_m} m` : null);
  addEntry("Sondervorschriften", G, extraction.special_provisions);
  if (extraction.design_plan_required != null)
    addEntry("Gestaltungsplanpflicht", G, extraction.design_plan_required ? "Ja" : "Nein");
  if (extraction.heritage_protected != null)
    addEntry("Denkmalschutz", G, extraction.heritage_protected ? "Ja" : "Nein");
  addEntry("Gewässerschutz", G, extraction.water_protection);
  addEntry("Lärmvorschriften", G, extraction.noise_provisions);
  addEntry("Zusammenfassung", G, extraction.summary);

  const { error: deleteEntriesErr } = await supabaseAdmin
    .from("knowledge_entries")
    .delete()
    .eq("source_document", documentId);
  if (deleteEntriesErr) throw deleteEntriesErr;

  const uniqueEntries = mergeKnowledgeEntries(entries);
  if (uniqueEntries.length > 0) {
    const { error: insertEntriesErr } = await supabaseAdmin
      .from("knowledge_entries")
      .upsert(
        uniqueEntries.map((entry) => ({ ...entry, updated_at: new Date().toISOString() })),
        { onConflict: "municipality_id,category,key" },
      );
    if (insertEntriesErr) throw insertEntriesErr;
  }

  const { error: deleteRulesErr } = await supabaseAdmin
    .from("regulation_rules")
    .delete()
    .eq("source_document", documentId);
  if (deleteRulesErr) throw deleteRulesErr;

  if (rules.length > 0) {
    const { error: insertRulesErr } = await supabaseAdmin.from("regulation_rules").insert(rules);
    if (insertRulesErr) throw insertRulesErr;
  }
}

function mergeKnowledgeEntries<T extends {
  municipality_id: string;
  category: string;
  key: string;
  value: string;
  source_document: string;
  source_article: string | null;
}>(entries: T[]): T[] {
  const merged = new Map<string, T>();
  for (const entry of entries) {
    const mapKey = `${entry.municipality_id}|${entry.category}|${entry.key}`;
    const existing = merged.get(mapKey);
    if (!existing) { merged.set(mapKey, entry); continue; }
    const values = new Set(
      [existing.value, entry.value]
        .flatMap((value) => value.split(" | "))
        .map((value) => value.trim())
        .filter(Boolean),
    );
    merged.set(mapKey, {
      ...existing,
      value: Array.from(values).join(" | "),
      source_article: existing.source_article ?? entry.source_article,
    });
  }
  return Array.from(merged.values());
}
