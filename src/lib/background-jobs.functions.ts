import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Background job orchestration for long-running platform tasks
 * (currently: filling the Lucerne knowledge base).
 *
 * The actual work is performed by /api/public/hooks/lu-fill-tick which is
 * called every minute by pg_cron. This module only manages job lifecycle:
 * start, cancel, status.
 */

async function requireAdmin(supabase: any, userId: string) {
  const { data: isAdmin, error } = await supabase.rpc("is_platform_admin", { _user_id: userId });
  if (error || !isAdmin) throw new Error("Forbidden");
}

export const startLuFillJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Refuse to start a second LU job if one is already running/queued.
    const { data: existing } = await supabaseAdmin
      .from("background_jobs")
      .select("id, status")
      .eq("job_type", "lu_fill")
      .in("status", ["queued", "running"])
      .maybeSingle();
    if (existing) return { jobId: existing.id, alreadyRunning: true };

    // Make sure all LU BZR source URLs are imported as documents first.
    const { importLuBzrDocumentsInternal } = await import("./lu-bzr-import.server");
    let imported = 0;
    try {
      const r = await importLuBzrDocumentsInternal();
      imported = r.summary.inserted ?? 0;
    } catch (e) {
      console.warn("[lu-fill] import step failed", e);
    }

    // Count total documents that still need work (same filter as the tick).
    const total = await countLuPending(supabaseAdmin);

    const { data: job, error } = await supabaseAdmin
      .from("background_jobs")
      .insert({
        job_type: "lu_fill",
        status: total > 0 ? "queued" : "completed",
        scope: { canton: "LU", imported },
        total,
        done: 0,
        ok: 0,
        failed: 0,
        current_label: total > 0 ? "Wartet auf Cron-Tick…" : "Nichts zu tun",
        started_at: total > 0 ? null : new Date().toISOString(),
        finished_at: total > 0 ? null : new Date().toISOString(),
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw error;

    return { jobId: job.id, alreadyRunning: false, imported, total };
  });

export const cancelJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("background_jobs")
      .update({ status: "cancelled", finished_at: new Date().toISOString() })
      .eq("id", data.jobId)
      .in("status", ["queued", "running"]);
    return { ok: true };
  });

export const getActiveLuJob = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("background_jobs")
      .select("*")
      .eq("job_type", "lu_fill")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  });

async function countLuPending(supabaseAdmin: any): Promise<number> {
  const { data: docs } = await supabaseAdmin
    .from("regulation_documents")
    .select("id, municipalities!inner(cantons!inner(code))")
    .eq("active", true)
    .eq("municipalities.cantons.code", "LU");
  const docIds: string[] = (docs ?? []).map((d: any) => d.id);
  if (docIds.length === 0) return 0;

  const { data: extractions } = await supabaseAdmin
    .from("regulation_extractions")
    .select("document_id, status, zones, raw_extraction")
    .in("document_id", docIds);
  const extractionMap = new Map<string, any>((extractions ?? []).map((e: any) => [e.document_id, e]));

  let pending = 0;
  for (const id of docIds) {
    const ex = extractionMap.get(id);
    const raw = ex?.raw_extraction;
    const isFallback = raw && typeof raw === "object" && !Array.isArray(raw) && raw.fallback === true;

    const { count, error } = await supabaseAdmin
      .from("knowledge_entries")
      .select("id", { count: "exact", head: true })
      .eq("source_document", id);
    if (error) throw error;
    if ((count ?? 0) > 0 && !isFallback) continue;
    if (!ex || ex.status === "processing" || ex.status === "failed" || ex.status === "completed") {
      pending += 1;
    }
  }
  return pending;
}
