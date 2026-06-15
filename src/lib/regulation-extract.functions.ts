import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateObject } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const InputSchema = z.object({ documentId: z.string().uuid() });

// Per-zone schema — carries the actual density metrics PER zone (e.g. WO3, WA4).
// Most Swiss BZRs define these per Ordnungsnummer in an appendix, not globally.
const ZoneSchema = z.object({
  code: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  usage_category: z.string().nullable().optional(),
  allowed_uses: z.array(z.string()).nullable().optional(),
  max_floors: z.number().nullable().optional(),
  max_height_m: z.number().nullable().optional(),
  utilization_ratio: z.number().nullable().optional(),
  building_coverage_ratio: z.number().nullable().optional(),
  setback_small_m: z.number().nullable().optional(),
  setback_large_m: z.number().nullable().optional(),
  noise_sensitivity: z.string().nullable().optional(),
  article_reference: z.string().nullable().optional(),
});

const ExtractionSchema = z.object({
  zones: z.array(ZoneSchema).nullable().optional(),
  utilization_ratio: z.number().nullable().optional(),
  building_coverage_ratio: z.number().nullable().optional(),
  max_floors: z.number().nullable().optional(),
  max_height_m: z.number().nullable().optional(),
  setback_small_m: z.number().nullable().optional(),
  setback_large_m: z.number().nullable().optional(),
  setback_water_m: z.number().nullable().optional(),
  special_provisions: z.string().nullable().optional(),
  design_plan_required: z.boolean().nullable().optional(),
  heritage_protected: z.boolean().nullable().optional(),
  water_protection: z.string().nullable().optional(),
  noise_provisions: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  fallback: z.boolean().optional(),
});

const SYSTEM_PROMPT = `Du bist Experte für Schweizer Bau- und Zonenrecht (BZR, BZO, Zonenpläne, Gestaltungspläne, Sondervorschriften).
Analysiere das beigefügte Reglementdokument und extrahiere ALLE darin definierten Nutzungszonen mit ihren Bauvorschriften strukturiert.

WICHTIG zu Schweizer Reglementen:
- Zonen werden im Reglement-Text definiert (z. B. "Wohnzone (WO)", "Arbeitszone (AR)", "Wohn- und Arbeitszone (WA)").
- Die Dichtebestimmungen (Geschosszahl, Gebäudehöhe, Ausnützungs-/Überbauungsziffer, Grenzabstände) stehen oft im ANHANG, häufig pro Ordnungsnummer/Zonenbezeichnung in Tabellenform.
- Liste JEDE Zone separat auf, auch wenn dieselbe Grundzone (z. B. WO) mit verschiedenen Ordnungsnummern (WO2, WO3, WO4) erscheint — dann erzeuge pro Variante einen Eintrag mit Code z. B. "WO3" und den jeweiligen Werten.
- Setze für jeden Wert, der im Dokument steht, den entsprechenden Zahlenwert. Setze nur dann null, wenn der Wert WIRKLICH nicht aus dem Dokument hervorgeht. Erfinde keine Zahlen.

Zonen-Kategorien (usage_category):
- "wohnen" für reine Wohnzonen (WO, W2, W3, …)
- "gewerbe" für Arbeits-/Gewerbe-/Industriezonen (AR, GE, IN, …)
- "misch" für Wohn- und Arbeitszonen / Kernzonen (WA, K, ZP, …)
- "oeffentlich" für Zonen für öffentliche Zwecke, Sport/Freizeit, Allmend
- "landwirtschaft" für Landwirtschaftszonen
- "sonstige" für Schutz-, Tourismus-, Sonderzonen

Antworte ausschliesslich im vorgegebenen JSON-Format.`;

async function loadDocumentAsBase64(filePath: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.storage
    .from("regulation-documents")
    .download(filePath);
  if (error || !data) throw new Error(`Download fehlgeschlagen: ${error?.message ?? "leer"}`);
  const buf = Buffer.from(await data.arrayBuffer());
  return { base64: buf.toString("base64"), mime: data.type || "application/pdf" };
}

