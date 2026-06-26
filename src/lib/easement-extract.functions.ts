import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const ExtractInput = z.object({
  documentId: z.string().uuid(),
  analysisId: z.string().uuid(),
});

const EasementItemSchema = z.object({
  easement_type: z
    .enum(["dienstbarkeit", "grundlast", "pfandrecht", "anmerkung", "vormerkung"])
    .default("dienstbarkeit"),
  reg_nr: z.string().nullable().optional(),
  title: z.string().default("Unbekannte Belastung"),
  description: z.string().nullable().optional(),
  beneficiary: z.string().nullable().optional(),
  burdened_parcel: z.string().nullable().optional(),
  legal_basis: z.string().nullable().optional(),
  amount_chf: z.number().nullable().optional(),
  rank: z.number().nullable().optional(),
  established_date: z.string().nullable().optional(),
  ai_confidence: z.enum(["high", "medium", "low"]).default("medium"),
});

export const extractEasementsFromDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ExtractInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: doc, error: docErr } = await supabaseAdmin
      .from("analysis_documents")
      .select("id, file_name, storage_path, mime_type, analysis_id, organization_id")
      .eq("id", data.documentId)
      .maybeSingle();
    if (docErr || !doc) throw new Error("Dokument nicht gefunden");

    const { data: orgCheck } = await supabase
      .from("user_roles")
      .select("id")
      .eq("organization_id", doc.organization_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!orgCheck) throw new Error("Forbidden");

    const { data: fileData, error: fileErr } = await supabaseAdmin.storage
      .from("analysis-documents")
      .download(doc.storage_path);
    if (fileErr || !fileData) throw new Error("Dokument konnte nicht geladen werden");
    const buf = Buffer.from(await fileData.arrayBuffer());
    const base64 = buf.toString("base64");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY fehlt");
    const gateway = createLovableAiGatewayProvider(apiKey);

    const systemPrompt = `Du bist Experte für das Schweizer Grundbuch und Immobilienrecht.
Analysiere den beigefügten Grundbuchauszug und extrahiere ALLE Eigentumsbeschränkungen strukturiert.

Kategorien:
- "dienstbarkeit": Rechte und Lasten (Wegrechte, Baurechte, Näherbaurechte etc.)
- "grundlast": Dauernde Leistungspflichten
- "pfandrecht": Schuldbriefe, Hypotheken (mit Betrag und Pfandstelle)
- "anmerkung": Behördliche Anmerkungen (z.B. Ausnahmebewilligung, Mehrwertrevers)
- "vormerkung": Vorgemerkte Rechte

Für jede Belastung: RegNr., Stichwort/Titel, Beschreibung, Begünstigter/Belasteter, Beleg/Datum, Errichtungsdatum.
Bei Pfandrechten: Betrag in CHF und Pfandstelle.

Sei präzise: Erfinde keine Daten, die nicht im Dokument stehen. Setze null für fehlende Felder.
Antworte AUSSCHLIESSLICH als reines JSON-Array ohne Markdown-Fences.`;

    const result = await generateText({
      model: gateway("google/gemini-2.5-pro"),
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "text" as const,
              text: `Extrahiere alle Eigentumsbeschränkungen aus diesem Grundbuchauszug.

Antworte als JSON-Array (kein Objekt, direkt das Array):
[
  {
    "easement_type": "dienstbarkeit" | "grundlast" | "pfandrecht" | "anmerkung" | "vormerkung",
    "reg_nr": "49299H.UEB" | null,
    "title": "Fusswegrecht",
    "description": "Unterhaltsabrede gemäss Beleg BH 116",
    "beneficiary": "z.L. Nr. 1226, 3686",
    "burdened_parcel": null,
    "legal_basis": "04.03.1942 Beleg 62HO",
    "amount_chf": null,
    "rank": null,
    "established_date": "1942-03-04" | null,
    "ai_confidence": "high" | "medium" | "low"
  }
]`,
            },
            {
              type: "file" as const,
              data: base64,
              mediaType: doc.mime_type || "application/pdf",
            },
          ],
        },
      ],
      maxOutputTokens: 8000,
    });

    let items: unknown[] = [];
    try {
      const text = result.text.trim();
      const cleaned = text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      const firstBracket = cleaned.indexOf("[");
      const lastBracket = cleaned.lastIndexOf("]");
      const slice =
        firstBracket >= 0 && lastBracket > firstBracket
          ? cleaned.slice(firstBracket, lastBracket + 1)
          : cleaned;
      const arr = JSON.parse(slice);
      items = Array.isArray(arr) ? arr : [];
    } catch {
      throw new Error("KI-Antwort konnte nicht als JSON-Array geparst werden");
    }

    const toInsert = items
      .map((item) => {
        const parsed = EasementItemSchema.safeParse(item);
        if (!parsed.success) return null;
        const established = parsed.data.established_date;
        let establishedDate: string | null = null;
        if (established) {
          const d = new Date(established);
          if (!Number.isNaN(d.getTime())) {
            establishedDate = d.toISOString().split("T")[0];
          }
        }
        return {
          analysis_id: data.analysisId,
          organization_id: doc.organization_id,
          source: "ai" as const,
          source_document_id: doc.id,
          created_by: userId,
          easement_type: parsed.data.easement_type,
          reg_nr: parsed.data.reg_nr ?? null,
          title: parsed.data.title,
          description: parsed.data.description ?? null,
          beneficiary: parsed.data.beneficiary ?? null,
          burdened_parcel: parsed.data.burdened_parcel ?? null,
          legal_basis: parsed.data.legal_basis ?? null,
          amount_chf: parsed.data.amount_chf ?? null,
          rank: parsed.data.rank ?? null,
          established_date: establishedDate,
          ai_confidence: parsed.data.ai_confidence,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (toInsert.length > 0) {
      const { error: insertErr } = await supabaseAdmin
        .from("analysis_easements")
        .insert(toInsert);
      if (insertErr) throw new Error(insertErr.message);
    }

    return {
      extractedCount: toInsert.length,
      skippedCount: items.length - toInsert.length,
    };
  });
