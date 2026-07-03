import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPinned, Plus, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrg } from "@/hooks/use-org";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/analysen/")({
  head: () => ({ meta: [{ title: "Analysen — SmarTerra" }] }),
  component: AnalysenListPage,
});

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Entwurf", variant: "outline" },
  processing: { label: "In Analyse", variant: "secondary" },
  pending: { label: "Wartend", variant: "secondary" },
  completed: { label: "Analyse abgeschlossen", variant: "default" },
  failed: { label: "Analyse fehlgeschlagen", variant: "destructive" },
};

function AnalysenListPage() {
  const { currentOrgId } = useOrg();

  const { data: analyses = [], isLoading } = useQuery({
    queryKey: ["analyses", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analyses")
        .select("id, address, parcel_number, municipality, canton, status, created_at")
        .eq("organization_id", currentOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Grundstücksanalysen</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Übersicht aller laufenden und abgeschlossenen Analysen Ihrer Organisation.
          </p>
        </div>
        <Button asChild>
          <Link to="/dashboard">
            <Plus className="mr-2 h-4 w-4" />
            Neue Analyse
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Alle Analysen</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Lade …</p>
          ) : analyses.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
                <MapPinned className="h-5 w-5" />
              </div>
              <p className="mt-4 font-medium">Noch keine Analysen</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Starten Sie Ihre erste Grundstücksanalyse — Adresse, Parzelle, Zone und Potenzial in einem Schritt.
              </p>
              <Button asChild className="mt-5">
                <Link to="/dashboard">
                  <Plus className="mr-2 h-4 w-4" />
                  Neue Analyse
                </Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y rounded-lg border">
              {analyses.map((a) => {
                const s = statusLabels[a.status as string] ?? { label: a.status as string, variant: "secondary" as const };
                return (
                  <Link
                    key={a.id}
                    to="/analysen/$id"
                    params={{ id: a.id }}
                    className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{a.address ?? "Ohne Adresse"}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {[a.parcel_number && `Parz. ${a.parcel_number}`, a.municipality, a.canton]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <Badge variant={s.variant}>{s.label}</Badge>
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      {new Date(a.created_at).toLocaleDateString("de-CH")}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
