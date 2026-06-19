import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { asRecord, parseJsonObject, readNumber, readString, readStringArray } from "./ai-json.server";

const RunInput = z.object({ scenarioId: z.string().uuid() });

const ScenarioResultSchema = z.object({
  feasibility: z.string().default(""),
  usage_types: z.array(z.string()).default([]),
  max_floors: z.number().default(0),
  max_height_m: z.number().default(0),
  utilization_ratio: z.number().default(0),
  building_coverage_ratio: z.number().nullable().default(null),
  floor_area_m2: z.number().default(0),
  living_area_m2: z.number().default(0),
  commercial_area_m2: z.number().default(0),
  unit_count: z.number().default(0),
  potential_level: z.string().default("medium"),
  ai_summary: z.string().default(""),
  risks: z
    .array(
      z.object({
        category: z.string().default("sonstiges"),
        title: z.string().default("Risiko"),
        description: z.string().default(""),
        severity: z.string().default("medium"),
      }),
    )
    .default([]),
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

function normalizeScenarioResult(value: unknown) {
  const record = asRecord(value);
  const risks = Array.isArray(record.risks) ? record.risks : [];
  return ScenarioResultSchema.parse({
    feasibility: readString(record.feasibility, "Keine eindeutige Machbarkeit ableitbar."),
    usage_types: readStringArray(record.usage_types),
    max_floors: readNumber(record.max_floors),
    max_height_m: readNumber(record.max_height_m),
    utilization_ratio: readNumber(record.utilization_ratio),
    building_coverage_ratio:
      record.building_coverage_ratio == null ? null : readNumber(record.building_coverage_ratio),
    floor_area_m2: readNumber(record.floor_area_m2),
    living_area_m2: readNumber(record.living_area_m2),
    commercial_area_m2: readNumber(record.commercial_area_m2),
    unit_count: readNumber(record.unit_count),
    potential_level: readString(record.potential_level, "medium"),
    ai_summary: readString(record.ai_summary, "Szenario-Auswertung anhand der Wissensdatenbank."),
    risks: risks.map((r) => {
      const item = asRecord(r);
      return {
        category: readString(item.category, "sonstiges"),
        title: readString(item.title, "Risiko"),
        description: readString(item.description),
        severity: readString(item.severity, "medium"),
      };
    }),
  });
}

export const runScenarioAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RunInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: scenario, error: scErr } = await supabase
      .from("analysis_scenarios")
      .select("id, analysis_id, label, usage_assumption")
      .eq("id", data.scenarioId)
      .maybeSingle();
    if (scErr) throw new Error(scErr.message);
    if (!scenario) throw new Error("Szenario nicht gefunden");

    const { data: analysis, error: aErr } = await supabase
      .from("analyses")
      .select(
        "address, postal_code, municipality, canton, parcel_number, area_size, zone, building_coverage_ratio",
      )
      .eq("id", scenario.analysis_id)
      .maybeSingle();
    if (aErr) throw new Error(aErr.message);
    if (!analysis) throw new Error("Zugehörige Analyse nicht gefunden");

    await supabase
      .from("analysis_scenarios")
      .update({ status: "processing", error_message: null })
      .eq("id", scenario.id);

    try {
      let muniQuery = supabase
        .from("municipalities")
        .select("id, name, canton:cantons!inner(code, name)")
        .ilike("name", (analysis.municipality ?? "").trim());
      if (analysis.canton) muniQuery = muniQuery.eq("cantons.code", analysis.canton);
      const { data: munis } = await muniQuery.limit(1);
      const muni = munis?.[0];

      if (!muni) {
        const msg = `Für die Gemeinde "${analysis.municipality ?? "?"}" sind keine Reglemente hinterlegt.`;
        await supabase
          .from("analysis_scenarios")
          .update({ status: "failed", error_message: msg })
          .eq("id", scenario.id);
        return { ok: false as const, message: msg };
      }

      const [{ data: entries }, { data: rules }, { data: docs }] = await Promise.all([
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
          .select("id, title")
          .eq("municipality_id", muni.id)
          .eq("active", true),
      ]);

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
        "Du bist Experte für Schweizer Bau- und Zonenrecht. Werte EIN konkretes Nutzungsszenario für ein Grundstück aus, AUSSCHLIESSLICH auf Basis der hinterlegten Wissensdatenbank.",
        "Antworte auf Deutsch (Schweizer Hochdeutsch, kein ß). Verwende KEINE Annahmen ausserhalb der Daten — wenn etwas fehlt, sage es explizit.",
        "",
        "Grundstück:",
        `- Adresse: ${analysis.address ?? "—"}`,
        `- PLZ / Ort: ${[analysis.postal_code, analysis.municipality].filter(Boolean).join(" ") || "—"}`,
        `- Kanton: ${cantonCode ?? analysis.canton ?? "—"}`,
        `- Parzelle: ${analysis.parcel_number ?? "—"}`,
        `- Fläche: ${analysis.area_size ? `${analysis.area_size} m²` : "unbekannt"}`,
        `- Bereits bekannte Zone: ${analysis.zone ?? "noch nicht ermittelt"}`,
        "",
        "ZU PRÜFENDES SZENARIO (massgeblich für diese Auswertung):",
        `"${scenario.label}" — ${scenario.usage_assumption}`,
        "",
        "Wissensdatenbank — Knowledge Entries:",
        entryBlock || "(keine Einträge)",
        "",
        "Wissensdatenbank — Regelungen:",
        ruleBlock || "(keine Regeln)",
        "",
        "Beantworte SPEZIFISCH für das oben genannte Szenario:",
        "1) Ist dieses Nutzungsszenario in der geltenden Zone überhaupt zulässig? (feasibility)",
        "2) Welche Geschossfläche, Wohnfläche und Gewerbefläche (commercial_area_m2) ergeben sich realistisch?",
        "3) Wie viele Wohneinheiten sind plausibel (≈ 90 m² Wohnfläche / Einheit, ggf. anpassen falls Wissensdatenbank andere Hinweise gibt)?",
        "4) Entwicklungspotenzial dieses spezifischen Szenarios (potential_level).",
        "5) Szenario-spezifische Risiken (z. B. Mindestwohnanteil verletzt, Gewerbeanteil zu hoch für die Zone).",
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
  "usage_types": ["string"],
  "max_floors": 0,
  "max_height_m": 0,
  "utilization_ratio": 0,
  "building_coverage_ratio": null,
  "floor_area_m2": 0,
  "living_area_m2": 0,
  "commercial_area_m2": 0,
  "unit_count": 0,
  "potential_level": "low | medium | high | very_high",
  "ai_summary": "string",
  "risks": [{ "category": "sonstiges", "title": "string", "description": "string", "severity": "low | medium | high" }]
}`,
        maxOutputTokens: 6000,
      });

      let parsedResult: unknown = {};
      try {
        parsedResult = parseJsonObject(result.text);
      } catch (e) {
        console.warn("[scenario-analysis] AI JSON parse failed", e);
      }
      const object = normalizeScenarioResult(parsedResult);

      const { error: updErr } = await supabase
        .from("analysis_scenarios")
        .update({
          status: "completed",
          error_message: null,
          zone: analysis.zone,
          usage_types: object.usage_types,
          max_floors: clamp(Math.round(object.max_floors), 0, 50),
          max_height: clamp(object.max_height_m, 0, 300),
          utilization_ratio: clamp(object.utilization_ratio, 0, 10),
          building_coverage_ratio: object.building_coverage_ratio,
          floor_area: clamp(object.floor_area_m2, 0, 1_000_000),
          living_area: clamp(object.living_area_m2, 0, 1_000_000),
          commercial_area: clamp(object.commercial_area_m2, 0, 1_000_000),
          unit_count: clamp(Math.round(object.unit_count), 0, 10_000),
          potential_level: normalizePotential(object.potential_level),
          ai_summary: object.ai_summary,
          feasibility: object.feasibility,
          risks: object.risks.map((r) => ({ ...r, severity: normalizeSeverity(r.severity) })),
          ai_answer: object,
        })
        .eq("id", scenario.id);
      if (updErr) throw new Error(updErr.message);

      return { ok: true as const, scenarioId: scenario.id };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unbekannter Fehler";
      await supabase
        .from("analysis_scenarios")
        .update({ status: "failed", error_message: message })
        .eq("id", scenario.id);
      throw new Error(message);
    }
  });

const CreateInput = z.object({
  analysisId: z.string().uuid(),
  organizationId: z.string().uuid(),
  label: z.string().trim().min(1).max(120),
  usageAssumption: z.string().trim().min(1).max(1000),
});

export const createScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: created, error } = await supabase
      .from("analysis_scenarios")
      .insert({
        analysis_id: data.analysisId,
        organization_id: data.organizationId,
        label: data.label,
        usage_assumption: data.usageAssumption,
        status: "draft",
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { scenarioId: created.id };
  });
