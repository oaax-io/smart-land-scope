import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { MapPinned, FolderKanban, Users, FileText, ArrowUpRight, Star, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useOrg } from "@/hooks/use-org";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { searchSwissLocation, identifyParcelAt, type SwissGeoSearchResult } from "@/lib/swiss-geo";
import { runKnowledgeAnalysis } from "@/lib/analyze-knowledge.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — SmarTerra" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { currentOrgId, currentOrg } = useOrg();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const [a, am, p, m] = await Promise.all([
        supabase.from("analyses").select("id", { count: "exact", head: true }).eq("organization_id", currentOrgId!),
        supabase.from("analyses").select("id", { count: "exact", head: true }).eq("organization_id", currentOrgId!).gte("created_at", startOfMonth),
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("organization_id", currentOrgId!).eq("status", "active"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("organization_id", currentOrgId!),
      ]);
      return { total: a.count ?? 0, month: am.count ?? 0, projects: p.count ?? 0, members: m.count ?? 0 };
    },
  });

  const cards = [
    { label: "Analysen gesamt", value: stats?.total ?? 0, icon: MapPinned },
    { label: "Diesen Monat", value: stats?.month ?? 0, icon: ArrowUpRight },
    { label: "Aktive Projekte", value: stats?.projects ?? 0, icon: FolderKanban },
    { label: "Team-Mitglieder", value: stats?.members ?? 0, icon: Users },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Willkommen{currentOrg ? ` bei ${currentOrg.name}` : ""}. Starten Sie mit einer neuen Analyse.
          </p>
        </div>
        <Button asChild>
          <Link to="/analysen">
            <Search className="mr-2 h-4 w-4" />
            Neue Analyse
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-display text-3xl font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display">Schnellanalyse</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input placeholder="Adresse oder Parzellennummer eingeben (z. B. Bahnhofstrasse 1, Zürich)" className="flex-1" />
            <Button>
              <Search className="mr-2 h-4 w-4" />
              Analysieren
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Hinweis: Die KI-Auswertung ist noch nicht aktiv. Eingaben werden in Kürze verarbeitet.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display text-lg">Letzte Analysen — Live-Status</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/analysen">Alle ansehen</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <RecentAnalysesLive orgId={currentOrgId} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <Star className="h-4 w-4 text-secondary" />
              Favoriten
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState icon={Star} title="Keine Favoriten" description="Markieren Sie Analysen, um sie hier zu sammeln." />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <FileText className="h-4 w-4 text-secondary" />
            Berichte
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState icon={FileText} title="Noch keine Berichte" description="Erstellen Sie Berichte aus Ihren Analysen, um sie mit dem Team zu teilen." />
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: React.ComponentType<{ className?: string }>; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 py-10 text-center">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-background text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; spin?: boolean }> = {
  draft: { label: "Entwurf", variant: "outline" },
  processing: { label: "In Analyse", variant: "secondary", spin: true },
  pending: { label: "Wartend", variant: "secondary" },
  completed: { label: "Abgeschlossen", variant: "default" },
  failed: { label: "Fehlgeschlagen", variant: "destructive" },
};

function RecentAnalysesLive({ orgId }: { orgId: string | null | undefined }) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["dashboard-recent-analyses", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analyses")
        .select("id, address, municipality, canton, status, created_at")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: (q) =>
      (q.state.data ?? []).some((a) => a.status === "processing" || a.status === "draft") ? 4000 : false,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Lade …</p>;
  if (items.length === 0) {
    return <EmptyState icon={MapPinned} title="Noch keine Analysen" description="Starten Sie Ihre erste Grundstücksanalyse." />;
  }
  return (
    <div className="divide-y rounded-lg border">
      {items.map((a) => {
        const s = STATUS_BADGE[a.status as string] ?? { label: a.status as string, variant: "secondary" as const };
        return (
          <Link key={a.id} to="/analysen/$id" params={{ id: a.id }}
            className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{a.address ?? "Ohne Adresse"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[a.municipality, a.canton].filter(Boolean).join(" · ")}
              </p>
            </div>
            <Badge variant={s.variant} className="gap-1">
              {s.spin && <Loader2 className="h-3 w-3 animate-spin" />}
              {s.label}
            </Badge>
          </Link>
        );
      })}
    </div>
  );
}

