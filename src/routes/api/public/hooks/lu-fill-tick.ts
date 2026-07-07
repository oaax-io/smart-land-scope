import { createFileRoute } from "@tanstack/react-router";
import { runExtraction } from "@/lib/regulation-extract.server";

/**
 * Cron tick: processes ONE pending LU document per invocation.
 * Called every minute by pg_cron via public.tick_lu_fill_job().
 * /api/public/* bypasses auth on published sites; we optionally verify
 * a shared secret if CRON_SECRET is configured.
 */
export const Route = createFileRoute("/api/public/hooks/lu-fill-tick")({
  server: {
    handlers: {
      POST: handle,
      GET: handle,
    },
  },
});

async function handle({ request }: { request: Request }) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Active LU job?
    const { data: job } = await supabaseAdmin
      .from("background_jobs")
      .select("id, status, total, done, ok, failed")
      .eq("job_type", "lu_fill")
      .in("status", ["queued", "running"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!job) return Response.json({ ok: true, idle: true });

    // Flip queued -> running on first tick.
    if (job.status === "queued") {
      await supabaseAdmin
        .from("background_jobs")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", job.id);
    }

    // Find next pending LU document.
    const docId = await pickNextLuDocument(supabaseAdmin);
    if (!docId) {
      await supabaseAdmin
        .from("background_jobs")
        .update({
          status: "completed",
          finished_at: new Date().toISOString(),
          current_label: "Fertig",
        })
        .eq("id", job.id);
      return Response.json({ ok: true, completed: true });
    }

    await supabaseAdmin
      .from("background_jobs")
      .update({ current_label: `Verarbeite ${docId.slice(0, 8)}…` })
      .eq("id", job.id);

    let okDelta = 0;
    let failDelta = 0;
    let errorMsg: string | null = null;
    try {
      await runExtraction({ documentId: docId });
      okDelta = 1;
    } catch (e) {
      failDelta = 1;
      errorMsg = e instanceof Error ? e.message : String(e);
      console.error("[lu-fill-tick] extraction failed", docId, errorMsg);
    }

    // Increment counters atomically via re-read.
    const { data: fresh } = await supabaseAdmin
      .from("background_jobs")
      .select("done, ok, failed, errors, total")
      .eq("id", job.id)
      .maybeSingle();
    const errors = Array.isArray(fresh?.errors) ? [...(fresh!.errors as unknown[])] : [];
    if (errorMsg) errors.push({ documentId: docId, error: errorMsg, at: new Date().toISOString() });
    const newDone = (fresh?.done ?? 0) + 1;
    const newOk = (fresh?.ok ?? 0) + okDelta;
    const newFailed = (fresh?.failed ?? 0) + failDelta;
    const isComplete = newDone >= (fresh?.total ?? job.total ?? 0);

    await supabaseAdmin
      .from("background_jobs")
      .update({
        done: newDone,
        ok: newOk,
        failed: newFailed,
        errors: errors as any,
        status: isComplete ? "completed" : "running",
        finished_at: isComplete ? new Date().toISOString() : null,
        current_label: isComplete ? "Fertig" : `${newDone}/${fresh?.total ?? job.total} verarbeitet`,
      })
      .eq("id", job.id);

    return Response.json({ ok: true, documentId: docId, okDelta, failDelta, done: newDone });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[lu-fill-tick] tick failed:", msg);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

async function pickNextLuDocument(): Promise<string | null> {
  const { data: docs } = await supabaseAdmin
    .from("regulation_documents")
    .select("id, municipalities!inner(cantons!inner(code))")
    .eq("active", true)
    .eq("municipalities.cantons.code", "LU");
  const docIds: string[] = (docs ?? []).map((d: any) => d.id);
  if (docIds.length === 0) return null;

  const [{ data: entries }, { data: extractions }] = await Promise.all([
    supabaseAdmin.from("knowledge_entries").select("source_document").in("source_document", docIds),
    supabaseAdmin
      .from("regulation_extractions")
      .select("document_id, status, zones")
      .in("document_id", docIds),
  ]);
  const withEntries = new Set<string>();
  (entries ?? []).forEach((e: any) => {
    if (e.source_document) withEntries.add(e.source_document);
  });
  const extractionMap = new Map<string, any>(
    (extractions ?? []).map((e: any) => [e.document_id, e]),
  );

  for (const id of docIds) {
    if (withEntries.has(id)) continue;
    const ex = extractionMap.get(id);
    if (!ex) return id;
    if (ex.status === "processing" || ex.status === "failed" || ex.status === "completed") return id;
  }
  return null;
}
