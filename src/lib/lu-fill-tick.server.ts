/**
 * Background tick: processes a small batch of LU regulation documents that
 * still lack a knowledge base. Called via HTTP (POST /api/cron/lu-tick)
 * from pg_cron + pg_net every minute.
 *
 * Auth: Bearer token = CRON_SECRET env var (skipped if unset for local dev).
 */

const TICK_BATCH = 3;

export async function handleLuFillTick(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  type Job = {
    id: string;
    status: string;
    total: number;
    done: number;
    ok: number;
    failed: number;
    errors?: unknown;
  };
  const { data: job } = (await supabaseAdmin
    .from("background_jobs")
    .select("*")
    .eq("job_type", "lu_fill")
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()) as unknown as { data: Job | null };
  if (!job) return json({ ok: true, idle: true });

  if (job.status === "queued") {
    await supabaseAdmin
      .from("background_jobs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", job.id);
  }

  const { data: luCanton } = await supabaseAdmin
    .from("cantons").select("id").eq("code", "LU").maybeSingle();
  if (!luCanton) return json({ ok: false, error: "no LU canton" });

  const { data: candidates } = await supabaseAdmin
    .from("regulation_documents")
    .select(
      "id, title, municipalities!inner(name, canton_id), regulation_extractions(status), knowledge_entries(id)",
    )
    .eq("active", true)
    .eq("municipalities.canton_id", luCanton.id);

  const pending = (candidates ?? []).filter((d: any) => {
    const hasEntries = Array.isArray(d.knowledge_entries) && d.knowledge_entries.length > 0;
    if (hasEntries) return false;
    const ex = Array.isArray(d.regulation_extractions) ? d.regulation_extractions[0] : null;
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

  const errorsArr = Array.isArray(job.errors) ? [...(job.errors as unknown[])] : [];
  let ok = job.ok ?? 0;
  let failed = job.failed ?? 0;
  let done = job.done ?? 0;
  let lastError: string | null = null;

  for (const doc of batch) {
    const label = (doc as any).municipalities?.name || (doc as any).title || (doc as any).id;
    await supabaseAdmin
      .from("background_jobs")
      .update({ current_label: `Verarbeite ${label}…` })
      .eq("id", job.id);
    try {
      await runExtraction({ documentId: (doc as any).id, force: true });
      ok += 1;
    } catch (e) {
      failed += 1;
      lastError = `${label}: ${e instanceof Error ? e.message : String(e)}`;
      errorsArr.push({ document: label, error: lastError });
      if (errorsArr.length > 100) errorsArr.shift();
    }
    done += 1;
  }

  const total = Math.max(job.total ?? 0, done + Math.max(0, pending.length - batch.length));

  await supabaseAdmin
    .from("background_jobs")
    .update({
      ok,
      failed,
      done,
      total,
      last_error: lastError ?? null,
    } as never)
    .eq("id", job.id);

  return json({ ok: true, processed: batch.length, remaining: pending.length - batch.length });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
