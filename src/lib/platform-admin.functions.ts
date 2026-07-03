import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertPlatformAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("is_platform_admin", { _user_id: userId });
  if (error || !data) throw new Error("Keine Berechtigung");
  return supabaseAdmin;
}

export const listAllOrganizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertPlatformAdmin(context.userId);
    const { data: orgs, error } = await admin
      .from("organizations")
      .select("id, name, slug, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const orgIds = (orgs ?? []).map((o) => o.id);
    const [{ data: members }, { data: subs }] = await Promise.all([
      admin.from("profiles").select("organization_id").in("organization_id", orgIds.length ? orgIds : ["00000000-0000-0000-0000-000000000000"]),
      admin.from("subscriptions").select("organization_id, plan, status").in("organization_id", orgIds.length ? orgIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);

    const counts = new Map<string, number>();
    (members ?? []).forEach((m) => counts.set(m.organization_id!, (counts.get(m.organization_id!) ?? 0) + 1));
    const subMap = new Map((subs ?? []).map((s) => [s.organization_id, s]));

    return (orgs ?? []).map((o) => ({
      ...o,
      member_count: counts.get(o.id) ?? 0,
      plan: subMap.get(o.id)?.plan ?? null,
      status: subMap.get(o.id)?.status ?? null,
    }));
  });

export const listAllUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertPlatformAdmin(context.userId);
    const { data: profiles, error } = await admin
      .from("profiles")
      .select("id, first_name, last_name, email, organization_id, created_at, organizations(name)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const userIds = (profiles ?? []).map((p) => p.id);
    const { data: roles } = await admin
      .from("user_roles")
      .select("user_id, role, organization_id")
      .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);

    const roleMap = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role as string);
      roleMap.set(r.user_id, arr);
    });

    return (profiles ?? []).map((p) => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email,
      organization_id: p.organization_id,
      organization_name: (p.organizations as { name: string } | null)?.name ?? null,
      created_at: p.created_at,
      roles: roleMap.get(p.id) ?? [],
    }));
  });

export const getPlatformStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertPlatformAdmin(context.userId);
    const [orgs, users, regs, fb] = await Promise.all([
      admin.from("organizations").select("id", { count: "exact", head: true }),
      admin.from("profiles").select("id", { count: "exact", head: true }),
      admin.from("regulation_documents").select("id", { count: "exact", head: true }),
      admin.from("feedback").select("id", { count: "exact", head: true }),
    ]);
    return {
      organizations: orgs.count ?? 0,
      users: users.count ?? 0,
      regulations: regs.count ?? 0,
      feedback: fb.count ?? 0,
    };
  });

// ─────────────────────────────────────────────────────────────
// LU BZR Auto-Import (nutzt lu-bzr-import.server.ts)
// ─────────────────────────────────────────────────────────────

export const initLuImportLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.userId);
    const { initLuImportLog: fn } = await import("./lu-bzr-import.server");
    return fn();
  });

export const processNextLuBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.userId);
    const { processNextLuImportBatch } = await import("./lu-bzr-import.server");
    return processNextLuImportBatch(5);
  });

export const getLuImportStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{
    total: number;
    pending: number;
    downloaded: number;
    extracted: number;
    unavailable: number;
    failed: number;
  }> => {
    const admin = await assertPlatformAdmin(context.userId);
    const { data } = await admin.from("lu_bzr_import_log").select("status");
    const rows = (data ?? []) as Array<{ status: string }>;
    const stats = { pending: 0, downloaded: 0, extracted: 0, unavailable: 0, failed: 0 };
    for (const r of rows) {
      if (r.status in stats) (stats as Record<string, number>)[r.status]++;
    }
    return { total: rows.length, ...stats };
  });
