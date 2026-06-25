import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function requireAdmin(supabase: any, userId: string) {
  const { data: isAdmin, error } = await supabase.rpc("is_platform_admin", { _user_id: userId });
  if (error || !isAdmin) throw new Error("Forbidden");
}

export const listRegionsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: cantons }, { data: munis }] = await Promise.all([
      supabaseAdmin.from("cantons").select("id, code, name, active").order("code"),
      supabaseAdmin
        .from("municipalities")
        .select("id, name, canton_id, active")
        .order("name"),
    ]);
    return { cantons: cantons ?? [], municipalities: munis ?? [] };
  });

export const setCantonActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("cantons")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const setMunicipalityActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("municipalities")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
