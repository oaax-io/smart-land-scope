import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Returns the IDs of all regulation documents that do not yet have any
 * knowledge_entries linked via source_document. The client iterates this list
 * and calls extractRegulationDocument for each, so we keep per-request runtime
 * short and get progress feedback.
 */
export const listRegulationsMissingKnowledge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin, error: adminErr } = await supabase.rpc("is_platform_admin", {
      _user_id: userId,
    });
    if (adminErr || !isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: docs, error } = await supabaseAdmin
      .from("regulation_documents")
      .select("id, title, municipality_id, municipalities(name)")
      .order("created_at", { ascending: true });
    if (error) throw error;

    const { data: entries, error: entErr } = await supabaseAdmin
      .from("knowledge_entries")
      .select("source_document")
      .not("source_document", "is", null);
    if (entErr) throw entErr;

    const withEntries = new Set((entries ?? []).map((e) => e.source_document as string));

    return (docs ?? [])
      .filter((d) => !withEntries.has(d.id))
      .map((d) => ({
        id: d.id,
        title: d.title,
        municipalityName:
          (d.municipalities as { name?: string } | null)?.name ?? "—",
      }));
  });

/**
 * Lists all active LU regulation documents that still need work. This includes
 * not-yet-started documents, stuck processing rows and completed extractions
 * whose knowledge rows were not written.
 */
export const listLuRegulationsToFill = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin, error: adminErr } = await supabase.rpc("is_platform_admin", {
      _user_id: userId,
    });
    if (adminErr || !isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: docs, error } = await supabaseAdmin
      .from("regulation_documents")
      .select("id, title, municipality_id, municipalities!inner(name, cantons!inner(code))")
      .eq("active", true)
      .eq("municipalities.cantons.code", "LU")
      .order("created_at", { ascending: true });
    if (error) throw error;

    const documentIds = (docs ?? []).map((doc) => doc.id);
    if (documentIds.length === 0) return [];

    const [{ data: entries, error: entriesErr }, { data: extractions, error: extractionsErr }] =
      await Promise.all([
        supabaseAdmin
          .from("knowledge_entries")
          .select("source_document")
          .in("source_document", documentIds),
        supabaseAdmin
          .from("regulation_extractions")
          .select("document_id, status, zones")
          .in("document_id", documentIds),
      ]);
    if (entriesErr) throw entriesErr;
    if (extractionsErr) throw extractionsErr;

    const entryCounts = new Map<string, number>();
    for (const entry of entries ?? []) {
      if (!entry.source_document) continue;
      entryCounts.set(entry.source_document, (entryCounts.get(entry.source_document) ?? 0) + 1);
    }

    const extractionMap = new Map(
      (extractions ?? []).map((extraction) => [extraction.document_id, extraction]),
    );

    return (docs ?? [])
      .filter((doc) => {
        const entryCount = entryCounts.get(doc.id) ?? 0;
        if (entryCount > 0) return false;
        const extraction = extractionMap.get(doc.id);
        if (!extraction) return true;
        if (extraction.status === "processing" || extraction.status === "failed") return true;
        return extraction.status === "completed";
      })
      .map((doc) => {
        const extraction = extractionMap.get(doc.id);
        const zones = Array.isArray(extraction?.zones) ? extraction.zones.length : 0;
        const municipality = doc.municipalities as { name?: string } | null;
        return {
          id: doc.id,
          title: doc.title,
          municipalityName: municipality?.name ?? "—",
          status: extraction?.status ?? "not_started",
          zones,
        };
      });
  });
