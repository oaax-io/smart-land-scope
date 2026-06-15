import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { asRecord, parseJsonObject, readBoolean, readNullableString, readNumber, readString, readStringArray } from "./ai-json.server";

const InputSchema = z.object({ analysisId: z.string().uuid() });

type AnalysisObject = {
  feasibility: string;
  zone: string;
  usage_types: string[];
  max_floors: number;
  max_height_m: number;
  utilization_ratio: number;
  building_coverage_ratio: number | null;
  setbacks: Record<string, unknown> | null;
  special_provisions: string | null;
  design_plan_required: boolean | null;
  heritage_protected: boolean | null;
  noise_zone: string | null;
  water_setbacks: string | null;
  floor_area_m2: number;
  living_area_m2: number;
  unit_count: number;
  potential_level: "low" | "medium" | "high" | "very_high";
  ai_summary: string;
  regulations: string[];
  risks: Array<{ category: string; title: string; description: string; severity: "low" | "medium" | "high" }>;
};

const MAX_DOC_CHARS = 12000;
const MAX_TOTAL_CHARS = 40000;

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(n) ? n : 0));

function normalizePotential(value: unknown): AnalysisObject["potential_level"] {
  const text = readString(value, "medium").toLowerCase();
  if (text.includes("very") || text.includes("sehr")) return "very_high";
  if (text.includes("high") || text.includes("hoch")) return "high";
  if (text.includes("low") || text.includes("gering") || text.includes("niedrig")) return "low";
  return "medium";
}

function normalizeSeverity(value: unknown): "low" | "medium" | "high" {
  const text = readString(value, "medium").toLowerCase();
  if (text.includes("high") || text.includes("hoch")) return "high";
  if (text.includes("low") || text.includes("gering") || text.includes("niedrig")) return "low";
  return "medium";
}

function normalizeAnalysisObject(value: unknown, areaSize: number | null): AnalysisObject {
  const record = asRecord(value);
  const livingArea = clamp(readNumber(record.living_area_m2, 0), 0, 1_000_000);
  const floorArea = clamp(readNumber(record.floor_area_m2, livingArea), 0, 1_000_000);
  const fallbackUnits = livingArea > 0 ? Math.round(livingArea / 90) : 0;
  const risks = Array.isArray(record.risks) ? record.risks : [];

  return {
    feasibility: readString(record.feasibility, "Auf Basis der verfügbaren Reglemente konnte eine erste Machbarkeit erstellt werden."),
    zone: readString(record.zone, "Unbekannt"),
    usage_types: readStringArray(record.usage_types),
    max_floors: clamp(readNumber(record.max_floors), 0, 50),
    max_height_m: clamp(readNumber(record.max_height_m), 0, 300),
    utilization_ratio: clamp(readNumber(record.utilization_ratio), 0, 10),
    building_coverage_ratio: record.building_coverage_ratio == null ? null : clamp(readNumber(record.building_coverage_ratio), 0, 5),
    setbacks: record.setbacks && typeof record.setbacks === "object" && !Array.isArray(record.setbacks)
      ? asRecord(record.setbacks)
      : null,
    special_provisions: readNullableString(record.special_provisions),
    design_plan_required: readBoolean(record.design_plan_required),
    heritage_protected: readBoolean(record.heritage_protected),
    noise_zone: readNullableString(record.noise_zone),
    water_setbacks: readNullableString(record.water_setbacks),
    floor_area_m2: floorArea || clamp((areaSize ?? 0) * readNumber(record.utilization_ratio), 0, 1_000_000),
    living_area_m2: livingArea,
    unit_count: clamp(Math.round(readNumber(record.unit_count, fallbackUnits)), 0, 10_000),
    potential_level: normalizePotential(record.potential_level),
    ai_summary: readString(record.ai_summary, "Zusammenfassung anhand der vorhandenen Reglemente."),
    regulations: readStringArray(record.regulations),
    risks: risks.map((risk) => {
      const item = asRecord(risk);
      return {
        category: readString(item.category, "sonstiges"),
        title: readString(item.title, "Risiko"),
        description: readString(item.description),
        severity: normalizeSeverity(item.severity),
      };
    }),
  };
}

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
