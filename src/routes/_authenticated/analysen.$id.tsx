import { createFileRoute, Link, Outlet, notFound, useLocation } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Download,
  FileText,
  Home,
  Loader2,
  MapPin,
  RefreshCcw,
  RefreshCw,

  ScrollText,
  Sparkles,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { ScenarioComparison } from "@/components/scenario-comparison";
import { runKnowledgeAnalysis } from "@/lib/analyze-knowledge.functions";
import { DevelopmentScoreCard } from "@/components/development-score-card";
import { SwissMap } from "@/components/swiss-map";
import { LegalDisclaimer } from "@/components/legal-disclaimer";
import { OEREBTopicsTable } from "@/components/oereb-topics-table";
import { loadOEREBData } from "@/lib/oereb.functions";
import { ProjectDataCard, FloorCalculatorCard, DocumentUploadsCard } from "@/components/analysis-project-tab";
import { EasementsPanel } from "@/components/easements-panel";
import { loadLuZonePlanForAnalysis } from "@/lib/lu-zoneplan.functions";
import { AnalysisReport } from "@/components/analysis-report";



export const Route = createFileRoute("/_authenticated/analysen/$id")({
  head: ({ params }) => ({ meta: [{ title: `Analyse ${params.id.slice(0, 8)} — SmarTerra` }] }),
  component: AnalysisDetailPage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl p-6"><p className="text-sm text-destructive">Fehler: {error.message}</p></div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl p-6"><p className="text-sm text-muted-foreground">Analyse nicht gefunden.</p></div>
  ),
});

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Entwurf", variant: "outline" },
  processing: { label: "In Analyse", variant: "secondary" },
  pending: { label: "Wartend", variant: "secondary" },
  completed: { label: "Analyse abgeschlossen", variant: "default" },
  failed: { label: "Analyse fehlgeschlagen", variant: "destructive" },
};

const POTENTIAL: Record<string, { label: string; tone: string }> = {
  low: { label: "Niedrig", tone: "bg-muted text-foreground" },
  medium: { label: "Mittel", tone: "bg-secondary/20 text-secondary-foreground" },
  high: { label: "Hoch", tone: "bg-primary/15 text-primary" },
  very_high: { label: "Sehr Hoch", tone: "bg-primary text-primary-foreground" },
};

const SEVERITY: Record<string, { label: string; variant: "secondary" | "default" | "destructive" }> = {
  low: { label: "Niedrig", variant: "secondary" },
  medium: { label: "Mittel", variant: "default" },
  high: { label: "Hoch", variant: "destructive" },
};

const RISK_CATEGORY: Record<string, string> = {
  baurecht: "Baurecht",
  sondervorschrift: "Sondervorschriften",
  denkmalschutz: "Denkmalschutz",
  abstand: "Abstände",
  laerm: "Lärm",
  gewaesser: "Gewässer",
  wald: "Wald",
  sonstiges: "Sonstiges",
};

type Risk = {
  category: keyof typeof RISK_CATEGORY;
  title: string;
  description: string;
  severity: keyof typeof SEVERITY;
};

