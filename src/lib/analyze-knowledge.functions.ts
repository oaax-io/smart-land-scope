import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateObject } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

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
      // @ts-expect-error supabase join typing
      cantonCode: muni.canton?.code as string | undefined,
      // @ts-expect-error supabase join typing
      cantonName: muni.canton?.name as string | undefined,
      entryCount: entryCount ?? 0,
      ruleCount: ruleCount ?? 0,
      documentCount: docCount ?? 0,
    };
  });

// ============================================================================
// Knowledge-base–driven analysis
// ============================================================================

const RunInput = z.object({ analysisId: z.string().uuid() });

const SourceRefSchema = z.object({
  document: z.string().max(200).nullable().optional(),
  article: z.string().max(100).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  key: z.string().max(100).nullable().optional(),
});

const RiskSchema = z.object({
  category: z
    .enum([
      "baurecht",
      "sondervorschrift",
      "denkmalschutz",
      "abstand",
      "laerm",
      "gewaesser",
      "wald",
      "sonstiges",
    ])
    .catch("sonstiges"),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  severity: z.enum(["low", "medium", "high"]).catch("medium"),
  sources: z.array(SourceRefSchema).max(10).default([]),
});

const KnowledgeAnalysisSchema = z.object({
  feasibility: z.string().min(1).max(4000),
  zone: z.string().min(1).max(200),
  usage_types: z.array(z.string().min(1).max(200)).default([]),
  max_floors: z.number().min(0).max(50),
  max_height_m: z.number().min(0).max(300),
  utilization_ratio: z.number().min(0).max(10),
  floor_area_m2: z.number().min(0).max(1000000),
  living_area_m2: z.number().min(0).max(1000000),
  unit_count: z.number().min(0).max(10000),
  potential_level: z.enum(["low", "medium", "high", "very_high"]).catch("medium"),
  ai_summary: z.string().min(1).max(4000),
  regulations: z.array(z.string().min(1).max(600)).default([]),
  risks: z.array(RiskSchema).default([]),
  sources: z.array(SourceRefSchema).max(50).default([]),
});

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

      // @ts-expect-error supabase join typing
      const cantonCode = muni.canton?.code as string | undefined;

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
        "1) Was darf gebaut werden? (feasibility, allowed_use in usage_types)",
        "2) Wie viele Wohnungen könnten entstehen? (unit_count plausibel aus Wohnfläche, ≈ 90 m² / Einheit)",
        "3) Wie hoch ist das Entwicklungspotenzial? (potential_level)",
        "4) Welche Risiken bestehen? (risks)",
        "Liste in 'sources' alle verwendeten Einträge mit Dokument-Titel und Artikel-Referenz.",
      ].join("\n");

      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) throw new Error("LOVABLE_API_KEY fehlt");
      const gateway = createLovableAiGatewayProvider(apiKey);

      const { object } = await generateObject({
        model: gateway("google/gemini-2.5-flash"),
        schema: KnowledgeAnalysisSchema,
        prompt,
      });

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
          max_floors: Math.round(object.max_floors),
          max_height: object.max_height_m,
          utilization_ratio: object.utilization_ratio,
          floor_area: object.floor_area_m2,
          living_area: object.living_area_m2,
          unit_count: Math.round(object.unit_count),
          potential_level: object.potential_level,
          ai_summary: object.ai_summary,
          restrictions: object.regulations,
          risks: object.risks,
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
