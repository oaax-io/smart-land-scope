import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { asRecord, parseJsonObject, readNumber, readString, readStringArray } from "./ai-json.server";

// ============================================================================
// Coverage check — does the knowledge base contain this municipality?
// ============================================================================

const CoverageInput = z.object({
  municipality: z.string().trim().min(1).max(100),
  canton: z.string().trim().length(2).optional(),
});

export const checkMunicipalityCoverage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CoverageInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const norm = data.municipality.trim();

    // Case-insensitive match; restrict by canton when supplied
    let query = supabase
      .from("municipalities")
      .select("id, name, canton:cantons!inner(id, code, name)")
      .ilike("name", norm);
    if (data.canton) query = query.eq("cantons.code", data.canton);
    const { data: munis, error } = await query.limit(1);
    if (error) throw new Error(error.message);
    const muni = munis?.[0];
    if (!muni) return { exists: false as const };

    const [{ count: entryCount }, { count: ruleCount }, { count: docCount }] =
      await Promise.all([
        supabase
          .from("knowledge_entries")
          .select("id", { count: "exact", head: true })
          .eq("municipality_id", muni.id),
        supabase
          .from("regulation_rules")
          .select("id", { count: "exact", head: true })
          .eq("municipality_id", muni.id),
        supabase
          .from("regulation_documents")
          .select("id", { count: "exact", head: true })
          .eq("municipality_id", muni.id)
          .eq("active", true),
      ]);

    const ready = (entryCount ?? 0) > 0 || (ruleCount ?? 0) > 0;
    return {
      exists: true as const,
      ready,
      municipalityId: muni.id,
      municipalityName: muni.name,
      cantonCode: (muni.canton as unknown as { code?: string } | null)?.code,
      cantonName: (muni.canton as unknown as { name?: string } | null)?.name,
      entryCount: entryCount ?? 0,
      ruleCount: ruleCount ?? 0,
      documentCount: docCount ?? 0,
    };
  });

// ============================================================================
// Knowledge-base–driven analysis
// ============================================================================

const RunInput = z.object({ analysisId: z.string().uuid() });

const SourceRefSchema = z
  .object({
    document: z.string().nullable().optional(),
    article: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    key: z.string().nullable().optional(),
  })
  .partial();

const RiskSchema = z.object({
  category: z.string().default("sonstiges"),
  title: z.string().default("Risiko"),
  description: z.string().default(""),
  severity: z.string().default("medium"),
  sources: z.array(SourceRefSchema).default([]).optional(),
});

const KnowledgeAnalysisSchema = z.object({
  feasibility: z.string().default(""),
  zone: z.string().default(""),
  usage_types: z.array(z.string()).default([]),
  max_floors: z.number().default(0),
  max_height_m: z.number().default(0),
  utilization_ratio: z.number().default(0),
  floor_area_m2: z.number().default(0),
  living_area_m2: z.number().default(0),
  unit_count: z.number().default(0),
  potential_level: z.string().default("medium"),
  ai_summary: z.string().default(""),
  regulations: z.array(z.string()).default([]),
  risks: z.array(RiskSchema).default([]),
  sources: z.array(SourceRefSchema).default([]),
});

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(n) ? n : 0));
const normalizePotential = (v: string): "low" | "medium" | "high" | "very_high" => {
  const s = (v ?? "").toLowerCase();
  if (s.includes("very") || s.includes("sehr")) return "very_high";
  if (s.includes("high") || s.includes("hoch")) return "high";
  if (s.includes("low") || s.includes("gering") || s.includes("niedrig")) return "low";
  return "medium";
};
const normalizeSeverity = (v: string): "low" | "medium" | "high" => {
  const s = (v ?? "").toLowerCase();
  if (s.includes("high") || s.includes("hoch")) return "high";
  if (s.includes("low") || s.includes("gering") || s.includes("niedrig")) return "low";
  return "medium";
};

function normalizeSourceRefs(value: unknown) {
  const sources = Array.isArray(value) ? value : [];
  return sources.map((source) => {
    const item = asRecord(source);
    return {
      document: readString(item.document) || null,
      article: readString(item.article) || null,
      category: readString(item.category) || null,
      key: readString(item.key) || null,
    };
  });
}

function normalizeKnowledgeAnalysis(value: unknown) {
  const record = asRecord(value);
  const risks = Array.isArray(record.risks) ? record.risks : [];

  return KnowledgeAnalysisSchema.parse({
    feasibility: readString(record.feasibility, "Keine eindeutige Machbarkeit aus den hinterlegten Daten ableitbar."),
    zone: readString(record.zone, "Unbekannt"),
    usage_types: readStringArray(record.usage_types),
    max_floors: readNumber(record.max_floors),
    max_height_m: readNumber(record.max_height_m),
    utilization_ratio: readNumber(record.utilization_ratio),
    floor_area_m2: readNumber(record.floor_area_m2),
    living_area_m2: readNumber(record.living_area_m2),
    unit_count: readNumber(record.unit_count),
    potential_level: readString(record.potential_level, "medium"),
    ai_summary: readString(record.ai_summary, "Analyse anhand der Wissensdatenbank."),
    regulations: readStringArray(record.regulations),
    risks: risks.map((risk) => {
      const item = asRecord(risk);
      return {
        category: readString(item.category, "sonstiges"),
        title: readString(item.title, "Risiko"),
        description: readString(item.description),
        severity: readString(item.severity, "medium"),
        sources: normalizeSourceRefs(item.sources),
      };
    }),
    sources: normalizeSourceRefs(record.sources),
  });
}

