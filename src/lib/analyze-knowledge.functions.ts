import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
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

const SetbacksSchema = z.object({
  nord: z.number().nullable().default(null),
  ost: z.number().nullable().default(null),
  sued: z.number().nullable().default(null),
  west: z.number().nullable().default(null),
  notes: z.string().nullable().default(null),
});

const KnowledgeAnalysisSchema = z.object({
  feasibility: z.string().default(""),
  zone: z.string().default(""),
  usage_types: z.array(z.string()).default([]),
  max_floors: z.number().default(0),
  max_height_m: z.number().default(0),
  utilization_ratio: z.number().default(0),
  building_coverage_ratio: z.number().nullable().default(null),
  setbacks: SetbacksSchema.nullable().default(null),
  special_provisions: z.string().nullable().default(null),
  noise_zone: z.string().nullable().default(null),
  water_setbacks: z.string().nullable().default(null),
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
    building_coverage_ratio: record.building_coverage_ratio == null ? null : clamp(readNumber(record.building_coverage_ratio), 0, 5),
    setbacks: record.setbacks && typeof record.setbacks === "object" && !Array.isArray(record.setbacks)
      ? {
          nord: readNumber(asRecord(record.setbacks).nord) || null,
          ost: readNumber(asRecord(record.setbacks).ost) || null,
          sued: readNumber(asRecord(record.setbacks).sued) || null,
          west: readNumber(asRecord(record.setbacks).west) || null,
          notes: readString(asRecord(record.setbacks).notes) || null,
        }
      : null,
    special_provisions: readString(record.special_provisions) || null,
    noise_zone: readString(record.noise_zone) || null,
    water_setbacks: readString(record.water_setbacks) || null,
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
        "id, address, postal_code, municipality, canton, parcel_number, area_size, detected_zone, zone_override, lat, lng, building_coverage_ratio, max_height, max_floors, utilization_ratio, noise_zone, detected_zone_precise, detected_zone_source, regulation_basis, special_provisions",
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

      // 2b) LU-spezifisch: rechtsverbindliche Zonenplandaten vom Kanton Luzern laden
      let luZoneInfo: string | null = null;
      let luPatch: Record<string, unknown> = {};
      let luEffectiveZone: string | null = null;
      let luEffectiveHeight: number | null = null;
      if (analysis.canton === "LU" && analysis.lat != null && analysis.lng != null) {
        try {
          const { queryLuZonePlan } = await import("@/lib/swiss-geo");
          const zone = await queryLuZonePlan(analysis.lat as number, analysis.lng as number);
          if (zone) {
            luEffectiveHeight = zone.heightMax ?? zone.facadeHeightMax;
            luZoneInfo = [
              `RECHTSVERBINDLICHE ZONENPLANDATEN (Kanton Luzern, ZPGNDNTZ, Quelle: public.geo.lu.ch):`,
              `Zone: ${[zone.zoneCode, zone.zoneLabel].filter(Boolean).join(" — ")}`,
              zone.az != null ? `Ausnützungsziffer (AZ): ${zone.az}` : null,
              zone.uezMax != null ? `Überbauungsziffer (ÜZ) max.: ${zone.uezMax}` : null,
              zone.floors != null ? `Geschosszahl: ${zone.floors}` : null,
              zone.heightMax != null ? `Gesamthöhe max.: ${zone.heightMax} m` : null,
              zone.facadeHeightMax != null ? `Fassadenhöhe max.: ${zone.facadeHeightMax} m` : null,
              zone.buildingLength != null ? `Gebäudelänge max.: ${zone.buildingLength} m` : null,
              zone.greenAreaRatio != null ? `Grünflächenziffer: ${zone.greenAreaRatio}` : null,
              zone.noiseClass ? `Lärmempfindlichkeitsstufe: ${zone.noiseClass}` : null,
              zone.buildingType ? `Bauweise: ${zone.buildingType}` : null,
              zone.residentialShareMax != null ? `Wohnanteil max.: ${Math.round(zone.residentialShareMax * 100)}%` : null,
              zone.commercialShareMax != null ? `Gewerbeanteil max.: ${Math.round(zone.commercialShareMax * 100)}%` : null,
              zone.bzrArticle ? `BZR-Artikel: Art. ${zone.bzrArticle}` : null,
            ].filter(Boolean).join("\n");

            // WICHTIG: Nur nicht-null Werte patchen, damit KI-Werte
            // in Zonen ohne AZ (z.B. Neu-PBG-Zentrumszonen) nicht
            // durch leere Zonenplan-Felder überschrieben werden.
            const patch: Record<string, unknown> = {};
            const zoneName = zone.zoneCode ?? zone.zoneMunicipalityLabel ?? zone.zoneLabel;
            luEffectiveZone = zoneName ?? null;
            if (zoneName != null) patch.zone = zoneName;
            if (zone.zoneMunicipalityLabel != null) patch.detected_zone_precise = zone.zoneMunicipalityLabel;
            patch.detected_zone_source = "Amtlicher Zonenplan Kanton Luzern";
            patch.regulation_basis = "Amtlicher Zonenplan Kanton Luzern (ZPGNDNTZ) / Bau- und Zonenreglement Luzern";
            if (zone.az != null) patch.utilization_ratio = zone.az;
            if (zone.uezMax != null) patch.building_coverage_ratio = zone.uezMax;
            if (zone.floors != null) patch.max_floors = zone.floors;
            if (luEffectiveHeight != null) patch.max_height = luEffectiveHeight;
            if (zone.noiseClass != null) patch.noise_zone = zone.noiseClass;
            const specialParts = [
              zone.bzrArticle ? `BZR Art. ${zone.bzrArticle}` : null,
              zone.bzrFurther,
              zone.buildingType ? `Bauweise: ${zone.buildingType}` : null,
              zone.facadeHeightMax ? `Max. Fassadenhöhe: ${zone.facadeHeightMax} m` : null,
              zone.buildingLength ? `Max. Gebäudelänge: ${zone.buildingLength} m` : null,
              zone.greenAreaRatio ? `Grünflächenziffer: ${zone.greenAreaRatio}` : null,
              ...zone.overlays.map((o) => `Überlagerung: ${o.label}`),
            ].filter(Boolean).join(" | ");
            if (specialParts) patch.special_provisions = specialParts;
            luPatch = patch;
            if (Object.keys(patch).length > 0) {
              await supabase.from("analyses").update(patch as never).eq("id", analysis.id);
            }
          }
        } catch {
          luZoneInfo = null;
        }
      }

      // 2c) Community-Beiträge zu Grenzabständen / Parkierung für diese Zone
      let communityZoneInfo: string | null = null;
      try {
        const currentZone =
          (analysis.zone_override ?? "").trim() ||
          // luZoneInfo may have set analysis.zone; re-fetch minimal
          (
            await supabase
              .from("analyses")
              .select("zone")
              .eq("id", analysis.id)
              .maybeSingle()
          ).data?.zone ||
          null;
        if (currentZone) {
          const { data: zr } = await supabase
            .from("zone_regulations")
            .select(
              "setback_small_m, setback_large_m, setback_building_m, setback_road_main_m, setback_road_local_m, parking_rate, attic_counted, basement_counted, source_article, verified",
            )
            .eq("municipality_id", muni.id)
            .eq("zone_code", currentZone)
            .order("verified", { ascending: false })
            .limit(1);
          const r = zr?.[0];
          if (r) {
            communityZoneInfo = [
              `Bekannte Grenzabstände (aus Gemeinschaft-Datenbank${r.verified ? ", geprüft" : ", nicht geprüft"}):`,
              r.setback_small_m != null ? `Kleiner Grenzabstand: ${r.setback_small_m} m` : null,
              r.setback_large_m != null ? `Grosser Grenzabstand: ${r.setback_large_m} m` : null,
              r.setback_building_m != null ? `Gebäudeabstand: ${r.setback_building_m} m` : null,
              r.setback_road_main_m != null ? `Strassenabstand (Haupt): ${r.setback_road_main_m} m` : null,
              r.setback_road_local_m != null ? `Strassenabstand (lokal): ${r.setback_road_local_m} m` : null,
              r.parking_rate ? `Parkierung: ${r.parking_rate}` : null,
              r.attic_counted != null ? `Dachgeschoss anrechenbar: ${r.attic_counted ? "ja" : "nein"}` : null,
              r.basement_counted != null ? `Untergeschoss anrechenbar: ${r.basement_counted ? "ja" : "nein"}` : null,
              r.source_article ? `Quelle: ${r.source_article}` : null,
            ].filter(Boolean).join("\n");
          }
        }
      } catch {
        communityZoneInfo = null;
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

      // Zone aus der Wissensdatenbank priorisieren (präziser als swisstopo-Bundes-Layer).
      const zoneEntries = (entries ?? []).filter((e) => e.category === "Zone");
      const dbZones = zoneEntries.map((e) => ({
        code: e.key,
        label: e.value ?? e.key,
        article: e.source_article,
      }));

      const manualZone = analysis.zone_override?.trim() || null;
      const swisstopoZone = analysis.detected_zone?.trim() || null;

      const zoneHintLine = manualZone
        ? `- Bauzone (manuell vom Benutzer ausgewählt): "${manualZone}" — verbindlich. Verwende exakt diesen Code im 'zone'-Feld.`
        : dbZones.length > 0
          ? `- Bauzone: ordne das Grundstück einer der unten aufgeführten bekannten Bauzonen der Gemeinde zu (DB-first). Der swisstopo-Bundes-Layer ist zu grob und nur als Hinweis zu verwenden${swisstopoZone ? ` (Layer-Hinweis: "${swisstopoZone}")` : ""}.`
          : swisstopoZone
            ? `- Bauzone (Hinweis aus swisstopo-Bundes-Layer): "${swisstopoZone}" — die Wissensdatenbank enthält keine Zonen-Liste für diese Gemeinde, verwende den Hinweis nur als Orientierung.`
            : "- Bauzone: nicht eindeutig erkannt — wähle die plausibelste dokumentierte Wohn-/Mischzone und vermerke die Unsicherheit.";

      const zoneHint =
        dbZones.length > 0
          ? `\nBekannte Bauzonen dieser Gemeinde laut BZR (${muni.name}):\n${dbZones
              .map((z) => `- ${z.code}: ${z.label}${z.article ? ` (Art. ${z.article})` : ""}`)
              .join("\n")}\n\nBitte ordne das Grundstück (Adresse: ${analysis.address ?? "—"}, PLZ: ${analysis.postal_code ?? "—"}) einer dieser Zonen zu. Wähle die plausibelste Zone basierend auf Adresse, Lage und dem Nutzungscharakter der Umgebung (z.B. Wohnstrasse → Wohnzone, Industriegebiet → Arbeitszone). Verwende IMMER einen der oben aufgeführten Zonen-Codes als 'zone'-Wert. Vermerke die Unsicherheit im 'feasibility'-Text, falls keine eindeutige Zuordnung möglich ist.`
          : "";

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
        zoneHintLine,
        "",
        ...(luZoneInfo ? [luZoneInfo, ""] : []),
        ...(communityZoneInfo ? [communityZoneInfo, ""] : []),

        "Wissensdatenbank — Knowledge Entries:",
        entryBlock || "(keine Einträge)",
        zoneHint,
        "",
        "Wissensdatenbank — Regelungen:",
        ruleBlock || "(keine Regeln)",
        "",
        "Beantworte:",
        "1) Was darf gebaut werden? (feasibility, allowed_use in usage_types).",
        luZoneInfo
          ? `2) Die Zone und Kennzahlen sind bereits aus dem rechtsverbindlichen Zonenplan LU ermittelt (siehe oben). Verwende EXAKT diese Werte für 'zone' (ZONTYP_ABK), 'utilization_ratio' (AZ), 'max_floors' (Geschosszahl) und 'max_height_m' (Gesamthöhe max.). Erstelle die Machbarkeitsbeurteilung auf Basis dieser verbindlichen Werte.`
          : `2) Ordne das Grundstück einer der oben aufgeführten bekannten Bauzonen zu (falls verfügbar). Verwende zwingend den exakten Zonen-Code aus der Liste (z.B. "W-B", "WO3", "ZP1"). Liefere für diese Zone die konkreten Werte aus der Wissensdatenbank: 'zone' (Code), 'utilization_ratio' (AZ oder ÜZ), 'max_floors' (Vollgeschosse), 'max_height_m'. Lass diese Felder NIEMALS auf 0 / leer wenn die Wissensdatenbank entsprechende Zonenwerte enthält.`,

        "3) Berechne das Wohnungspotenzial konkret:",
        "   - floor_area_m2 = Grundstücksfläche × utilization_ratio (falls beide Werte verfügbar)",
        "   - living_area_m2 = floor_area_m2 × 0.8 (Nettowohnfläche-Faktor)",
        "   - unit_count = round(living_area_m2 / 90)  (Annahme 90 m² pro Wohnung)",
        "   Liefere diese Zahlen immer, sobald Fläche und AZ bekannt sind.",
        "4) Wie hoch ist das Entwicklungspotenzial? (potential_level)",
        "5) Welche Risiken bestehen? (risks)",
        "6) Überbauungsziffer / Grundflächenziffer (building_coverage_ratio), falls in den Daten vorhanden.",
        "7) Grenzabstände in Metern nach Himmelsrichtung, soweit ermittelbar (setbacks: nord/ost/sued/west). Wenn die Gemeinde keine richtungsspezifischen Angaben macht, sondern nur einen einheitlichen 'kleinen' und 'grossen' Grenzabstand, trage den kleinen Grenzabstand in alle vier Richtungen ein und vermerke das in setbacks.notes.",
        "8) Sondervorschriften (special_provisions), z. B. Gestaltungsplanpflicht, Ensembleschutz, besondere Bauweisen.",
        "9) Lärmempfindlichkeitsstufe (noise_zone), z. B. 'ES II' oder 'ES III', falls angegeben.",
        "10) Gewässerabstand (water_setbacks) in Metern oder als Text, falls relevant/angegeben.",
        "Wenn ein Wert in der Wissensdatenbank nicht vorkommt, gib null zurück statt zu schätzen — NICHT erfinden.",
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
  "building_coverage_ratio": null,
  "setbacks": { "nord": null, "ost": null, "sued": null, "west": null, "notes": null },
  "special_provisions": null,
  "noise_zone": null,
  "water_setbacks": null,
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
      if (luPatch.zone != null) object.zone = String(luPatch.zone);
      if (typeof luPatch.utilization_ratio === "number") object.utilization_ratio = luPatch.utilization_ratio;
      if (typeof luPatch.building_coverage_ratio === "number") object.building_coverage_ratio = luPatch.building_coverage_ratio;
      if (typeof luPatch.max_floors === "number") object.max_floors = luPatch.max_floors;
      if (luEffectiveHeight != null) object.max_height_m = luEffectiveHeight;
      if (typeof luPatch.noise_zone === "string") object.noise_zone = luPatch.noise_zone;
      if (typeof luPatch.special_provisions === "string") object.special_provisions = luPatch.special_provisions;

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
          zone: luEffectiveZone ?? object.zone,
          usage_type: object.usage_types,
          max_floors: clamp(Math.round(object.max_floors), 0, 50),
          max_height: clamp(object.max_height_m, 0, 300),
          utilization_ratio: clamp(object.utilization_ratio, 0, 10),
          building_coverage_ratio: object.building_coverage_ratio,
          setbacks: object.setbacks as Json | null,
          special_provisions: object.special_provisions,
          noise_zone: object.noise_zone,
          water_setbacks: object.water_setbacks,
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

      // (Rechtsstand-Vergleich Alt vs. Neu entfernt — durch WFS-Zonenplan-Live-Daten ersetzt.)


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