function AnalysisDetailPage() {
  const { id } = Route.useParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  const analyzeFn = useServerFn(runKnowledgeAnalysis);

  const { data: analysis, isLoading } = useQuery({
    queryKey: ["analysis", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("analyses").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
    refetchInterval: (q) => (q.state.data?.status === "processing" ? 4000 : false),
  });

  const reanalyze = useMutation({
    mutationFn: () => analyzeFn({ data: { analysisId: id } }),
    onSuccess: () => {
      toast.success("Analyse aktualisiert");
      queryClient.invalidateQueries({ queryKey: ["analysis", id] });
    },
    onError: (e: Error) => toast.error("Fehler", { description: e.message }),
  });

  const loadLuZoneFn = useServerFn(loadLuZonePlanForAnalysis);
  const { data: zoneResult, isFetching: zoneLoading } = useQuery({
    queryKey: ["lu-zone", id, analysis?.lat, analysis?.lng],
    enabled:
      !!analysis?.id &&
      analysis?.canton === "LU" &&
      analysis?.lat != null &&
      analysis?.lng != null,
    staleTime: 1000 * 60 * 60 * 24,
    queryFn: async () => {
      const res = await loadLuZoneFn({ data: { analysisId: id } });
      queryClient.invalidateQueries({ queryKey: ["analysis", id] });
      return res;
    },
  });

  if (isLoading) {

    return <div className="mx-auto max-w-7xl p-6 text-sm text-muted-foreground">Lade Analyse …</div>;
  }
  if (!analysis) return null;

  const status = STATUS[analysis.status as string] ?? { label: analysis.status as string, variant: "secondary" as const };
  const isProcessing = analysis.status === "processing";
  const potential = analysis.potential_level ? POTENTIAL[analysis.potential_level] : null;
  const risks: Risk[] = Array.isArray(analysis.risks) ? (analysis.risks as unknown as Risk[]) : [];
  const regulations: string[] = Array.isArray(analysis.restrictions) ? (analysis.restrictions as string[]) : [];
  const usageTypes: string[] = Array.isArray(analysis.usage_type) ? (analysis.usage_type as string[]) : [];
  const locationLine = [analysis.postal_code, analysis.municipality, analysis.canton ? `(${analysis.canton})` : null]
    .filter(Boolean).join(" ");

  if (location.pathname.endsWith(`/analysen/${id}/bericht`)) {
    return <Outlet />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link to="/analysen"><ArrowLeft className="mr-1 h-4 w-4" />Alle Analysen</Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="truncate font-display text-3xl font-bold tracking-tight">
                {analysis.address ?? "Ohne Adresse"}
              </h1>
              <Badge variant={status.variant}>
                {isProcessing && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                {status.label}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {locationLine || "—"}
              {analysis.parcel_number && ` · Parzelle ${analysis.parcel_number}`}
              {analysis.area_size && ` · ${analysis.area_size} m²`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => reanalyze.mutate()} disabled={reanalyze.isPending || isProcessing}>
              {reanalyze.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Neu analysieren
            </Button>
            {analysis.canton === "LU" && analysis.lat != null && analysis.lng != null && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const r = await loadLuZoneFn({ data: { analysisId: id } });
                  if ("ok" in r && r.ok) {
                    toast.success("Zonenplandaten aktualisiert", {
                      description: `Zone: ${r.zone.zoneCode ?? "—"} — ${r.zone.zoneLabel ?? "—"}`,
                    });
                    queryClient.invalidateQueries({ queryKey: ["analysis", id] });
                    queryClient.invalidateQueries({ queryKey: ["lu-zone", id] });
                  } else {
                    toast.error("Keine Zone gefunden", {
                      description: `Grund: ${"reason" in r ? r.reason : "unbekannt"}`,
                    });
                  }
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Zonenplan aktualisieren
              </Button>
            )}

            <Button variant="outline" size="sm" asChild>
              <Link to="/analysen/$id/bericht" params={{ id }}>
                <Download className="mr-2 h-4 w-4" />Bericht exportieren
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {isProcessing && (
        <Card className="border-secondary/40 bg-secondary/5">
          <CardContent className="flex items-center gap-3 py-4">
            <Loader2 className="h-5 w-5 animate-spin text-secondary" />
            <div>
              <p className="text-sm font-medium">KI-Auswertung läuft …</p>
              <p className="text-xs text-muted-foreground">Resultate erscheinen automatisch, sobald die Analyse abgeschlossen ist.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {analysis.status === "failed" && analysis.error_message && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Analyse fehlgeschlagen</AlertTitle>
          <AlertDescription>{analysis.error_message as string}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="uebersicht" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:grid-cols-4">
          <TabsTrigger value="uebersicht"><CheckCircle2 className="mr-2 h-4 w-4" />Übersicht</TabsTrigger>
          <TabsTrigger value="recht"><ShieldCheck className="mr-2 h-4 w-4" />Rechtliches</TabsTrigger>
          <TabsTrigger value="projekt"><Building2 className="mr-2 h-4 w-4" />Projekt</TabsTrigger>
          <TabsTrigger value="report"><FileText className="mr-2 h-4 w-4" />Bericht</TabsTrigger>
        </TabsList>

        {/* 1) ÜBERSICHT — Lage, Kennzahlen, KI-Empfehlung, Risiken */}
        <TabsContent value="uebersicht" className="space-y-4">
          {analysis.lat != null && analysis.lng != null && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-lg">
                  <MapPin className="h-4 w-4 text-secondary" />
                  Lage & Parzelle
                </CardTitle>
                <CardDescription>Grundstück, Geometrie und indikatives Baufeld.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <SwissMap
                  mode="readonly"
                  lat={analysis.lat as number}
                  lng={analysis.lng as number}
                  heightClassName="h-72"
                  parcelGeometry={analysis.parcel_geometry as { type: "Polygon"; coordinates: number[][][] } | null}
                  setbacks={analysis.setbacks as { nord?: number | null; ost?: number | null; sued?: number | null; west?: number | null } | null}
                  luZonesAvailable={analysis.canton === "LU"}
                  canton={analysis.canton as string | undefined}

                />

                {analysis.egrid && (
                  <p className="text-xs text-muted-foreground">E-GRID: {analysis.egrid as string}</p>
                )}
                {analysis.parcel_geometry != null && analysis.setbacks != null && (
                  <p className="text-xs text-muted-foreground italic">
                    Das eingezeichnete Baufeld ist eine vereinfachte, indikative Annäherung auf Basis des
                    kleinsten bekannten Grenzabstands — keine rechtsverbindliche Baulinie. Massgebend sind
                    immer die Angaben der zuständigen Gemeinde.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-4">
            <KpiCard icon={Building2} label="Zone" value={analysis.zone ?? "—"} tooltip="Ermittelt aus dem hinterlegten BZR der Gemeinde. Vor Baueingabe amtlich beim Zonenplan der Gemeinde verifizieren." />
            <KpiCard label="Ausnützungsziffer" value={analysis.utilization_ratio?.toString() ?? "—"} />
            <KpiCard label="Max. Geschosse" value={analysis.max_floors?.toString() ?? "—"} />
            <KpiCard label="Max. Höhe" value={analysis.max_height ? `${analysis.max_height} m` : "—"} />
          </div>

          {analysis.canton === "LU" && (
            <LuZonePlanCard zoneResult={zoneResult} loading={zoneLoading} />
          )}

          <DevelopmentScoreCard
            input={{
              zone: analysis.zone,
              utilization_ratio: analysis.utilization_ratio as number | null,
              max_floors: analysis.max_floors as number | null,
              area_size: analysis.area_size as number | null,
              usage_type: analysis.usage_type,
              restrictions: analysis.restrictions,
              special_provisions: analysis.special_provisions as string | null,
              heritage_protected: analysis.heritage_protected as boolean | null,
              design_plan_required: analysis.design_plan_required as boolean | null,
              risks: analysis.risks,
            }}
          />


          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Sparkles className="h-4 w-4 text-secondary" />Was darf gebaut werden?
              </CardTitle>
              <CardDescription>KI-Auswertung basierend auf den erfassten Daten und ggf. dem BZR/BZO-Dokument.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {analysis.feasibility ? (
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{analysis.feasibility}</p>
              ) : (
                <Placeholder text="Noch keine Auswertung verfügbar." />
              )}

              {usageTypes.length > 0 && (
                <div>
                  <p className="text-sm font-medium">Zulässige Nutzungen</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {usageTypes.map((u) => <Badge key={u} variant="secondary">{u}</Badge>)}
                  </div>
                </div>
              )}

              {regulations.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium">Relevante Vorschriften</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {regulations.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <AlertTriangle className="h-4 w-4 text-destructive" />Risiken &amp; Einschränkungen
              </CardTitle>
              <CardDescription>Baurechtliche Einschränkungen, Sondervorschriften, Denkmalschutz, Abstände, Lärm, Gewässer.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {risks.length === 0 ? (
                <Placeholder text="Noch keine Risiken erfasst." />
              ) : risks.map((r, i) => {
                const sev = SEVERITY[r.severity] ?? SEVERITY.low;
                return (
                  <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                    <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-destructive/10 text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{r.title}</p>
                        <Badge variant="outline">{RISK_CATEGORY[r.category] ?? r.category}</Badge>
                        <Badge variant={sev.variant}>{sev.label}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <LegalDisclaimer variant="subtle" className="mt-4" />
        </TabsContent>

        {/* 2) RECHTLICHES — ÖREB, Dienstbarkeiten, Szenario- & Variantenvergleich */}
        <TabsContent value="recht" className="space-y-6">
          <section className="space-y-3">
            <div>
              <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-secondary" />Öffentlich-rechtliche Eigentumsbeschränkungen (ÖREB)
              </h2>
              <p className="text-sm text-muted-foreground">Themen aus dem amtlichen ÖREB-Kataster für die Parzelle.</p>
            </div>
            <OEREBTabContent
              analysisId={analysis.id as string}
              lat={(analysis.lat as number | null) ?? null}
              lng={(analysis.lng as number | null) ?? null}
            />
          </section>

          <Separator />

          <section className="space-y-3">
            <div>
              <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                <ScrollText className="h-4 w-4 text-secondary" />Dienstbarkeiten, Grundlasten & Pfandrechte
              </h2>
              <p className="text-sm text-muted-foreground">Manuelle Erfassung oder KI-Extraktion aus dem Grundbuchauszug.</p>
            </div>
            <EasementsPanel
              analysisId={analysis.id as string}
              organizationId={analysis.organization_id as string}
            />
          </section>

          <Separator />

          <section className="space-y-3">
            <div>
              <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-secondary" />Szenario-Vergleich
              </h2>
              <p className="text-sm text-muted-foreground">Mehrere rechtlich zulässige Nutzungsszenarien nebeneinander rechnen.</p>
            </div>
            <ScenarioComparison
              analysisId={analysis.id as string}
              organizationId={analysis.organization_id as string}
            />
          </section>

          <Separator />

          <section className="space-y-3">
            <div>
              <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-secondary" />Variantenvergleich (Zone-Override)
              </h2>
              <p className="text-sm text-muted-foreground">
                Falls die automatisch erkannte Zone nicht stimmt, hier eine andere Zone testen — die Analyse
                wird mit deren AZ / Höhen / Geschossen neu berechnet.
              </p>
            </div>
            <ZoneOverrideCard
              analysisId={id}
              municipalityName={analysis.municipality}
              cantonCode={analysis.canton}
              detectedZone={analysis.detected_zone}
              zoneOverride={analysis.zone_override}
              currentZone={analysis.zone}
              utilizationRatio={Number(analysis.utilization_ratio ?? 0) || 0}
              onReanalyzed={() => queryClient.invalidateQueries({ queryKey: ["analysis", id] })}
            />
            <UnitsPotential
              areaSize={Number(analysis.area_size ?? 0) || 0}
              utilizationRatio={Number(analysis.utilization_ratio ?? 0) || 0}
              maxFloors={Number(analysis.max_floors ?? 0) || 0}
              floorArea={Number(analysis.floor_area ?? 0) || 0}
              livingArea={Number(analysis.living_area ?? 0) || 0}
              unitCount={Number(analysis.unit_count ?? 0) || 0}
            />
          </section>
        </TabsContent>


        {/* 4) PROJEKT — Projektdaten, Geschosse/Volumen, Pläne */}
        <TabsContent value="projekt" className="space-y-4">
          <ProjectDataCard
            analysis={{
              id: analysis.id as string,
              organization_id: analysis.organization_id as string,
              project_number: (analysis.project_number as string | null) ?? null,
              client_name: (analysis.client_name as string | null) ?? null,
              project_manager: (analysis.project_manager as string | null) ?? null,
              floor_area: (analysis.floor_area as number | null) ?? null,
              living_area: (analysis.living_area as number | null) ?? null,
              unit_count: (analysis.unit_count as number | null) ?? null,
            }}
          />
          <FloorCalculatorCard
            analysis={{
              id: analysis.id as string,
              organization_id: analysis.organization_id as string,
              project_number: null,
              client_name: null,
              project_manager: null,
              floor_area: (analysis.floor_area as number | null) ?? null,
              living_area: (analysis.living_area as number | null) ?? null,
              unit_count: (analysis.unit_count as number | null) ?? null,
            }}
          />
          <DocumentUploadsCard
            analysisId={analysis.id as string}
            organizationId={analysis.organization_id as string}
          />
        </TabsContent>

        {/* 4) BERICHT — inline */}
        <TabsContent value="report">
          <AnalysisReport analysisId={id} showToolbar domId={`report-body-${id}`} />
        </TabsContent>
      </Tabs>
    </div>
  );
}


function OEREBTabContent({
  analysisId,
  lat,
  lng,
}: {
  analysisId: string;
  lat: number | null;
  lng: number | null;
}) {
  const loadFn = useServerFn(loadOEREBData);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["oereb", analysisId],
    enabled: lat != null && lng != null,
    staleTime: 1000 * 60 * 30,
    queryFn: () => loadFn({ data: { analysisId } }),
  });

  if (lat == null || lng == null) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Keine Koordinaten vorhanden. Bitte Grundstück über die Kartenansicht auswählen.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <ShieldCheck className="h-4 w-4 text-secondary" />
            Öffentlichrechtliche Eigentumsbeschränkungen
          </CardTitle>
          <CardDescription>
            Automatisch abgerufen vom schweizerischen ÖREB-Kataster (swisstopo).
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
          Aktualisieren
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">ÖREB-Daten werden geladen …</p>}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Fehler beim Laden: {(error as Error).message}</AlertDescription>
          </Alert>
        )}
        {data && <OEREBTopicsTable topics={data.topics} note={data.note} />}
      </CardContent>
    </Card>
  );
}


function KpiCard({
  icon: Icon, label, value, tooltip,
}: { icon?: React.ComponentType<{ className?: string }>; label: string; value: string; tooltip?: string }) {
  return (
    <Card title={tooltip}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent><div className="font-display text-2xl font-bold">{value}</div></CardContent>
    </Card>
  );
}

function Placeholder({ text }: { text: string }) {
  return <p className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">{text}</p>;
}

type AiAnswer = {
  allowed_use: string;
  zone: string;
  max_floors: string;
  max_height: string;
  restrictions: string[];
  development_potential: "low" | "medium" | "high" | "very_high";
  reasoning: string;
};

function AiAnswerCard({ answer }: { answer: AiAnswer | null }) {
  if (!answer) return null;
  const potential = POTENTIAL[answer.development_potential] ?? { label: answer.development_potential, tone: "bg-muted text-foreground" };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <Sparkles className="h-4 w-4 text-secondary" />
          KI-Antwort
        </CardTitle>
        <CardDescription>Strukturierte Antwort des AI Analysis Service.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <KpiCard label="Zone" value={answer.zone || "—"} />
          <KpiCard label="Max. Geschosse" value={answer.max_floors || "—"} />
          <KpiCard label="Max. Höhe" value={answer.max_height || "—"} />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Entwicklungspotenzial</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className={potential.tone}>{potential.label}</Badge>
            </CardContent>
          </Card>
        </div>

        <div>
          <p className="text-sm font-medium">Was darf gebaut werden?</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{answer.allowed_use}</p>
        </div>

        {Array.isArray(answer.restrictions) && answer.restrictions.length > 0 && (
          <div>
            <p className="text-sm font-medium">Einschränkungen</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {answer.restrictions.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        )}

        <Separator />
        <div>
          <p className="text-sm font-medium">Begründung</p>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{answer.reasoning}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function UnitsPotential({
  areaSize,
  utilizationRatio,
  maxFloors,
  floorArea,
  livingArea,
  unitCount,
}: {
  areaSize: number;
  utilizationRatio: number;
  maxFloors: number;
  floorArea: number;
  livingArea: number;
  unitCount: number;
}) {
  const SIZES = [
    { key: "klein", label: "Klein", area: 60, description: "1–2 Zimmer · Studios" },
    { key: "mittel", label: "Mittel", area: 85, description: "3–4 Zimmer · Familien" },
    { key: "gross", label: "Gross", area: 120, description: "4.5–5.5 Zimmer · Premium" },
  ] as const;

  const computedFloor = floorArea > 0 ? floorArea : areaSize > 0 && utilizationRatio > 0 ? areaSize * utilizationRatio : 0;
  const computedLiving = livingArea > 0 ? livingArea : computedFloor * 0.8;
  const computedUnits = unitCount > 0 ? unitCount : computedLiving > 0 ? Math.round(computedLiving / 90) : 0;
  const ready = computedLiving > 0;

  const variants = SIZES.map((s) => ({ ...s, units: ready ? Math.floor(computedLiving / s.area) : 0 }));
  let recommended = variants[1];
  if (ready) {
    if (computedLiving < 400) recommended = variants[0];
    else if (computedLiving > 2500) recommended = variants[2];
  }

  const fmt = (n: number) => new Intl.NumberFormat("de-CH", { maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard icon={Building2} label="Geschossfläche" value={ready ? `${fmt(computedFloor)} m²` : "—"} />
        <KpiCard icon={Home} label="Wohnfläche (potenziell)" value={ready ? `${fmt(computedLiving)} m²` : "—"} />
        <KpiCard icon={Home} label="Anzahl Wohnungen" value={ready ? computedUnits.toString() : "—"} />
      </div>

      {!ready && (
        <Placeholder text="Wohnungspotenzial kann erst berechnet werden, wenn Grundstücksfläche und Ausnützungsziffer bekannt sind." />
      )}

      {ready && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Wohnungsvarianten</CardTitle>
            <CardDescription>
              Berechnet aus {fmt(areaSize)} m² × AZ {utilizationRatio}
              {maxFloors > 0 ? ` · ${maxFloors} Vollgeschosse` : ""} · 80% Nettowohnfläche · ø 90 m²/WHG
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            {variants.map((v) => {
              const isRec = v.key === recommended.key;
              return (
                <div
                  key={v.key}
                  className={`relative rounded-lg border p-4 transition ${isRec ? "border-primary bg-primary/5" : "bg-card"}`}
                >
                  {isRec && (
                    <Badge className="absolute -top-2 right-3" variant="default">Empfehlung</Badge>
                  )}
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Variante {v.label}
                  </div>
                  <div className="mt-1 font-display text-3xl font-bold tabular-nums">{v.units}</div>
                  <div className="mt-0.5 text-sm text-muted-foreground">Wohnungen à {v.area} m²</div>
                  <div className="mt-3 text-xs text-muted-foreground">{v.description}</div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ZoneOverrideCard({
  analysisId,
  municipalityName,
  cantonCode,
  detectedZone,
  zoneOverride,
  currentZone,
  utilizationRatio,
  onReanalyzed,
}: {
  analysisId: string;
  municipalityName: string | null;
  cantonCode: string | null;
  detectedZone: string | null;
  zoneOverride: string | null;
  currentZone: string | null;
  utilizationRatio: number;
  onReanalyzed: () => void;
}) {
  const analyzeFn = useServerFn(runKnowledgeAnalysis);

  // Load available zones from the municipality knowledge base.
  const zonesQ = useQuery({
    queryKey: ["kb-zones", municipalityName, cantonCode],
    enabled: !!municipalityName && !!cantonCode,
    queryFn: async () => {
      let muniQ = supabase
        .from("municipalities")
        .select("id, cantons!inner(code)")
        .ilike("name", (municipalityName ?? "").trim());
      if (cantonCode) muniQ = muniQ.eq("cantons.code", cantonCode);
      const { data: munis } = await muniQ.limit(1);
      const muniId = munis?.[0]?.id;
      if (!muniId) return [] as string[];
      const { data: rules } = await supabase
        .from("regulation_rules")
        .select("zone")
        .eq("municipality_id", muniId)
        .not("zone", "is", null);
      const set = new Set<string>();
      for (const r of rules ?? []) if (r.zone) set.add(r.zone);
      return [...set].sort();
    },
    staleTime: 60_000,
  });

  const reanalyze = useMutation({
    mutationFn: async (selectedZone: string | null) => {
      const { error } = await supabase
        .from("analyses")
        .update({ zone_override: selectedZone, status: "processing", error_message: null })
        .eq("id", analysisId);
      if (error) throw error;
      await analyzeFn({ data: { analysisId } });
    },
    onSuccess: () => {
      toast.success("Analyse mit neuer Zone neu berechnet");
      onReanalyzed();
    },
    onError: (e: Error) => toast.error("Fehler", { description: e.message }),
  });

  const needsHelp = utilizationRatio <= 0;
  const activeZone = zoneOverride ?? currentZone ?? detectedZone ?? null;

  return (
    <Card className={needsHelp ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20" : ""}>
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-base flex items-center gap-2">
          <Building2 className="h-4 w-4 text-secondary" />
          Bauzone {needsHelp ? "— bitte präzisieren" : "anpassen"}
        </CardTitle>
        <CardDescription>
          {needsHelp
            ? "Das Wohnungspotenzial konnte nicht berechnet werden, weil keine Ausnützungsziffer für die Zone ermittelt wurde. Wähle die korrekte Zone aus der Wissensdatenbank, um die Auswertung neu zu starten."
            : "Falls die automatisch erkannte Zone nicht stimmt, wähle hier die korrekte Zone aus der Wissensdatenbank."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
          <InfoLine label="Automatisch erkannt (swisstopo)" value={detectedZone ?? "—"} />
          <InfoLine label="Manuell überschrieben" value={zoneOverride ?? "—"} />
          <InfoLine label="Aktiv in Analyse" value={activeZone ?? "—"} />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            value={zoneOverride ?? "__auto__"}
            onValueChange={(v) => reanalyze.mutate(v === "__auto__" ? null : v)}
            disabled={reanalyze.isPending || zonesQ.isLoading}
          >
            <SelectTrigger className="sm:max-w-xs">
              <SelectValue placeholder="Zone wählen …" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__auto__">Automatisch (swisstopo)</SelectItem>
              {(zonesQ.data ?? []).map((z) => (
                <SelectItem key={z} value={z}>{z}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {reanalyze.isPending && (
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Analyse läuft …
            </span>
          )}
        </div>
        {!zonesQ.isLoading && (zonesQ.data ?? []).length === 0 && (
          <p className="text-xs text-muted-foreground">
            Keine Zonen in der Wissensdatenbank dieser Gemeinde gefunden.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background/50 p-2">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="truncate text-sm" title={value}>{value}</div>
    </div>
  );
}

type LuZoneResult = Awaited<ReturnType<typeof loadLuZonePlanForAnalysis>>;

function LuZonePlanCard({
  zoneResult,
  loading,
}: {
  zoneResult: LuZoneResult | undefined;
  loading: boolean;
}) {
  const z = zoneResult && zoneResult.ok === true ? zoneResult.zone : null;
  const rows: [string, string][] = z
    ? ([
        ["Zone", [z.zoneCode, z.zoneLabel].filter(Boolean).join(" — ") || "—"],
        ["Kategorie", z.zoneCategory ?? "—"],
        ["Ausnützungsziffer (AZ)", z.az?.toString() ?? "—"],
        ["Überbauungsziffer (ÜZ) max.", z.uezMax?.toString() ?? "—"],
        ["Überbauungsziffer (ÜZ) min.", z.uezMin?.toString() ?? "—"],
        ["Geschosszahl", z.floors ? `${z.floors} Vollgeschosse` : "—"],
        ["Gesamthöhe max.", z.heightMax ? `${z.heightMax} m` : "—"],
        ["Fassadenhöhe max.", z.facadeHeightMax ? `${z.facadeHeightMax} m` : "—"],
        ["Gebäudelänge max.", z.buildingLength ? `${z.buildingLength} m` : "—"],
        ["Grünflächenziffer", z.greenAreaRatio?.toString() ?? "—"],
        ["Lärmempfindlichkeit", z.noiseClass ?? "—"],
        ["Bauweise", z.buildingType ?? "—"],
        [
          "Wohnanteil max.",
          z.residentialShareMax != null ? `${Math.round(z.residentialShareMax * 100)} %` : "—",
        ],
        [
          "Gewerbeanteil max.",
          z.commercialShareMax != null ? `${Math.round(z.commercialShareMax * 100)} %` : "—",
        ],
        ["BZR-Artikel", z.bzrArticle ?? "—"],
        [
          "Inkraftsetzung",
          z.validFrom ? new Date(z.validFrom).toLocaleDateString("de-CH") : "—",
        ],
      ].filter(([, v]) => v !== "—") as [string, string][])
    : [];

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Zonenplan Kanton Luzern
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          <Badge variant="outline" className="ml-1 text-[10px]">rechtsverbindlich</Badge>
        </CardTitle>
        <CardDescription>
          Rechtsverbindliche Daten aus dem kantonalen Geodatensatz (ZPGNDNTZ, täglich aktualisiert,
          Quelle: Raumdatenpool Kanton Luzern).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {zoneResult?.ok === false && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {zoneResult.reason === "no_coordinates" &&
                "Keine Koordinaten — Grundstück auf der Karte auswählen."}
              {zoneResult.reason === "no_zone_found" &&
                "Für diesen Standort wurde keine Bauzone im Luzerner Zonenplan gefunden."}
              {zoneResult.reason === "wrong_canton" &&
                "Zonenplan-Abfrage nur für Grundstücke im Kanton Luzern verfügbar."}
            </AlertDescription>
          </Alert>
        )}
        {z && (
          <div className="grid gap-2 sm:grid-cols-2">
            {rows.map(([k, v], i) => (
              <div key={i} className="flex items-baseline justify-between gap-3 rounded-md border bg-background/50 px-3 py-2">
                <span className="text-xs text-muted-foreground">{k}</span>
                <span className="text-sm font-medium">{v}</span>
              </div>
            ))}
          </div>
        )}
        {!zoneResult && loading && (
          <p className="text-sm text-muted-foreground">Lade Zonenplan-Daten …</p>
        )}
      </CardContent>
    </Card>
  );
}