export const runKnowledgeAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RunInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: analysis, error: fetchErr } = await supabase
      .from("analyses")
      .select(
        "id, address, postal_code, municipality, canton, parcel_number, area_size",
      )
      .eq("id", data.analysisId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!analysis) throw new Error("Analyse nicht gefunden");

    await supabase
      .from("analyses")
      .update({ status: "processing", error_message: null })
      .eq("id", analysis.id);

    try {
      // 1) Resolve municipality
      let muniQuery = supabase
        .from("municipalities")
        .select("id, name, canton:cantons!inner(code, name)")
        .ilike("name", (analysis.municipality ?? "").trim());
      if (analysis.canton)
        muniQuery = muniQuery.eq("cantons.code", analysis.canton);
      const { data: munis } = await muniQuery.limit(1);
      const muni = munis?.[0];

      if (!muni) {
        const msg = `Für die Gemeinde "${analysis.municipality ?? "?"}" sind noch keine Reglemente hinterlegt.`;
        await supabase
          .from("analyses")
          .update({ status: "failed", error_message: msg })
          .eq("id", analysis.id);
        return { ok: false as const, reason: "no_municipality" as const, message: msg };
      }

      // 2) Load knowledge base for this municipality
      const [
        { data: entries },
        { data: rules },
        { data: docs },
      ] = await Promise.all([
        supabase
          .from("knowledge_entries")
          .select("category, key, value, source_article, source_document")
          .eq("municipality_id", muni.id),
        supabase
          .from("regulation_rules")
          .select("zone, rule_type, title, description, article_reference, source_document")
          .eq("municipality_id", muni.id),
        supabase
          .from("regulation_documents")
          .select("id, title, doc_type, version")
          .eq("municipality_id", muni.id)
          .eq("active", true),
      ]);

      if ((entries?.length ?? 0) === 0 && (rules?.length ?? 0) === 0) {
        const msg = `Für die Gemeinde "${muni.name}" sind noch keine Reglemente hinterlegt.`;
        await supabase
          .from("analyses")
          .update({ status: "failed", error_message: msg })
          .eq("id", analysis.id);
        return { ok: false as const, reason: "no_knowledge" as const, message: msg };
      }

      // 3) Build prompt
      const docMap = new Map((docs ?? []).map((d) => [d.id, d]));
      const docLabel = (id: string | null | undefined) =>
        id ? docMap.get(id)?.title ?? "Reglement" : "—";

      const entryBlock = (entries ?? [])
        .map(
          (e) =>
            `- [${e.category} / ${e.key}] ${e.value ?? ""}  (Quelle: ${docLabel(e.source_document)}${e.source_article ? `, Art. ${e.source_article}` : ""})`,
        )
        .join("\n");
      const ruleBlock = (rules ?? [])
        .map(
          (r) =>
            `- [${r.rule_type}${r.zone ? ` · ${r.zone}` : ""}] ${r.title}${r.description ? ` — ${r.description}` : ""}  (Quelle: ${docLabel(r.source_document)}${r.article_reference ? `, Art. ${r.article_reference}` : ""})`,
        )
        .join("\n");

      const cantonCode = (muni.canton as unknown as { code?: string } | null)?.code;

      const prompt = [
        "Du bist Experte für Schweizer Bau- und Zonenrecht und erstellst eine strukturierte Machbarkeitsanalyse AUSSCHLIESSLICH auf Basis der hinterlegten Wissensdatenbank.",
        "Antworte auf Deutsch (Schweizer Hochdeutsch, kein ß).",
        "Verwende KEINE Annahmen ausserhalb der bereitgestellten Daten. Wenn Werte fehlen, sage es explizit.",
        "",
        "Grundstück:",
        `- Adresse: ${analysis.address ?? "—"}`,
        `- PLZ / Ort: ${[analysis.postal_code, analysis.municipality].filter(Boolean).join(" ") || "—"}`,
        `- Kanton: ${cantonCode ?? analysis.canton ?? "—"}`,
        `- Parzelle: ${analysis.parcel_number ?? "—"}`,
        `- Fläche: ${analysis.area_size ? `${analysis.area_size} m²` : "unbekannt"}`,
        "",
        "Wissensdatenbank — Knowledge Entries:",
        entryBlock || "(keine Einträge)",
        "",
        "Wissensdatenbank — Regelungen:",
        ruleBlock || "(keine Regeln)",
        "",
        "Beantworte:",
        "1) Was darf gebaut werden? (feasibility, allowed_use in usage_types).",
        "2) Bestimme die wahrscheinlichste Bauzone für dieses Grundstück anhand Adresse, PLZ und der Wissensdatenbank. Wenn die exakte Zonenzuteilung nicht eindeutig hervorgeht, wähle die für die Lage plausibelste Wohn- oder Mischzone (z.B. W2, W3, WG3) aus den dokumentierten Zonen und vermerke dies in 'feasibility'. Gib für diese Zone die konkreten Werte aus der Wissensdatenbank an: 'zone', 'utilization_ratio' (AZ), 'max_floors' (Vollgeschosse), 'max_height_m'. Lass diese Felder NIEMALS auf 0 / leer wenn die Wissensdatenbank entsprechende Zonenwerte enthält — wähle dann den plausibelsten Wert und erwähne die Unsicherheit im 'feasibility'-Text.",
        "3) Berechne das Wohnungspotenzial konkret:",
        "   - floor_area_m2 = Grundstücksfläche × utilization_ratio (falls beide Werte verfügbar)",
        "   - living_area_m2 = floor_area_m2 × 0.8 (Nettowohnfläche-Faktor)",
        "   - unit_count = round(living_area_m2 / 90)  (Annahme 90 m² pro Wohnung)",
        "   Liefere diese Zahlen immer, sobald Fläche und AZ bekannt sind.",
        "4) Wie hoch ist das Entwicklungspotenzial? (potential_level)",
        "5) Welche Risiken bestehen? (risks)",
        "Liste in 'sources' alle verwendeten Einträge mit Dokument-Titel und Artikel-Referenz.",
      ].join("\n");

      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) throw new Error("LOVABLE_API_KEY fehlt");
      const gateway = createLovableAiGatewayProvider(apiKey);

      const result = await generateText({
        model: gateway("google/gemini-2.5-flash"),
        prompt: `${prompt}

Antworte ausschliesslich als reines JSON-Objekt ohne Markdown-Fences:
{
  "feasibility": "string",
  "zone": "string",
  "usage_types": ["string"],
  "max_floors": 0,
  "max_height_m": 0,
  "utilization_ratio": 0,
  "floor_area_m2": 0,
  "living_area_m2": 0,
  "unit_count": 0,
  "potential_level": "low | medium | high | very_high",
  "ai_summary": "string",
  "regulations": ["string"],
  "risks": [{ "category": "sonstiges", "title": "string", "description": "string", "severity": "low | medium | high", "sources": [] }],
  "sources": [{ "document": "string", "article": "string", "category": "string", "key": "string" }]
}`,
        maxOutputTokens: 8000,
      });
      let parsedResult: unknown = {};
      try {
        parsedResult = parseJsonObject(result.text);
      } catch (parseError) {
        console.warn("[knowledge-analysis] AI JSON parse failed, using normalized fallback", parseError);
      }
      const object = normalizeKnowledgeAnalysis(parsedResult);

      // Deterministische Fallback-Berechnungen für das Wohnungspotenzial.
      // Auch wenn die KI die Zahlen nicht liefert: sobald wir Fläche + AZ
      // kennen, berechnen wir Geschossfläche / Wohnfläche / Anzahl Wohnungen.
      const parcelArea = Number(analysis.area_size ?? 0) || 0;
      const azForCalc = object.utilization_ratio > 0 ? object.utilization_ratio : 0;
      let floorArea = object.floor_area_m2;
      let livingArea = object.living_area_m2;
      let unitCount = object.unit_count;
      if (parcelArea > 0 && azForCalc > 0) {
        if (!(floorArea > 0)) floorArea = parcelArea * azForCalc;
        if (!(livingArea > 0)) livingArea = floorArea * 0.8;
        if (!(unitCount > 0)) unitCount = Math.round(livingArea / 90);
      }

      // 4) Persist
      const { error: updErr } = await supabase
        .from("analyses")
        .update({
          status: "completed",
          analyzed_at: new Date().toISOString(),
          error_message: null,
          feasibility: object.feasibility,
          zone: object.zone,
          usage_type: object.usage_types,
          max_floors: clamp(Math.round(object.max_floors), 0, 50),
          max_height: clamp(object.max_height_m, 0, 300),
          utilization_ratio: clamp(object.utilization_ratio, 0, 10),
          floor_area: clamp(floorArea, 0, 1_000_000),
          living_area: clamp(livingArea, 0, 1_000_000),
          unit_count: clamp(Math.round(unitCount), 0, 10_000),
          potential_level: normalizePotential(object.potential_level),
          ai_summary: object.ai_summary,
          restrictions: object.regulations,
          risks: object.risks.map((r) => ({ ...r, severity: normalizeSeverity(r.severity) })),
          extracted_data: {
            knowledge_based: true,
            municipality_id: muni.id,
            entry_count: entries?.length ?? 0,
            rule_count: rules?.length ?? 0,
            sources: object.sources,
          },
          ai_answer: object,
        })
        .eq("id", analysis.id);
      if (updErr) throw new Error(updErr.message);

      return { ok: true as const, analysisId: analysis.id };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unbekannter Fehler";
      await supabase
        .from("analyses")
        .update({ status: "failed", error_message: message })
        .eq("id", analysis.id);
      throw new Error(message);
    }
  });
