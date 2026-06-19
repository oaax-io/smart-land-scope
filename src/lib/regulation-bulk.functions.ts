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

    const { data: adminRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRow) throw new Error("Forbidden");

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