export const extractRegulationDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: adminRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRow) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: doc, error: docErr } = await supabaseAdmin
      .from("regulation_documents")
      .select("id, file_path, file_name, doc_type, title, municipality_id")
      .eq("id", data.documentId)
      .maybeSingle();
    if (docErr || !doc) throw new Error("Dokument nicht gefunden");

    // Idempotency: only skip if a previous run produced zones. An empty
    // completed run is treated as redo-able.
    const { data: existing } = await supabaseAdmin
      .from("regulation_extractions")
      .select("id, status, zones, raw_extraction")
      .eq("document_id", doc.id)
      .maybeSingle();
    const existingRaw = existing?.raw_extraction as { fallback?: boolean } | null | undefined;
    if (
      existing?.status === "completed" &&
      Array.isArray(existing.zones) &&
      (existing.zones as unknown[]).length > 0 &&
      existingRaw?.fallback !== true
    ) {
      return { skipped: true, extractionId: existing.id };
    }

    const { data: extr, error: upErr } = await supabaseAdmin
      .from("regulation_extractions")
      .upsert(
        { document_id: doc.id, status: "processing", error_message: null },
        { onConflict: "document_id" },
      )
      .select("id")
      .single();
    if (upErr) throw upErr;

    try {
      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

      const { base64, mime } = await loadDocumentAsBase64(doc.file_path);
      const gateway = createLovableAiGatewayProvider(apiKey);

      const messages = [
        { role: "system" as const, content: SYSTEM_PROMPT },
        {
          role: "user" as const,
          content: [
            {
              type: "text" as const,
              text: `Dokumenttyp: ${doc.doc_type}\nTitel: ${doc.title}\n\nLies das gesamte Dokument inklusive Anhang/Tabellen. Extrahiere ALLE Zonen mit ihren spezifischen Werten (Geschosse, Höhe, AZ, ÜZ, Grenzabstände).`,
            },
            {
              type: "file" as const,
              data: base64,
              mediaType: mime || "application/pdf",
            },
          ],
        },
      ];

      let object: z.infer<typeof ExtractionSchema>;
      try {
        const r = await generateObject({
          model: gateway("google/gemini-2.5-pro"),
          schema: ExtractionSchema,
          messages,
        });
        object = r.object;
      } catch (primaryErr) {
        console.warn("[extract] gemini-2.5-pro structured failed, retrying flash:", primaryErr);
        try {
          const r2 = await generateObject({
            model: gateway("google/gemini-2.5-flash"),
            schema: ExtractionSchema,
            messages,
          });
          object = r2.object;
        } catch (fallbackErr) {
          console.warn(
            "[extract] structured extraction failed completely, using safe fallback:",
            fallbackErr,
          );
          object = createFallbackExtraction(doc.title, doc.file_name ?? null);
        }
      }

      object = normalizeExtraction(object);

      // Persist raw extraction (back-compat: keep legacy columns nullable)
      const { error: saveErr } = await supabaseAdmin
        .from("regulation_extractions")
        .update({
          status: "completed",
          error_message: null,
          processed_at: new Date().toISOString(),
          zones: object.zones ?? [],
          residential_zones: (object.zones ?? []).filter((z) => z.usage_category === "wohnen"),
          commercial_zones: (object.zones ?? []).filter((z) => z.usage_category === "gewerbe"),
          mixed_zones: (object.zones ?? []).filter((z) => z.usage_category === "misch"),
          utilization_ratio: object.utilization_ratio ?? null,
          building_coverage_ratio: object.building_coverage_ratio ?? null,
          max_floors: object.max_floors != null ? Math.round(object.max_floors) : null,
          max_height_m: object.max_height_m ?? null,
          setbacks: {
            klein: object.setback_small_m ?? null,
            gross: object.setback_large_m ?? null,
            gewaesser: object.setback_water_m ?? null,
          },
          special_provisions: object.special_provisions ?? null,
          design_plan_required: object.design_plan_required ?? null,
          heritage_protected: object.heritage_protected ?? null,
          water_protection: object.water_protection ?? null,
          noise_provisions: object.noise_provisions ?? null,
          raw_extraction: object,
        })
        .eq("id", extr.id);
      if (saveErr) throw saveErr;

      await buildKnowledgeBase({
        municipalityId: doc.municipality_id,
        documentId: doc.id,
        extraction: object,
      });

      return { skipped: false, extractionId: extr.id };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await supabaseAdmin
        .from("regulation_extractions")
        .update({ status: "failed", error_message: message })
        .eq("id", extr.id);
      throw new Error(message);
    }
  });

type Zone = z.infer<typeof ZoneSchema>;
type Extraction = z.infer<typeof ExtractionSchema>;

function normalizeExtraction(extraction: Extraction): Extraction {
  const zones = (extraction.zones ?? [])
    .filter((zone) => zone && (zone.code?.trim() || zone.name?.trim()))
    .map((zone) => ({
      ...zone,
      code: zone.code?.trim() || zone.name?.trim() || null,
      name: zone.name?.trim() || zone.code?.trim() || "Zone",
      usage_category: zone.usage_category?.trim() || "sonstige",
      allowed_uses: Array.isArray(zone.allowed_uses)
        ? zone.allowed_uses
            .filter((use) => typeof use === "string" && use.trim())
            .map((use) => use.trim())
        : [],
      article_reference: zone.article_reference?.trim() || null,
    }));

  return { ...extraction, zones };
}

function createFallbackExtraction(title: string, fileName: string | null): Extraction {
  const label = title || fileName || "Reglement";
  return {
    zones: [
      {
        code: "DOKUMENT",
        name: label,
        description:
          "Das Dokument wurde gespeichert, aber die automatische Tabellen-Extraktion konnte kein valides Schema erzeugen. Bitte Werte im Wiki manuell prüfen oder später erneut analysieren.",
        usage_category: "sonstige",
        allowed_uses: ["Reglement als Quelle verfügbar"],
        article_reference: "Dokument",
      },
    ],
    special_provisions:
      "Automatische Extraktion ist fehlgeschlagen; das Dokument bleibt als Quelle erfasst und kann in der Wissensdatenbank nachbearbeitet werden.",
    design_plan_required: null,
    heritage_protected: null,
    water_protection: null,
    noise_provisions: null,
    summary: `Fallback-Eintrag für ${label}: Upload gespeichert, strukturierte KI-Extraktion konnte nicht validiert werden.`,
    fallback: true,
  };
}

