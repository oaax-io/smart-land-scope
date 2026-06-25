import { createAPIFileRoute } from "@tanstack/react-start/api";

/**
 * Background tick called by pg_cron every minute.
 * Picks up at most TICK_BATCH LU regulation documents that still need
 * extraction/knowledge entries and processes them. Updates background_jobs.
 *
 * Auth: Bearer token = CRON_SECRET env var.
 */

const TICK_BATCH = 3;

export const APIRoute = createAPIFileRoute("/api/cron/lu-tick")({
  GET: async ({ request }) => handle(request),
  POST: async ({ request }) => handle(request),
});

async function handle(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: job } = await supabaseAdmin
    .from("background_jobs")
    .select("*")
    .eq("job_type", "lu_fill")
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!job) return json({ ok: true, idle: true });

  // Promote to running
  if (job.status === "queued") {
    await supabaseAdmin
      .from("background_jobs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", job.id);
  }

  // Find next batch of LU documents needing work.
  const { data: luCanton } = await supabaseAdmin
    .from("cantons").select("id").eq("code", "LU").maybeSingle();
  if (!luCanton) return json({ ok: false, error: "no LU canton" });

  const { data: candidates } = await supabaseAdmin
    .from("regulation_documents")
    .select("id, title, municipalities!inner(name, canton_id), regulation_extractions(status), knowledge_entries(id)")
    .eq("active", true)
    .eq("municipalities.canton_id", luCanton.id);

  const pending = (candidates ?? []).filter((d: any) => {
    const hasEntries = Array.isArray(d.knowledge_entries) && d.knowledge_entries.length > 0;
    if (hasEntries) return false;
    const ex = Array.isArray(d.regulation_extractions) ? d.regulation_extractions[0] : null;
    // Treat 'processing' rows as eligible too: prior tick may have crashed.
    return !ex || ex.status === "failed" || ex.status === "completed" || ex.status === "processing";
  });

  if (pending.length === 0) {
    await supabaseAdmin
      .from("background_jobs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        current_label: "Fertig",
      })
      .eq("id", job.id);
    return json({ ok: true, done: true });
  }

  const batch = pending.slice(0, TICK_BATCH);
  const { runExtraction } = await import("@/lib/regulation-extract.server");

  const errors = Array.isArray(job.errors) ? [...job.errors] : [];
  let ok = job.ok ?? 0;
  let failed = job.failed ?? 0;
  let done = job.done ?? 0;

  for (const doc of batch) {
    const label = (doc as any).municipalities?.name || doc.title || doc.id;
    await supabaseAdmin
      .from("background_jobs")
      .update({ current_label: `Verarbeite ${label}…` })
      .eq("id", job.id);
    try {
      await runExtraction({ documentId: doc.id, force: true });
      ok += 1;
    } catch (e) {
      failed += 1;
      errors.push({ document: label, error: e instanceof Error ? e.message : String(e) });
      if (errors.length > 100) errors.shift();
    }
    done += 1;
  }

  // Recompute total = done + remaining (in case docs were imported between ticks).
  const total = Math.max((job.total ?? 0), done + Math.max(0, pending.length - batch.length));

  await supabaseAdmin
    .from("background_jobs")
    .update({ ok, failed, done, total, errors })
    .eq("id", job.id);

  return json({ ok: true, processed: batch.length, remaining: pending.length - batch.length });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
