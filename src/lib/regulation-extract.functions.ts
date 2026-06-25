import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const InputSchema = z.object({
  documentId: z.string().uuid(),
  force: z.boolean().optional(),
});

export const extractRegulationDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin, error: adminErr } = await supabase.rpc("is_platform_admin", {
      _user_id: userId,
    });
    if (adminErr || !isAdmin) throw new Error("Forbidden");

    const { runExtraction } = await import("./regulation-extract.server");
    return runExtraction({ documentId: data.documentId, force: data.force });
  });