async function buildKnowledgeBase(params: {
  municipalityId: string;
  documentId: string;
  extraction: Extraction;
}) {
  const { municipalityId, documentId, extraction } = params;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const entries: Array<{
    municipality_id: string;
    category: string;
    key: string;
    value: string;
    source_document: string;
    source_article: string | null;
  }> = [];
  const rules: Array<{
    municipality_id: string;
    zone: string | null;
    rule_type: string;
    title: string;
    description: string | null;
    source_document: string;
    article_reference: string | null;
  }> = [];

  const addEntry = (
    category: string,
    key: string,
    value: string | number | null | undefined,
    article: string | null = null,
  ) => {
    if (value == null || String(value).trim() === "") return;
    entries.push({
      municipality_id: municipalityId,
      category,
      key,
      value: String(value),
      source_document: documentId,
      source_article: article,
    });
  };

  const usageLabel = (u?: Zone["usage_category"]) =>
    u === "wohnen"
      ? "Wohnen"
      : u === "gewerbe"
        ? "Gewerbe"
        : u === "misch"
          ? "Wohnen + Gewerbe"
          : u === "oeffentlich"
            ? "Öffentliche Zwecke"
            : u === "landwirtschaft"
              ? "Landwirtschaft"
              : "Sonstige";

  for (const z of extraction.zones ?? []) {
    const key = (z.code || z.name || "").trim();
    if (!key) continue;
    const art = z.article_reference ?? null;

    addEntry("Zone", key, [z.name, z.description].filter(Boolean).join(" — "), art);
    addEntry("Nutzung", key, usageLabel(z.usage_category), art);
    if (z.allowed_uses?.length) addEntry("Erlaubte Nutzungen", key, z.allowed_uses.join(", "), art);
    if (z.max_floors != null)
      addEntry("Geschossigkeit", key, `Maximal ${Math.round(z.max_floors)} Vollgeschosse`, art);
    if (z.max_height_m != null) addEntry("Gebäudehöhe", key, `${z.max_height_m} Meter`, art);
    if (z.utilization_ratio != null) addEntry("Ausnützungsziffer", key, z.utilization_ratio, art);
    if (z.building_coverage_ratio != null)
      addEntry("Überbauungsziffer", key, z.building_coverage_ratio, art);
    if (z.setback_small_m != null)
      addEntry("Grenzabstand klein", key, `${z.setback_small_m} m`, art);
    if (z.setback_large_m != null)
      addEntry("Grenzabstand gross", key, `${z.setback_large_m} m`, art);
    if (z.noise_sensitivity) addEntry("Lärmempfindlichkeit", key, z.noise_sensitivity, art);

    rules.push({
      municipality_id: municipalityId,
      zone: key,
      rule_type: "Zone",
      title: `${key} — ${z.name}`,
      description: z.description ?? null,
      source_document: documentId,
      article_reference: art,
    });
  }

  // Global fallbacks (only if no per-zone equivalent)
  const G = "ALLGEMEIN";
  addEntry("Ausnützungsziffer", G, extraction.utilization_ratio);
  addEntry("Überbauungsziffer", G, extraction.building_coverage_ratio);
  addEntry(
    "Geschossigkeit",
    G,
    extraction.max_floors != null ? `Maximal ${extraction.max_floors} Vollgeschosse` : null,
  );
  addEntry(
    "Gebäudehöhe",
    G,
    extraction.max_height_m != null ? `${extraction.max_height_m} Meter` : null,
  );
  addEntry(
    "Grenzabstand klein",
    G,
    extraction.setback_small_m != null ? `${extraction.setback_small_m} m` : null,
  );
  addEntry(
    "Grenzabstand gross",
    G,
    extraction.setback_large_m != null ? `${extraction.setback_large_m} m` : null,
  );
  addEntry(
    "Gewässerabstand",
    G,
    extraction.setback_water_m != null ? `${extraction.setback_water_m} m` : null,
  );
  addEntry("Sondervorschriften", G, extraction.special_provisions);
  if (extraction.design_plan_required != null)
    addEntry("Gestaltungsplanpflicht", G, extraction.design_plan_required ? "Ja" : "Nein");
  if (extraction.heritage_protected != null)
    addEntry("Denkmalschutz", G, extraction.heritage_protected ? "Ja" : "Nein");
  addEntry("Gewässerschutz", G, extraction.water_protection);
  addEntry("Lärmvorschriften", G, extraction.noise_provisions);
  addEntry("Zusammenfassung", G, extraction.summary);

  if (entries.length > 0) {
    await supabaseAdmin
      .from("knowledge_entries")
      .upsert(entries, { onConflict: "municipality_id,category,key" });
  }

  // Idempotent rule rebuild per document
  await supabaseAdmin.from("regulation_rules").delete().eq("source_document", documentId);
  if (rules.length > 0) {
    await supabaseAdmin.from("regulation_rules").insert(rules);
  }
}
