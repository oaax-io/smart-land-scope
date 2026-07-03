import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Baut den Alt-/Neu-Reglement-Vergleich für eine Analyse.
 *
 * "Aktuell" = alle knowledge_entries + regulation_rules, deren source_document zu
 * einem aktiven regulation_document der Gemeinde gehört.
 * "Vorher"  = jüngster regulation_snapshots-Eintrag derselben Gemeinde
 * (wird automatisch beim Deaktivieren/Löschen eines Reglements befüllt).
 *
 * Ergebnis wird in analyses.regulation_comparison persistiert.
 */

const Input = z.object({ analysisId: z.string().uuid() });

const NUMERIC_KEYS = new Set([
  "utilization_ratio",
  "building_coverage_ratio",
  "max_floors",
  "max_height_m",
]);

type ZoneRow = {
  zone: string;
  values: Record<string, string | number | null>;
  rules: Array<{ rule_type: string; title: string; description: string | null; article: string | null }>;
  source_document_title: string | null;
};

type ComparisonPayload = {
  current: {
    documents: Array<{ id: string; title: string; version: string | null; valid_from: string | null }>;
    zones: Record<string, ZoneRow>;
  };
  previous: {
    document: { title: string | null; version: string | null; valid_from: string | null; archived_at: string } | null;
    zones: Record<string, ZoneRow>;
  } | null;
  differences: Array<{
    zone: string;
    key: string;
    label: string;
    previous: string | number | null;
    current: string | number | null;
  }>;
  generated_at: string;
};

const FIELD_LABELS: Record<string, string> = {
  utilization_ratio: "Ausnützungsziffer (AZ)",
  building_coverage_ratio: "Überbauungsziffer (ÜZ)",
  max_floors: "Vollgeschosse",
  max_height_m: "Gebäudehöhe (m)",
  gesamthoehe: "Gesamthöhe",
  grenzabstand_klein: "Grenzabstand klein",
  grenzabstand_gross: "Grenzabstand gross",
  gebaeudelaenge: "Gebäudelänge",
  gebaeudetiefe: "Gebäudetiefe",
  laermempfindlichkeitsstufe: "Lärmempfindlichkeit",
  nutzung: "Zulässige Nutzung",
};

function normalizeKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function collectZones(
  entries: Array<{ category: string | null; key: string | null; value: string | null; source_article: string | null; source_document?: string | null }>,
  rules: Array<{ zone: string | null; rule_type: string; title: string; description: string | null; article_reference: string | null; source_document?: string | null }>,
  docTitleById: Map<string, string>,
): Record<string, ZoneRow> {
  const byZone: Record<string, ZoneRow> = {};

  for (const e of entries) {
    if (!e.key || !e.category) continue;
    // Zone-scoped keys are typically stored either as category='Zone' key='<code>'
    // or as category='Kennzahl' with key including the zone code prefix "<zone>.<field>".
    let zone: string | null = null;
    let field: string | null = null;
    if (e.category === "Zone") {
      zone = e.key;
      field = "nutzung";
    } else if (e.key.includes(".")) {
      const [z, f] = e.key.split(".", 2);
      zone = z;
      field = normalizeKey(f);
    } else {
      // ungerichteter Wert -> in Zone "_allgemein" sammeln
      zone = "_allgemein";
      field = normalizeKey(e.key);
    }
    if (!zone || !field) continue;
    const row = (byZone[zone] ??= { zone, values: {}, rules: [], source_document_title: null });
    let value: string | number | null = e.value;
    if (value != null && NUMERIC_KEYS.has(field)) {
      const num = Number(String(value).replace(",", "."));
      if (Number.isFinite(num)) value = num;
    }
    row.values[field] = value;
    if (e.source_document && !row.source_document_title) {
      row.source_document_title = docTitleById.get(e.source_document) ?? null;
    }
  }

  for (const r of rules) {
    const zone = r.zone ?? "_allgemein";
    const row = (byZone[zone] ??= { zone, values: {}, rules: [], source_document_title: null });
    row.rules.push({
      rule_type: r.rule_type,
      title: r.title,
      description: r.description,
      article: r.article_reference,
    });
    if (r.source_document && !row.source_document_title) {
      row.source_document_title = docTitleById.get(r.source_document) ?? null;
    }
  }

  return byZone;
}

