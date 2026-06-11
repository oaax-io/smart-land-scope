import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "Passwort zurücksetzen — SmarTerra" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = z.string().min(8, "Mindestens 8 Zeichen").max(128).safeParse(fd.get("password"));
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Passwort aktualisiert.");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5 rounded-xl border bg-card p-6 shadow-sm">
        <div>
          <h1 className="font-display text-xl font-bold">Neues Passwort setzen</h1>
          <p className="mt-1 text-sm text-muted-foreground">Wählen Sie ein sicheres Passwort.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Neues Passwort</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          Passwort speichern
        </Button>
      </form>
    </div>
  );
}
