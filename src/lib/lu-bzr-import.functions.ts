import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const importLuBzrDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin, error: adminErr } = await supabase.rpc("is_platform_admin", {
      _user_id: userId,
    });
    if (adminErr || !isAdmin) throw new Error("Forbidden");
    const { importLuBzrDocumentsInternal } = await import("./lu-bzr-import.server");
    return importLuBzrDocumentsInternal(userId);
  });
