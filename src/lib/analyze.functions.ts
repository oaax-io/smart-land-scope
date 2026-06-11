import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateObject } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const InputSchema = z.object({ analysisId: z.string().uuid() });

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
});

const SetbacksSchema = z
  .object({
    nord: z.number().nullable().optional(),
    ost: z.number().nullable().optional(),
    sued: z.number().nullable().optional(),
    west: z.number().nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
  })
  .partial()
  .nullable()
  .optional();

// Loose schema — accept what the model can produce; we clamp/normalize after.
const AnalysisOutputSchema = z.object({
  feasibility: z.string().min(1).max(4000),
  zone: z.string().min(1).max(200),
  usage_types: z.array(z.string().min(1).max(200)).default([]),
  max_floors: z.number().min(0).max(50),
  max_height_m: z.number().min(0).max(300),
  utilization_ratio: z.number().min(0).max(10),
  building_coverage_ratio: z.number().min(0).max(5).nullable().optional(),
  setbacks: SetbacksSchema,
  special_provisions: z.string().max(4000).nullable().optional(),
  design_plan_required: z.boolean().nullable().optional(),
  heritage_protected: z.boolean().nullable().optional(),
  noise_zone: z.string().max(400).nullable().optional(),
  water_setbacks: z.string().max(1000).nullable().optional(),
  floor_area_m2: z.number().min(0).max(1000000),
  living_area_m2: z.number().min(0).max(1000000),
  unit_count: z.number().min(0).max(10000),
  potential_level: z.enum(["low", "medium", "high", "very_high"]).catch("medium"),
  ai_summary: z.string().min(1).max(4000),
  regulations: z.array(z.string().min(1).max(600)).default([]),
  risks: z.array(RiskSchema).default([]),
});

const MAX_DOC_CHARS = 12000;
const MAX_TOTAL_CHARS = 40000;

export const runAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: analysis, error: fetchErr } = await supabase
      .from("analyses")
      .select(
        "id, organization_id, address, postal_code, municipality, canton, parcel_number, area_size",
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
      // Load all documents for this analysis
      const { data: docs } = await supabase
        .from("analysis_documents")
        .select("id, kind, file_name, storage_path")
        .eq("analysis_id", analysis.id)
        .order("created_at", { ascending: true });

      const excerpts: string[] = [];
      let totalChars = 0;
      for (const d of docs ?? []) {
        if (totalChars >= MAX_TOTAL_CHARS) break;
        const { data: file, error: dlErr } = await supabase.storage
          .from("analysis-documents")
          .download(d.storage_path);
        if (dlErr || !file) continue;
        let text = "";
        try {
          text = await file.text();
        } catch {
          text = "";
        }
        text = text.replace(/\s+/g, " ").trim();
        if (!text) continue;
        const remaining = MAX_TOTAL_CHARS - totalChars;
        const slice = text.slice(0, Math.min(MAX_DOC_CHARS, remaining));
        totalChars += slice.length;
        excerpts.push(
          `--- Dokument: ${d.file_name} (${d.kind.toUpperCase()}) ---\n${slice}`,
        );
      }

      const key = process.env.LOVABLE_API_KEY;
      if (!key) throw new Error("LOVABLE_API_KEY fehlt");

      const gateway = createLovableAiGatewayProvider(key);

      const prompt = [
        `Du bist Experte für Schweizer Bau- und Zonenrecht und erstellst eine strukturierte Machbarkeitsanalyse.`,
        `Antworte ausschliesslich auf Deutsch (Schweizer Hochdeutsch, kein ß).`,
        ``,
        `Grundstück:`,
        `- Adresse: ${analysis.address ?? "—"}`,
        `- PLZ / Ort: ${[analysis.postal_code, analysis.municipality].filter(Boolean).join(" ") || "—"}`,
        `- Kanton: ${analysis.canton ?? "—"}`,
        `- Parzelle: ${analysis.parcel_number ?? "—"}`,
        `- Fläche: ${analysis.area_size ? `${analysis.area_size} m²` : "unbekannt"}`,
        ``,
        excerpts.length > 0
          ? `Auszüge aus ${excerpts.length} hochgeladenen Dokumenten (BZR / BZO / Zonenplan):\n"""\n${excerpts.join("\n\n")}\n"""`
          : `Es wurden keine Dokumente hochgeladen. Liefere plausible Annahmen für eine typische Wohnzone in dieser Region und kennzeichne Unsicherheiten sprachlich.`,
        ``,
        `Extrahiere strukturiert: Nutzungszone, Ausnützungsziffer, Überbauungsziffer (building_coverage_ratio), Geschossigkeit, Gebäudehöhe, Grenzabstände, Nutzungs- & Sondervorschriften, Gestaltungsplanpflicht (design_plan_required), Denkmalschutz (heritage_protected), Lärmschutz (noise_zone), Gewässerabstände (water_setbacks).`,
        `Wohnungsanzahl plausibel aus Wohnfläche ableiten (≈ 90 m² pro Einheit).`,
      ].join("\n");

      // 1) Structured extraction (rich schema)
      const { object } = await generateObject({
        model: gateway("google/gemini-2.5-flash"),
        schema: AnalysisOutputSchema,
        prompt,
      });

      // 2) Dedicated AI Analysis Service — strict product JSON
      const { analyseParcel } = await import("./ai-analysis.server");
      const docInputs = (docs ?? []).map((d, i) => ({
        kind: d.kind as "bzr" | "bzo" | "zonenplan" | "other",
        file_name: d.file_name,
        excerpt: excerpts[i]?.split("\n").slice(1).join("\n") ?? "",
      }));
      const aiAnswer = await analyseParcel({
        parcel: {
          address: analysis.address,
          postal_code: analysis.postal_code,
          municipality: analysis.municipality,
          canton: analysis.canton,
          parcel_number: analysis.parcel_number,
          area_size: analysis.area_size,
        },
        documents: docInputs,
        apiKey: key,
      });

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
          building_coverage_ratio: object.building_coverage_ratio ?? null,
          setbacks: object.setbacks ?? null,
          special_provisions: object.special_provisions ?? null,
          design_plan_required: object.design_plan_required ?? null,
          heritage_protected: object.heritage_protected ?? null,
          noise_zone: object.noise_zone ?? null,
          water_setbacks: object.water_setbacks ?? null,
          floor_area: object.floor_area_m2,
          living_area: object.living_area_m2,
          unit_count: Math.round(object.unit_count),
          potential_level: object.potential_level,
          ai_summary: object.ai_summary,
          restrictions: object.regulations,
          risks: object.risks,
          extracted_data: object,
          ai_answer: aiAnswer,
        })
        .eq("id", analysis.id);
      if (updErr) throw new Error(updErr.message);


      return { ok: true, analysisId: analysis.id, by: userId };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unbekannter Fehler";
      await supabase
        .from("analyses")
        .update({ status: "failed", error_message: message })
        .eq("id", analysis.id);
      throw new Error(message);
    }
  });