export const buildRegulationComparison = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<ComparisonPayload | null> => {
    const { supabase } = context;

    const { data: analysis } = await supabase
      .from("analyses")
      .select("id, municipality, canton, zone, zone_override, detected_zone, detected_zone_precise")
      .eq("id", data.analysisId)
      .maybeSingle();
    if (!analysis) throw new Error("Analyse nicht gefunden");

    let muniQ = supabase
      .from("municipalities")
      .select("id, name, cantons!inner(code)")
      .ilike("name", (analysis.municipality ?? "").trim());
    if (analysis.canton) muniQ = muniQ.eq("cantons.code", analysis.canton);
    const { data: munis } = await muniQ.limit(1);
    const muni = munis?.[0];
    if (!muni) return null;

    // Aktive Reglemente
    const { data: activeDocs } = await supabase
      .from("regulation_documents")
      .select("id, title, version, valid_from")
      .eq("municipality_id", muni.id)
      .eq("active", true);
    const activeIds = (activeDocs ?? []).map((d) => d.id);
    const docTitleById = new Map<string, string>((activeDocs ?? []).map((d) => [d.id, d.title]));

    const [{ data: entries }, { data: rules }] = await Promise.all([
      supabase
        .from("knowledge_entries")
        .select("category, key, value, source_article, source_document")
        .eq("municipality_id", muni.id)
        .in("source_document", activeIds.length ? activeIds : ["00000000-0000-0000-0000-000000000000"]),
      supabase
        .from("regulation_rules")
        .select("zone, rule_type, title, description, article_reference, source_document")
        .eq("municipality_id", muni.id)
        .in("source_document", activeIds.length ? activeIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);

    const currentZones = collectZones(entries ?? [], rules ?? [], docTitleById);

    // Vorherige Fassung: jüngster Snapshot
    const { data: snapshots } = await supabase
      .from("regulation_snapshots")
      .select("document_title, document_version, document_valid_from, archived_at, knowledge_entries, regulation_rules")
      .eq("municipality_id", muni.id)
      .order("archived_at", { ascending: false })
      .limit(1);
    const snap = snapshots?.[0] ?? null;

    let previous: ComparisonPayload["previous"] = null;
    if (snap) {
      const prevZones = collectZones(
        (snap.knowledge_entries as any[]) ?? [],
        (snap.regulation_rules as any[]) ?? [],
        new Map(),
      );
      previous = {
        document: {
          title: snap.document_title,
          version: snap.document_version,
          valid_from: snap.document_valid_from,
          archived_at: snap.archived_at,
        },
        zones: prevZones,
      };
    }

    // Diffs berechnen
    const diffs: ComparisonPayload["differences"] = [];
    if (previous) {
      const zoneCodes = new Set([...Object.keys(currentZones), ...Object.keys(previous.zones)]);
      for (const zone of zoneCodes) {
        const cur = currentZones[zone]?.values ?? {};
        const prev = previous.zones[zone]?.values ?? {};
        const fields = new Set([...Object.keys(cur), ...Object.keys(prev)]);
        for (const key of fields) {
          const a = prev[key] ?? null;
          const b = cur[key] ?? null;
          if (a !== b) {
            diffs.push({
              zone,
              key,
              label: FIELD_LABELS[key] ?? key,
              previous: a,
              current: b,
            });
          }
        }
      }
    }

    const payload: ComparisonPayload = {
      current: {
        documents: (activeDocs ?? []).map((d) => ({
          id: d.id,
          title: d.title,
          version: d.version,
          valid_from: d.valid_from,
        })),
        zones: currentZones,
      },
      previous,
      differences: diffs,
      generated_at: new Date().toISOString(),
    };

    await supabase
      .from("analyses")
      .update({ regulation_comparison: payload as unknown as never })
      .eq("id", analysis.id);

    return payload;
  });
