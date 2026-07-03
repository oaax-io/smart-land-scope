import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { queryLuZonePlan } from "@/lib/swiss-geo";
import type { Json } from "@/integrations/supabase/types";

const LuZoneInput = z.object({ analysisId: z.string().uuid() });

/**
 * Lädt rechtsverbindliche Zonenplandaten vom Kanton Luzern für eine bestehende Analyse
 * und schreibt alle ermittelten Werte direkt in die analyses-Zeile.
 */
export const loadLuZonePlanForAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LuZoneInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: analysis, error } = await supabase
      .from("analyses")
      .select("id, lat, lng, canton")
      .eq("id", data.analysisId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!analysis) throw new Error("Analyse nicht gefunden");
    if (analysis.lat == null || analysis.lng == null)
      return { ok: false as const, reason: "no_coordinates" as const };
    if (analysis.canton !== "LU")
      return { ok: false as const, reason: "wrong_canton" as const };

    const zone = await queryLuZonePlan(analysis.lat as number, analysis.lng as number);
    if (!zone) return { ok: false as const, reason: "no_zone_found" as const };

    const specialProvisions = [
      zone.bzrArticle ? `BZR Art. ${zone.bzrArticle}` : null,
      zone.bzrFurther,
      zone.buildingType ? `Bauweise: ${zone.buildingType}` : null,
      zone.buildingLength ? `Max. Gebäudelänge: ${zone.buildingLength} m` : null,
      zone.greenAreaRatio ? `Grünflächenziffer: ${zone.greenAreaRatio}` : null,
      zone.residentialShareMax != null
        ? `Wohnanteil max.: ${Math.round(zone.residentialShareMax * 100)}%`
        : null,
      zone.commercialShareMax != null
        ? `Gewerbeanteil max.: ${Math.round(zone.commercialShareMax * 100)}%`
        : null,
    ]
      .filter(Boolean)
      .join(" | ") || null;

    const { error: updateErr } = await supabase
      .from("analyses")
      .update({
        zone: zone.zoneCode ?? zone.zoneLabel,
        utilization_ratio: zone.az,
        building_coverage_ratio: zone.uezMax,
        max_floors: zone.floors,
        max_height: zone.heightMax,
        noise_zone: zone.noiseClass,
        special_provisions: specialProvisions,
        parcel_geometry: (zone.geometry as unknown as Json | null) ?? undefined,
      })
      .eq("id", data.analysisId);
    if (updateErr) throw new Error(updateErr.message);

    return { ok: true as const, zone };
  });
