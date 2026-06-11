import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateObject } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const InputSchema = z.object({ documentId: z.string().uuid() });

const ZoneSchema = z.object({
  code: z.string().max(50).nullable().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
});

const SetbacksSchema = z
  .object({
    klein: z.number().nullable().optional(),
    gross: z.number().nullable().optional(),
    gewaesser: z.number().nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
  })
  .partial()
  .nullable()
  .optional();

const ExtractionSchema = z.object({
  zones: z.array(ZoneSchema).default([]),
  residential_zones: z.array(ZoneSchema).default([]),
  commercial_zones: z.array(ZoneSchema).default([]),
  mixed_zones: z.array(ZoneSchema).default([]),
  utilization_ratio: z.number().min(0).max(10).nullable().optional(),
  building_coverage_ratio: z.number().min(0).max(5).nullable().optional(),
  max_floors: z.number().min(0).max(50).nullable().optional(),
  max_height_m: z.number().min(0).max(300).nullable().optional(),
  setbacks: SetbacksSchema,
  special_provisions: z.string().max(8000).nullable().optional(),
  design_plan_required: z.boolean().nullable().optional(),
  heritage_protected: z.boolean().nullable().optional(),
  water_protection: z.string().max(2000).nullable().optional(),
  noise_provisions: z.string().max(2000).nullable().optional(),
});

const SYSTEM_PROMPT = `Du bist Experte für Schweizer Bau- und Zonenrecht (BZR, BZO, Zonenpläne, Gestaltungspläne, Sondervorschriften).
Analysiere das beigefügte Reglementdokument und extrahiere alle relevanten Bauvorschriften strukturiert.

Erkenne insbesondere:
- Nutzungszonen (alle), Wohnzonen, Gewerbezonen, Mischzonen mit Zonenkürzel/Code und Kurzbeschreibung
- Ausnützungsziffer (AZ) und Überbauungsziffer (ÜZ)
- Maximale Vollgeschosse und Gebäudehöhe in Metern
- Grenzabstände (kleiner/grosser/Gewässerabstand)
- Sondervorschriften, Gestaltungsplanpflicht, Denkmalschutz
- Gewässerschutz- und Lärmschutzvorschriften

Wenn ein Wert nicht eindeutig im Dokument steht, setze null. Erfinde keine Zahlen.
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

    // Authorize: only platform admins
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

    // Idempotency: skip if already completed
    const { data: existing } = await supabaseAdmin
      .from("regulation_extractions")
      .select("id, status")
      .eq("document_id", doc.id)
      .maybeSingle();
    if (existing?.status === "completed") {
      return { skipped: true, extractionId: existing.id };
    }

    // Upsert into processing state
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

      const { object } = await generateObject({
        model: gateway("google/gemini-2.5-flash"),
        schema: ExtractionSchema,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Dokumenttyp: ${doc.doc_type}\nTitel: ${doc.title}\nExtrahiere die Vorschriften strukturiert.`,
              },
              {
                type: "file",
                data: base64,
                mediaType: mime || "application/pdf",
              },
            ],
          },
        ],
      });

      const { error: saveErr } = await supabaseAdmin
        .from("regulation_extractions")
        .update({
          status: "completed",
          error_message: null,
          processed_at: new Date().toISOString(),
          zones: object.zones,
          residential_zones: object.residential_zones,
          commercial_zones: object.commercial_zones,
          mixed_zones: object.mixed_zones,
          utilization_ratio: object.utilization_ratio ?? null,
          building_coverage_ratio: object.building_coverage_ratio ?? null,
          max_floors: object.max_floors != null ? Math.round(object.max_floors) : null,
          max_height_m: object.max_height_m ?? null,
          setbacks: object.setbacks ?? null,
          special_provisions: object.special_provisions ?? null,
          design_plan_required: object.design_plan_required ?? null,
          heritage_protected: object.heritage_protected ?? null,
          water_protection: object.water_protection ?? null,
          noise_provisions: object.noise_provisions ?? null,
          raw_extraction: object,
        })
        .eq("id", extr.id);
      if (saveErr) throw saveErr;

      // ===== Knowledge Base Engine: derive structured entries =====
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
