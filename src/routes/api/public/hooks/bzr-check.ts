import { createFileRoute } from "@tanstack/react-router";
import { checkAndUpdateBzr } from "@/lib/lu-bzr-import.server";

export const Route = createFileRoute("/api/public/hooks/bzr-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (secret) {
          const auth = request.headers.get("authorization") ?? "";
          if (auth !== `Bearer ${secret}`) {
            return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
          }
        }
        try {
          const result = await checkAndUpdateBzr(10);
          console.log("[cron/bzr-check]", result);
          return Response.json({ ok: true, ...result });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[cron/bzr-check] Fehler:", msg);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
    },
  },
});
