import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createUserSchema = z.object({
  email: z.string().trim().email().max(255),
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  password: z.string().min(8).max(128),
  role: z.enum(["admin", "owner", "member"]).default("member"),
});

export const createOrgUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createUserSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Get caller's org
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle();
    if (pErr || !profile?.organization_id) throw new Error("Organisation nicht gefunden");
    const orgId = profile.organization_id;

    // Check caller is admin or owner in this org
    const { data: callerRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", orgId);
    const allowed = (callerRoles ?? []).some((r) => r.role === "admin" || r.role === "owner");
    if (!allowed) throw new Error("Keine Berechtigung");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Create the user
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        first_name: data.first_name,
        last_name: data.last_name,
        full_name: `${data.first_name} ${data.last_name}`,
      },
    });
    if (cErr || !created?.user) throw new Error(cErr?.message ?? "User-Erstellung fehlgeschlagen");

    const newUserId = created.user.id;

    // The handle_new_user trigger created a fresh org + owner role for them.
    // Move them into the caller's org instead.
    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({
        organization_id: orgId,
        first_name: data.first_name,
        last_name: data.last_name,
      })
      .eq("id", newUserId);
    if (upErr) throw new Error(upErr.message);

    // Remove auto-created owner role in their personal org and set requested role in caller org
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    const { error: rErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: newUserId,
      organization_id: orgId,
      role: data.role,
    });
    if (rErr) throw new Error(rErr.message);

    return { ok: true as const, userId: newUserId };
  });
