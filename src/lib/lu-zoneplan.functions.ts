import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { luZonePlanToRegulationRecord, queryLuZonePlan } from "@/lib/swiss-geo";
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
      .select("id, lat, lng, canton, address, municipality, extracted_data")
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

    const effectiveHeight = zone.heightMax;
    const specialProvisions = [
      zone.bzrArticle ? `BZR Art. ${zone.bzrArticle}` : null,
      zone.bzrFurther,
      zone.buildingType ? `Bauweise: ${zone.buildingType}` : null,
      zone.facadeHeightMax ? `Max. Fassadenhöhe: ${zone.facadeHeightMax} m` : null,
      zone.buildingLength ? `Max. Gebäudelänge: ${zone.buildingLength} m` : null,
      zone.buildingWidth ? `Max. Gebäudebreite: ${zone.buildingWidth} m` : null,
      zone.greenAreaRatio ? `Grünflächenziffer: ${zone.greenAreaRatio}` : null,
      zone.residentialShareMax != null
        ? `Wohnanteil max.: ${Math.round(zone.residentialShareMax * 100)}%`
        : null,
      zone.commercialShareMax != null
        ? `Gewerbeanteil max.: ${Math.round(zone.commercialShareMax * 100)}%`
        : null,
      ...zone.overlays.map((o) => `Überlagerung: ${o.label}`),
    ]
      .filter(Boolean)
      .join(" | ") || null;

    // Prägnante Zonenbezeichnung: Gemeinde-Code (z.B. "W3") oder Gemeindetext ("3-geschossige Wohnzone")
    // oder kantonale Bezeichnung ("Wohnzone bis 14m").
    const zoneName =
      zone.zoneCode ??
      zone.zoneMunicipalityLabel ??
      zone.zoneLabel ??
      zone.zoneCategory ??
      null;

    // Nur nicht-null Werte überschreiben, damit KI-Resultate nicht durch
    // leere Zonenplan-Felder überschrieben werden.
    const patch: Record<string, unknown> = {};
    if (zoneName != null) patch.zone = zoneName;
    if (zone.zoneMunicipalityLabel != null) patch.detected_zone_precise = zone.zoneMunicipalityLabel;
    patch.detected_zone_source = "Amtlicher Zonenplan Kanton Luzern";
    patch.regulation_basis = "Amtlicher Zonenplan Kanton Luzern (ZPGNDNTZ) / Bau- und Zonenreglement Luzern";
    patch.utilization_ratio = zone.az;
    patch.building_coverage_ratio = zone.uezMax;
    patch.max_floors = zone.floors;
    patch.max_height = effectiveHeight;
    if (zone.noiseClass != null) patch.noise_zone = zone.noiseClass;
    if (specialProvisions != null) patch.special_provisions = specialProvisions;
    if (zone.geometry != null) patch.parcel_geometry = zone.geometry as unknown as Json;
    const existingExtractedData =
      analysis.extracted_data && typeof analysis.extracted_data === "object" && !Array.isArray(analysis.extracted_data)
        ? (analysis.extracted_data as Record<string, unknown>)
        : {};
    patch.extracted_data = {
      ...existingExtractedData,
      lu_zone_plan: {
        ...luZonePlanToRegulationRecord(zone),
        fetched_at: new Date().toISOString(),
      },
    } satisfies Json;

    // Wenn AZ und ÜZ vom Kanton NICHT geliefert werden (typisch Stadt Luzern),
    // versuchen wir per KI-Vorschlag den zutreffenden BZR-Code (WO18x, WA…) aus
    // den importierten knowledge_entries herzuleiten.
    if (zone.az == null && zone.uezMax == null && analysis.municipality) {
      try {
        const { data: muni } = await supabase
          .from("municipalities")
          .select("id, cantons!inner(code)")
          .ilike("name", analysis.municipality as string)
          .eq("cantons.code", "LU")
          .maybeSingle();
        const municipalityId = (muni as { id?: string } | null)?.id;
        if (municipalityId) {
          const { data: rows } = await supabase
            .from("knowledge_entries")
            .select("category, key, value")
            .eq("municipality_id", municipalityId);
          if (rows && rows.length > 0) {
            const {
              groupKnowledgeIntoCandidates,
              filterCandidatesByWfs,
              suggestBzrCode,
            } = await import("./lu-bzr-suggest.server");
            const grouped = groupKnowledgeIntoCandidates(rows as { category: string; key: string; value: string | null }[]);
            const filtered = filterCandidatesByWfs(grouped, zone.facadeHeightMax, zone.buildingType, zone.zoneCategory);
            const apiKey = process.env.LOVABLE_API_KEY;
            if (apiKey && filtered.length > 0) {
              const suggestion = await suggestBzrCode({
                address: analysis.address as string | null,
                municipality: analysis.municipality as string | null,
                wfsZoneCategory: zone.zoneCategory,
                wfsZoneLabel: zone.zoneLabel,
                wfsFacadeHeightMax: zone.facadeHeightMax,
                wfsBuildingType: zone.buildingType,
                wfsNoiseClass: zone.noiseClass,
                candidates: filtered,
                apiKey,
              });
              if (suggestion) {
                const c = suggestion.candidate;
                if (c.ausnuetzungsziffer != null) patch.utilization_ratio = c.ausnuetzungsziffer;
                if (c.ueberbauungsziffer != null) patch.building_coverage_ratio = c.ueberbauungsziffer;
                if (c.vollgeschosse != null && patch.max_floors == null) patch.max_floors = c.vollgeschosse;
                if (c.gesamthoehe_flach != null && patch.max_height == null) patch.max_height = c.gesamthoehe_flach;
                if (zoneName == null || zoneName === zone.zoneLabel) patch.zone = c.code;
                patch.detected_zone_precise = `${c.code} — ${c.zone ?? zone.zoneMunicipalityLabel ?? ""}`.trim();
                const conf = Math.round(suggestion.confidence * 100);
                const note = `BZR-Zone via KI-Vorschlag: ${c.code} (${conf}% Konfidenz). ${suggestion.reasoning}`.trim();
                patch.special_provisions = patch.special_provisions
                  ? `${patch.special_provisions as string} | ${note}`
                  : note;
                const ed = patch.extracted_data as Record<string, unknown>;
                (ed.lu_zone_plan as Record<string, unknown>).bzr_ai_suggestion = {
                  code: c.code,
                  confidence: suggestion.confidence,
                  reasoning: suggestion.reasoning,
                  candidate: c,
                };
              }
            }
          }
        }
      } catch (e) {
        console.warn("[lu-zoneplan] BZR AI suggestion failed", e);
      }
    }

    if (Object.keys(patch).length > 0) {
      const { error: updateErr } = await supabase
        .from("analyses")
        .update(patch as never)
        .eq("id", data.analysisId);
      if (updateErr) throw new Error(updateErr.message);

    }


    return { ok: true as const, zone };
  });
