import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateObject } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const InputSchema = z.object({ analysisId: z.string().uuid() });

const RiskSchema = z.object({
  category: z.enum([
    "baurecht",
    "sondervorschrift",
    "denkmalschutz",
    "abstand",
    "laerm",
    "gewaesser",
    "wald",
    "sonstiges",
  ]),
  title: z.string().min(2).max(120),
  description: z.string().min(2).max(600),
  severity: z.enum(["low", "medium", "high"]),
});

const AnalysisOutputSchema = z.object({
  feasibility: z.string().min(20).max(1500),
  zone: z.string().min(1).max(100),
  usage_types: z.array(z.string().min(1).max(80)).min(1).max(8),
  max_floors: z.number().int().min(0).max(20),
  max_height_m: z.number().min(0).max(120),
  utilization_ratio: z.number().min(0).max(5),
  floor_area_m2: z.number().min(0).max(100000),
  living_area_m2: z.number().min(0).max(100000),
  unit_count: z.number().int().min(0).max(2000),
  potential_level: z.enum(["low", "medium", "high", "very_high"]),
  ai_summary: z.string().min(20).max(2000),
  regulations: z.array(z.string().min(2).max(300)).min(1).max(12),
  risks: z.array(RiskSchema).min(0).max(15),
});

export const runAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: analysis, error: fetchErr } = await supabase
      .from("analyses")
      .select(
        "id, organization_id, address, postal_code, municipality, canton, parcel_number, area_size, document_path, document_name",
      )
      .eq("id", data.analysisId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!analysis) throw new Error("Analyse nicht gefunden");

    await supabase
      .from("analyses")
      .update({ status: "processing" })
      .eq("id", analysis.id);

    let documentExcerpt = "";
    if (analysis.document_path) {
      const { data: file, error: dlErr } = await supabase.storage
        .from("analysis-documents")
        .download(analysis.document_path);
      if (!dlErr && file) {
        try {
          const text = await file.text();
          documentExcerpt = text.replace(/\s+/g, " ").slice(0, 12000);
        } catch {
          documentExcerpt = "";
        }
      }
    }

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY fehlt");

    const gateway = createLovableAiGatewayProvider(key);

    const prompt = [
      `Du bist ein Experte für Schweizer Bau- und Zonenrecht und erstellst eine kompakte Machbarkeitsanalyse für ein Grundstück.`,
      `Antworte ausschliesslich auf Deutsch (Schweizer Hochdeutsch, keine ß).`,
      ``,
      `Eingabedaten:`,
      `- Adresse: ${analysis.address ?? "—"}`,
      `- PLZ / Ort: ${[analysis.postal_code, analysis.municipality].filter(Boolean).join(" ") || "—"}`,
      `- Kanton: ${analysis.canton ?? "—"}`,
      `- Parzellennummer: ${analysis.parcel_number ?? "—"}`,
      `- Grundstücksfläche: ${analysis.area_size ? `${analysis.area_size} m²` : "unbekannt"}`,
      ``,
      documentExcerpt
        ? `Auszug aus dem hochgeladenen BZR/BZO-Dokument (gekürzt):\n"""\n${documentExcerpt}\n"""`
        : `Es wurde kein BZR/BZO-Dokument hochgeladen. Liefere realistische Annahmen für eine typische Wohnzone in dieser Region und kennzeichne unsichere Werte sprachlich.`,
      ``,
      `Schätze fehlende Werte plausibel auf Basis schweizerischer Standards. Wohnungs­anzahl plausibel aus Wohnfläche ableiten (≈ 90 m² pro Einheit, sofern keine andere Angabe).`,
    ].join("\n");

    const { object } = await generateObject({
      model: gateway("google/gemini-2.5-flash"),
      schema: AnalysisOutputSchema,
      prompt,
    });

    const { error: updErr } = await supabase
      .from("analyses")
      .update({
        status: "completed",
        analyzed_at: new Date().toISOString(),
        feasibility: object.feasibility,
        zone: object.zone,
        usage_type: object.usage_types,
        max_floors: object.max_floors,
        max_height: object.max_height_m,
        utilization_ratio: object.utilization_ratio,
        floor_area: object.floor_area_m2,
        living_area: object.living_area_m2,
        unit_count: object.unit_count,
        potential_level: object.potential_level,
        ai_summary: object.ai_summary,
        restrictions: object.regulations,
        risks: object.risks,
      })
      .eq("id", analysis.id);
    if (updErr) throw new Error(updErr.message);

    return { ok: true, analysisId: analysis.id, by: userId };
  });
