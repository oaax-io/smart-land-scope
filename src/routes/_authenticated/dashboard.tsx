import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
import { QuickAnalysisModal, type QuickAnalysisInitial } from "@/components/quick-analysis-modal";
import heroBg from "@/assets/hero-realestate.jpg";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — SmarTerra" }] }),
  component: Dashboard,
});

function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return "Gute Nacht";
  if (h < 11) return "Guten Morgen";
  if (h < 17) return "Guten Tag";
  if (h < 22) return "Guten Abend";
  return "Gute Nacht";
}

function Dashboard() {
  const { currentOrgId, currentOrg } = useOrg();
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["dashboard-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const metaName = (user?.user_metadata?.full_name ?? user?.user_metadata?.name) as string | undefined;
  const firstName =
    profile?.first_name ??
    (metaName ? metaName.split(" ")[0] : null) ??
    (user?.email ? user.email.split("@")[0] : null);


  const today = new Date().toLocaleDateString("de-CH", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

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
      <section className="relative isolate z-50 rounded-2xl border border-border bg-gradient-to-br from-primary via-primary to-secondary p-8 text-primary-foreground shadow-lg sm:p-10">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" aria-hidden>
          <img
            src={heroBg}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-25 mix-blend-screen"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/80 via-primary/60 to-transparent" />
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-secondary/30 blur-3xl" />
          <div className="absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-primary-foreground/10 blur-3xl" />
        </div>
        <div className="relative z-10">
          <p className="text-xs uppercase tracking-[0.18em] text-primary-foreground/70">{today}</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {greeting()}{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-primary-foreground/80 sm:text-base">
            Starten Sie unten direkt mit einer Schnellanalyse — Adresse eingeben genügt.
          </p>
          <div className="relative z-[100] mt-6">
            <QuickAnalysisSearch hero />
          </div>
        </div>
      </section>



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

function extractPostalCode(label: string): string | null {
  const m = label.match(/\b(\d{4})\b/);
  return m ? m[1] : null;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

function QuickAnalysisSearch({ hero = false }: { hero?: boolean }) {
  const { currentOrgId } = useOrg();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const analyzeFn = useServerFn(runKnowledgeAnalysis);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SwissGeoSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyText, setBusyText] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchSwissLocation(query);
        setResults(res);
        setOpen(true);
      } catch (e) {
        console.error(e);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const selectResult = useCallback(
    async (r: SwissGeoSearchResult) => {
      if (!currentOrgId) {
        toast.error("Keine Organisation aktiv");
        return;
      }
      setOpen(false);
      setBusy(true);
      setBusyText("Grundstück wird ermittelt …");

      const cleanLabel = stripHtml(r.label);
      let parcel: Awaited<ReturnType<typeof identifyParcelAt>> | null = null;
      try {
        parcel = await identifyParcelAt(r.lng, r.lat);
      } catch (e) {
        console.error("identifyParcelAt failed", e);
      }

      try {
        if (parcel?.egrid) {
          const { data: existing } = await supabase
            .from("analyses")
            .select("id")
            .eq("egrid", parcel.egrid)
            .eq("organization_id", currentOrgId)
            .maybeSingle();
          if (existing?.id) {
            toast.success("Bestehende Analyse geöffnet");
            navigate({ to: "/analysen/$id", params: { id: existing.id } });
            return;
          }
        }

        if (!parcel?.municipality) {
          toast.error("Gemeinde konnte nicht ermittelt werden — bitte über 'Neue Analyse' manuell erfassen");
          navigate({ to: "/analysen/neu" });
          return;
        }

        const { data: created, error: insertErr } = await supabase
          .from("analyses")
          .insert({
            organization_id: currentOrgId,
            address: cleanLabel,
            postal_code: extractPostalCode(cleanLabel),
            municipality: parcel.municipality,
            canton: parcel.canton,
            parcel_number: parcel.parcelNumber,
            area_size: parcel.areaM2,
            lat: r.lat,
            lng: r.lng,
            egrid: parcel.egrid,
            status: "processing",
            created_by: user?.id ?? null,
          })
          .select("id")
          .single();
        if (insertErr || !created) throw insertErr ?? new Error("Insert fehlgeschlagen");

        analyzeFn({ data: { analysisId: created.id } }).catch(console.error);

        queryClient.invalidateQueries({ queryKey: ["dashboard-recent-analyses"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });

        navigate({ to: "/analysen/$id", params: { id: created.id } });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
        toast.error("Analyse konnte nicht gestartet werden", { description: msg });
      } finally {
        setBusy(false);
        setBusyText("");
      }
    },
    [currentOrgId, user?.id, navigate, queryClient, analyzeFn],
  );

  if (hero) {
    return (
      <div ref={containerRef} className="relative">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Adresse, Ort oder Parzellennummer eingeben (z. B. Bahnhofstrasse 1, Luzern)"
            className="h-14 rounded-xl border border-primary-foreground/20 bg-background/70 pl-12 pr-12 text-base text-foreground shadow-xl backdrop-blur-md placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-secondary sm:text-lg"
            disabled={busy}
          />
          {(searching || busy) && (
            <Loader2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        {open && results.length > 0 && !busy && (
          <Card className="absolute left-0 right-0 top-full z-[9999] mt-2 max-h-80 overflow-y-auto p-1 shadow-2xl">
            {results.map((r, i) => (
              <button
                key={`${r.featureId ?? "x"}-${i}`}
                type="button"
                onClick={() => selectResult(r)}
                className="block w-full rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
              >
                <span dangerouslySetInnerHTML={{ __html: r.label }} />
              </button>
            ))}
          </Card>
        )}

        <p className="mt-3 text-xs text-primary-foreground/75">
          {busy
            ? busyText
            : "Direkt-Suche über das amtliche Schweizer Geoportal (swisstopo). Bei bekannter Gemeinde startet die Analyse sofort."}
        </p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Schnellanalyse</CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={containerRef} className="relative">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => results.length > 0 && setOpen(true)}
              placeholder="Adresse, Ort oder Parzellennummer eingeben (z. B. Bahnhofstrasse 1, Luzern)"
              className="pl-9 pr-9"
              disabled={busy}
            />
            {(searching || busy) && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>

          {open && results.length > 0 && !busy && (
            <Card className="absolute left-0 right-0 top-full z-[9999] mt-1 max-h-80 overflow-y-auto p-1 shadow-2xl">
              {results.map((r, i) => (
                <button
                  key={`${r.featureId ?? "x"}-${i}`}
                  type="button"
                  onClick={() => selectResult(r)}
                  className="block w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                >
                  <span dangerouslySetInnerHTML={{ __html: r.label }} />
                </button>
              ))}
            </Card>
          )}
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          {busy
            ? busyText
            : "Direkt-Suche über das amtliche Schweizer Geoportal (swisstopo). Bei bekannter Gemeinde startet die Analyse sofort."}
        </p>
      </CardContent>
    </Card>
  );
}


