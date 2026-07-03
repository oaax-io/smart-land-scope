import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { fetchOEREBTopics, type OEREBTopic } from "@/lib/swiss-geo";

const OEREBInput = z.object({ analysisId: z.string().uuid() });

export type LoadOEREBResult = {
  topics: OEREBTopic[];
  note: string | null;
  hasPlanungszone: boolean;
};


export const loadOEREBData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OEREBInput.parse(d))
  .handler(async ({ data, context }): Promise<LoadOEREBResult> => {
    const { supabase } = context;
    const { data: analysis, error } = await supabase
      .from("analyses")
      .select(
        "id, lat, lng, egrid, municipality, canton, noise_zone, parcel_number, area_size",
      )
      .eq("id", data.analysisId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!analysis) throw new Error("Analyse nicht gefunden");

    const lat = analysis.lat as number | null;
    const lng = analysis.lng as number | null;
    if (lat == null || lng == null) {
      return { topics: [], note: "Keine Koordinaten vorhanden — ÖREB-Abfrage nicht möglich." };
    }

    const topics = await fetchOEREBTopics(lat, lng);

    topics.unshift({
      theme: "Grundstück",
      type: `Parzelle ${analysis.parcel_number ?? "—"} · E-GRID ${analysis.egrid ?? "—"}`,
      coverage: "100%",
      area_m2: typeof analysis.area_size === "number" ? (analysis.area_size as number) : null,
      legal_basis: null,
      authority: `${analysis.municipality ?? ""}${analysis.canton ? ` (${analysis.canton})` : ""}`.trim() || null,
    });

    if (analysis.noise_zone) {
      topics.push({
        theme: "Lärmempfindlichkeitsstufen",
        type: analysis.noise_zone as string,
        coverage: "100%",
        area_m2: typeof analysis.area_size === "number" ? (analysis.area_size as number) : null,
        legal_basis: "LSV (Lärmschutz-Verordnung)",
        authority: `Gemeindeverwaltung ${analysis.municipality ?? ""}`.trim(),
      });
    }

    return { topics, note: null };
  });
