import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrg } from "@/hooks/use-org";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Team — SmarTerra" }] }),
  component: TeamPage,
});

type Member = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  created_at: string;
  role: "admin" | "owner" | "member" | null;
};

function TeamPage() {
  const { currentOrgId } = useOrg();

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["org-members", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, created_at")
        .eq("organization_id", currentOrgId!);
      if (error) throw error;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("organization_id", currentOrgId!);

      const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role as Member["role"]]));
      return (profiles ?? []).map((p) => ({ ...p, role: roleMap.get(p.id) ?? null }));
    },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">Verwalten Sie Mitglieder, Rollen und Einladungen.</p>
        </div>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Mitglied einladen
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <Users className="h-4 w-4 text-secondary" />
            Mitglieder
          </CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Mitglieder gefunden.</p>
          ) : (
            <div className="divide-y">
              {members.map((m) => {
                const name = [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email;
                const initials = (m.first_name?.[0] ?? m.email[0] ?? "U").toUpperCase();
                return (
                  <div key={m.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-secondary/15 text-secondary text-sm font-semibold">
                        {initials}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{name}</p>
                        <p className="text-xs text-muted-foreground">
                          Beigetreten {new Date(m.created_at).toLocaleDateString("de-CH")}
                        </p>
                      </div>
                    </div>
                    {m.role && (
                      <Badge variant={m.role === "owner" ? "default" : "secondary"} className="capitalize">
                        {m.role}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Offene Einladungen</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Keine offenen Einladungen.</p>
        </CardContent>
      </Card>
    </div>
  );
}
