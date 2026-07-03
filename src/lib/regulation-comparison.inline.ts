/**
 * Reine Datenbank-Version des Reglement-Vergleichs (ohne server-fn-Wrapper),
 * damit sie aus dem Analyse-Prozess ohne Auth-Middleware aufgerufen werden kann.
 * Gleiche Logik wie regulation-comparison.functions.ts.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const NUMERIC_KEYS = new Set(["utilization_ratio", "building_coverage_ratio", "max_floors", "max_height_m"]);

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

type ZoneRow = {
  zone: string;
  values: Record<string, string | number | null>;
  rules: Array<{ rule_type: string; title: string; description: string | null; article: string | null }>;
  source_document_title: string | null;
};

function normalizeKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function collectZones(
  entries: Array<{ category: string | null; key: string | null; value: string | null; source_document?: string | null }>,
  rules: Array<{ zone: string | null; rule_type: string; title: string; description: string | null; article_reference: string | null; source_document?: string | null }>,
  docTitleById: Map<string, string>,
): Record<string, ZoneRow> {
  const byZone: Record<string, ZoneRow> = {};
  for (const e of entries) {
    if (!e.key || !e.category) continue;
    let zone: string | null = null;
    let field: string | null = null;
    if (e.category === "Zone") { zone = e.key; field = "nutzung"; }
    else if (e.key.includes(".")) { const [z, f] = e.key.split(".", 2); zone = z; field = normalizeKey(f); }
    else { zone = "_allgemein"; field = normalizeKey(e.key); }
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
    row.rules.push({ rule_type: r.rule_type, title: r.title, description: r.description, article: r.article_reference });
    if (r.source_document && !row.source_document_title) {
      row.source_document_title = docTitleById.get(r.source_document) ?? null;
    }
  }
  return byZone;
}

export async function buildComparisonInline(supabase: SupabaseClient, analysisId: string): Promise<void> {
  const { data: analysis } = await supabase
    .from("analyses")
    .select("id, municipality, canton")
    .eq("id", analysisId)
    .maybeSingle();
  if (!analysis) return;

  let muniQ = supabase
    .from("municipalities")
    .select("id, name, cantons!inner(code)")
    .ilike("name", (analysis.municipality ?? "").trim());
  if (analysis.canton) muniQ = muniQ.eq("cantons.code", analysis.canton);
  const { data: munis } = await muniQ.limit(1);
  const muni = munis?.[0];
  if (!muni) return;

  const { data: activeDocs } = await supabase
    .from("regulation_documents")
    .select("id, title, version, valid_from")
    .eq("municipality_id", muni.id)
    .eq("active", true);
  const activeIds = (activeDocs ?? []).map((d) => d.id);
  const docTitleById = new Map<string, string>((activeDocs ?? []).map((d) => [d.id, d.title]));
  const idFilter = activeIds.length ? activeIds : ["00000000-0000-0000-0000-000000000000"];

  const [{ data: entries }, { data: rules }] = await Promise.all([
    supabase.from("knowledge_entries").select("category, key, value, source_document").eq("municipality_id", muni.id).in("source_document", idFilter),
    supabase.from("regulation_rules").select("zone, rule_type, title, description, article_reference, source_document").eq("municipality_id", muni.id).in("source_document", idFilter),
  ]);
  const currentZones = collectZones(entries ?? [], rules ?? [], docTitleById);

  const { data: snapshots } = await supabase
    .from("regulation_snapshots")
    .select("document_title, document_version, document_valid_from, archived_at, knowledge_entries, regulation_rules")
    .eq("municipality_id", muni.id)
    .order("archived_at", { ascending: false })
    .limit(1);
  const snap = snapshots?.[0] ?? null;

  let previous: {
    document: { title: string | null; version: string | null; valid_from: string | null; archived_at: string } | null;
    zones: Record<string, ZoneRow>;
  } | null = null;
  if (snap) {
    const prevZones = collectZones((snap.knowledge_entries as never[]) ?? [], (snap.regulation_rules as never[]) ?? [], new Map());
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

  const diffs: Array<{ zone: string; key: string; label: string; previous: string | number | null; current: string | number | null }> = [];
  if (previous) {
    const zones = new Set([...Object.keys(currentZones), ...Object.keys(previous.zones)]);
    for (const zone of zones) {
      const cur = currentZones[zone]?.values ?? {};
      const prev = previous.zones[zone]?.values ?? {};
      const fields = new Set([...Object.keys(cur), ...Object.keys(prev)]);
      for (const key of fields) {
        const a = prev[key] ?? null;
        const b = cur[key] ?? null;
        if (a !== b) diffs.push({ zone, key, label: FIELD_LABELS[key] ?? key, previous: a, current: b });
      }
    }
  }

  const payload = {
    current: {
      documents: (activeDocs ?? []).map((d) => ({ id: d.id, title: d.title, version: d.version, valid_from: d.valid_from })),
      zones: currentZones,
    },
    previous,
    differences: diffs,
    generated_at: new Date().toISOString(),
  };

  await supabase
    .from("analyses")
    .update({ regulation_comparison: payload as never })
    .eq("id", analysisId);
}
