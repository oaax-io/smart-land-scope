import { createFileRoute, Link, notFound } from "@tanstack/react-router";
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
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { runKnowledgeAnalysis } from "@/lib/analyze-knowledge.functions";
import { DevelopmentScoreCard } from "@/components/development-score-card";
import { SwissMap } from "@/components/swiss-map";

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

      <Tabs defaultValue="feasibility" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:grid-cols-5">
          <TabsTrigger value="feasibility"><CheckCircle2 className="mr-2 h-4 w-4" />Machbarkeit</TabsTrigger>
          <TabsTrigger value="units"><Home className="mr-2 h-4 w-4" />Wohnungspotenzial</TabsTrigger>
          <TabsTrigger value="potential"><TrendingUp className="mr-2 h-4 w-4" />Entwicklung</TabsTrigger>
          <TabsTrigger value="risks"><AlertTriangle className="mr-2 h-4 w-4" />Risiken</TabsTrigger>
          <TabsTrigger value="report"><FileText className="mr-2 h-4 w-4" />Bericht</TabsTrigger>
        </TabsList>

        {/* Machbarkeit */}
        <TabsContent value="feasibility" className="space-y-4">
          {analysis.lat != null && analysis.lng != null && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-lg">
                  <MapPin className="h-4 w-4 text-secondary" />
                  Lage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <SwissMap mode="readonly" lat={analysis.lat as number} lng={analysis.lng as number} heightClassName="h-72" />
                {analysis.egrid && (
                  <p className="text-xs text-muted-foreground">E-GRID: {analysis.egrid as string}</p>
                )}
              </CardContent>
            </Card>
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

          <div className="grid gap-4 md:grid-cols-4">
            <KpiCard icon={Building2} label="Zone" value={analysis.zone ?? "—"} />
            <KpiCard label="Ausnützungsziffer" value={analysis.utilization_ratio?.toString() ?? "—"} />
            <KpiCard label="Max. Geschosse" value={analysis.max_floors?.toString() ?? "—"} />
            <KpiCard label="Max. Höhe" value={analysis.max_height ? `${analysis.max_height} m` : "—"} />
          </div>

          <AiAnswerCard answer={analysis.ai_answer as AiAnswer | null} />




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
        </TabsContent>

        {/* Wohnungspotenzial */}
        <TabsContent value="units" className="space-y-4">
          <UnitsPotential
            areaSize={Number(analysis.area_size ?? 0) || 0}
            utilizationRatio={Number(analysis.utilization_ratio ?? 0) || 0}
            maxFloors={Number(analysis.max_floors ?? 0) || 0}
            floorArea={Number(analysis.floor_area ?? 0) || 0}
            livingArea={Number(analysis.living_area ?? 0) || 0}
            unitCount={Number(analysis.unit_count ?? 0) || 0}
          />
        </TabsContent>


        {/* Entwicklungspotenzial */}
        <TabsContent value="potential" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="font-display text-lg">Entwicklungspotenzial</CardTitle></CardHeader>
            <CardContent>
              {potential ? (
                <div className={`inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium ${potential.tone}`}>
                  <TrendingUp className="mr-2 h-4 w-4" />{potential.label}
                </div>
              ) : <Placeholder text="Wird nach Abschluss der Analyse angezeigt." />}
              {analysis.ai_summary && (
                <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{analysis.ai_summary}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Risiken */}
        <TabsContent value="risks">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Risiken &amp; Einschränkungen</CardTitle>
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
        </TabsContent>

        {/* Bericht */}
        <TabsContent value="report">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <FileText className="h-4 w-4 text-secondary" />Bericht
              </CardTitle>
              <CardDescription>Ein PDF-Bericht kann generiert werden, sobald die Analyse abgeschlossen ist.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <p className="mt-3 font-medium">Professioneller Due-Diligence Bericht</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Inklusive Executive Summary, Baurecht, Wohnungsanalyse, Score &amp; Risiken. Export als PDF oder Word.
                </p>
                <Button className="mt-4" asChild>
                  <Link to="/analysen/$id/bericht" params={{ id }}>
                    <FileText className="mr-2 h-4 w-4" />Bericht öffnen
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({
  icon: Icon, label, value,
}: { icon?: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <Card>
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

