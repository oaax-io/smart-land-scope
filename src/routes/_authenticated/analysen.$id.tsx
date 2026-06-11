import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  Download,
  FileBarChart,
  FileText,
  Info,
  Layers,
  MapPinned,
  ScrollText,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/analysen/$id")({
  head: ({ params }) => ({ meta: [{ title: `Analyse ${params.id.slice(0, 8)} — SmarTerra` }] }),
  component: AnalysisDetailPage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl p-6">
      <p className="text-sm text-destructive">Fehler: {error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl p-6">
      <p className="text-sm text-muted-foreground">Analyse nicht gefunden.</p>
    </div>
  ),
});

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  processing: { label: "In Bearbeitung", variant: "secondary" },
  pending: { label: "Wartend", variant: "secondary" },
  completed: { label: "Abgeschlossen", variant: "default" },
  failed: { label: "Fehlgeschlagen", variant: "destructive" },
};

function AnalysisDetailPage() {
  const { id } = Route.useParams();

  const { data: analysis, isLoading } = useQuery({
    queryKey: ["analysis", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("analyses").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });

  if (isLoading) {
    return <div className="mx-auto max-w-7xl p-6 text-sm text-muted-foreground">Lade Analyse …</div>;
  }
  if (!analysis) return null;

  const status = STATUS[analysis.status as string] ?? { label: analysis.status as string, variant: "secondary" as const };
  const locationLine = [
    analysis.postal_code,
    analysis.municipality,
    analysis.canton ? `(${analysis.canton})` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link to="/analysen">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Alle Analysen
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="truncate font-display text-3xl font-bold tracking-tight">
                {analysis.address ?? "Ohne Adresse"}
              </h1>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {locationLine || "—"}
              {analysis.parcel_number && ` · Parzelle ${analysis.parcel_number}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled>
              <Download className="mr-2 h-4 w-4" />
              Bericht exportieren
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:grid-cols-6">
          <TabsTrigger value="overview"><Info className="mr-2 h-4 w-4" />Übersicht</TabsTrigger>
          <TabsTrigger value="parcel"><MapPinned className="mr-2 h-4 w-4" />Grundstück</TabsTrigger>
          <TabsTrigger value="zone"><Layers className="mr-2 h-4 w-4" />Zone</TabsTrigger>
          <TabsTrigger value="rules"><ScrollText className="mr-2 h-4 w-4" />Reglemente</TabsTrigger>
          <TabsTrigger value="potential"><TrendingUp className="mr-2 h-4 w-4" />Potenzial</TabsTrigger>
          <TabsTrigger value="report"><FileBarChart className="mr-2 h-4 w-4" />Bericht</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard icon={Layers} label="Ausnützungsziffer" value="0.65" hint="Dummy-Daten" />
            <KpiCard icon={Building2} label="Max. Geschosse" value="3" hint="Dummy-Daten" />
            <KpiCard icon={TrendingUp} label="Entwicklungspotenzial" value="Hoch" hint="Dummy-Daten" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Sparkles className="h-4 w-4 text-secondary" />
                KI-Zusammenfassung
              </CardTitle>
              <CardDescription>Generiert auf Basis der erfassten Grundstücksdaten.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Das Grundstück liegt in einer attraktiven Wohnzone mit Ausnützungsziffer 0.65 und
                erlaubt bis zu 3 Vollgeschosse. Die maximale Gebäudehöhe beträgt 11.5 m. Es bestehen
                keine wesentlichen Einschränkungen durch Gewässer-, Wald- oder Lärmschutzauflagen.
                Das Entwicklungspotenzial wird als <span className="font-medium text-foreground">hoch</span> eingeschätzt;
                eine Aufstockung oder Verdichtung wäre wirtschaftlich sinnvoll.
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Hinweis: Diese Auswertung basiert auf Beispieldaten. Die Anbindung an Zonenpläne,
                Reglemente und Geoinformationssysteme erfolgt in einem späteren Schritt.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parcel">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Grundstücksdaten</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                <Row label="Adresse" value={analysis.address} />
                <Row label="PLZ / Ort" value={[analysis.postal_code, analysis.municipality].filter(Boolean).join(" ")} />
                <Row label="Kanton" value={analysis.canton} />
                <Row label="Parzellennummer" value={analysis.parcel_number} />
                <Row label="Grundstücksfläche" value={analysis.area_size ? `${analysis.area_size} m²` : null} />
                <Row label="EGRID" value="CH123456789012 (Dummy)" />
                <Row label="Koordinaten" value="2 683 145 / 1 247 320 (Dummy)" />
                <Row label="Eigentümerschaft" value="Privatperson (Dummy)" />
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="zone">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Zonenzuordnung</CardTitle>
              <CardDescription>Gemäss kommunalem Zonenplan (Dummy).</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                <Row label="Zone" value="Wohnzone W3" />
                <Row label="Ausnützungsziffer" value="0.65" />
                <Row label="Max. Geschosszahl" value="3 Vollgeschosse" />
                <Row label="Max. Gebäudehöhe" value="11.5 m" />
                <Row label="Mindestgrenzabstand" value="4.0 m" />
                <Row label="Empfindlichkeitsstufe Lärm" value="ES II" />
              </dl>
              <Separator className="my-5" />
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <p className="font-medium">Erlaubte Nutzungen</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                  <li>Wohnen (Haupt­nutzung)</li>
                  <li>Mässig störende Gewerbenutzungen im Erdgeschoss</li>
                  <li>Freie Berufe, Praxen, Ateliers</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Reglemente &amp; Einschränkungen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RuleItem
                title="Bau- und Zonenordnung (BZO)"
                description="Letzte Revision: 2021. Definiert Ausnützung, Höhe und Abstände."
              />
              <RuleItem
                title="Gewässerabstand"
                description="Kein Gewässer in 30 m Umkreis — keine Auflagen."
              />
              <RuleItem
                title="Waldabstand"
                description="Kein Waldrand in 30 m Umkreis — keine Auflagen."
              />
              <RuleItem
                title="Ortsbildschutz (ISOS)"
                description="Nicht im ISOS-Perimeter — keine Schutzanforderungen."
              />
              <RuleItem
                title="Denkmalpflege"
                description="Objekt ist nicht inventarisiert."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="potential">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">Maximale Ausnützung</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Grundstücksfläche" value={analysis.area_size ? `${analysis.area_size} m²` : "850 m² (Dummy)"} />
                <Row label="Anrechenbare Fläche" value="850 m²" />
                <Row label="Max. Bruttogeschossfläche" value="552 m²" />
                <Row label="Theoretische Wohneinheiten" value="5 – 6" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">Wirtschaftliches Potenzial</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Geschätzter Landwert" value="CHF 1.7 Mio." />
                <Row label="Realisierungspotenzial" value="CHF 3.4 – 4.2 Mio." />
                <Row label="Empfehlung" value="Verdichtung / Ersatzneubau" />
                <Row label="Risikobewertung" value="Niedrig" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="report">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <FileText className="h-4 w-4 text-secondary" />
                Bericht
              </CardTitle>
              <CardDescription>Ein PDF-Bericht kann generiert werden, sobald die Analyse abgeschlossen ist.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
                <FileBarChart className="h-8 w-8 text-muted-foreground" />
                <p className="mt-3 font-medium">Noch kein Bericht erstellt</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Sobald die KI-Auswertung abgeschlossen ist, können Sie hier einen druckfertigen PDF-Bericht erstellen.
                </p>
                <Button className="mt-4" disabled>
                  <Download className="mr-2 h-4 w-4" />
                  Bericht erstellen
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
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="font-display text-2xl font-bold">{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/50 pb-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value ?? "—"}</dd>
    </div>
  );
}

function RuleItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-secondary/15 text-secondary">
        <ScrollText className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
