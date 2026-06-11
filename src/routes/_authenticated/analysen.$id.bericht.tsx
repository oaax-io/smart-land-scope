import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, FileText, Printer, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { computeDevelopmentScore, SCORE_CATEGORY } from "@/lib/scoring";

export const Route = createFileRoute("/_authenticated/analysen/$id/bericht")({
  head: ({ params }) => ({ meta: [{ title: `Bericht ${params.id.slice(0, 8)} — SmarTerra` }] }),
  component: ReportPage,
});

type Risk = { category?: string; title: string; description: string; severity?: string };

function ReportPage() {
  const { id } = Route.useParams();
  const { data: a, isLoading } = useQuery({
    queryKey: ["analysis", id, "report"],
    queryFn: async () => {
      const { data, error } = await supabase.from("analyses").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Lade Bericht …</div>;
  if (!a) return null;

  const score = computeDevelopmentScore({
    zone: a.zone,
    utilization_ratio: a.utilization_ratio as number | null,
    max_floors: a.max_floors as number | null,
    area_size: a.area_size as number | null,
    usage_type: a.usage_type,
    restrictions: a.restrictions,
    special_provisions: a.special_provisions as string | null,
    heritage_protected: a.heritage_protected as boolean | null,
    design_plan_required: a.design_plan_required as boolean | null,
    risks: a.risks,
  });
  const cat = SCORE_CATEGORY[score.category];
  const risks: Risk[] = Array.isArray(a.risks) ? (a.risks as unknown as Risk[]) : [];
  const usages: string[] = Array.isArray(a.usage_type) ? (a.usage_type as string[]) : [];
  const restrictions: string[] = Array.isArray(a.restrictions) ? (a.restrictions as string[]) : [];

  const summary =
    a.ai_summary ||
    `Das Grundstück an ${a.address ?? "—"} in ${a.municipality ?? "—"} (${a.canton ?? "—"}) ` +
    `umfasst ${a.area_size ?? "—"} m² in der Zone ${a.zone ?? "—"}. ` +
    `Mit einer Ausnützungsziffer von ${a.utilization_ratio ?? "—"} und ${a.max_floors ?? "—"} ` +
    `Vollgeschossen erreicht das Objekt einen Entwicklungs-Score von ${score.score}/100 (${score.categoryLabel}). ` +
    `${score.recommendation}`;

  const exportWord = () => {
    const html = document.getElementById("report-body")?.outerHTML ?? "";
    const doc = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Analysebericht</title><style>body{font-family:Calibri,Arial,sans-serif;color:#111;}h1{font-size:22pt;margin-bottom:4pt}h2{font-size:14pt;border-bottom:1px solid #888;padding-bottom:2pt;margin-top:18pt}table{border-collapse:collapse;width:100%;margin:6pt 0}td,th{border:1px solid #bbb;padding:6pt;text-align:left;font-size:10pt}.muted{color:#666}.kpi{font-size:18pt;font-weight:bold}</style></head><body>${html}</body></html>`;
    const blob = new Blob(["\ufeff", doc], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Analysebericht-${(a.address ?? "Grundstueck").replace(/\s+/g, "-")}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-5xl">
      {/* Toolbar – hidden in print */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/analysen/$id" params={{ id }}>
            <ArrowLeft className="mr-1 h-4 w-4" />Zur Analyse
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />PDF exportieren
          </Button>
          <Button size="sm" onClick={exportWord}>
            <Download className="mr-2 h-4 w-4" />Word exportieren
          </Button>
        </div>
      </div>

      <article
        id="report-body"
        className="rounded-xl border bg-card p-8 text-card-foreground shadow-sm print:border-0 print:shadow-none print:p-0"
      >
        {/* Header */}
        <header className="mb-8 flex items-start justify-between border-b pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              Machbarkeitsanalyse
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
              Due-Diligence Bericht
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Erstellt am {new Date().toLocaleDateString("de-CH", { day: "2-digit", month: "long", year: "numeric" })}
              {" · "}Referenz {id.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-bold">SmarTerra</p>
            <p className="text-xs text-muted-foreground">Property Intelligence</p>
          </div>
        </header>

        {/* Executive Summary */}
        <Section title="Executive Summary" icon={<Sparkles className="h-4 w-4 text-secondary" />}>
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{summary}</p>
        </Section>

        {/* 1 Grundstück */}
        <Section title="1. Grundstück">
          <DataGrid
            rows={[
              ["Adresse", a.address ?? "—"],
              ["Gemeinde", `${a.postal_code ?? ""} ${a.municipality ?? "—"}`.trim()],
              ["Kanton", a.canton ?? "—"],
              ["Grundstücksfläche", a.area_size ? `${a.area_size} m²` : "—"],
              ["Parzellennummer", a.parcel_number ?? "—"],
            ]}
          />
        </Section>

        {/* 2 Baurechtliche Analyse */}
        <Section title="2. Baurechtliche Analyse">
          <DataGrid
            rows={[
              ["Zone", a.zone ?? "—"],
              ["Zulässige Nutzungen", usages.length ? usages.join(", ") : "—"],
              ["Max. Geschossigkeit", a.max_floors ? `${a.max_floors} Vollgeschosse` : "—"],
              ["Max. Gebäudehöhe", a.max_height ? `${a.max_height} m` : "—"],
              ["Ausnützungsziffer", a.utilization_ratio?.toString() ?? "—"],
              ["Überbauungsziffer", a.building_coverage_ratio?.toString() ?? "—"],
            ]}
          />
          {restrictions.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold">Relevante Vorschriften</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-foreground/80">
                {restrictions.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}
        </Section>

        {/* 3 Wohnungsanalyse */}
        <Section title="3. Wohnungsanalyse">
          <div className="grid grid-cols-3 gap-4">
            <Kpi label="Max. Geschossfläche" value={a.floor_area ? `${Math.round(Number(a.floor_area))} m²` : "—"} />
            <Kpi label="Geschätzte Wohnfläche" value={a.living_area ? `${Math.round(Number(a.living_area))} m²` : "—"} />
            <Kpi label="Wohnungsanzahl" value={a.unit_count?.toString() ?? "—"} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Berechnung auf Basis Grundstücksfläche × Ausnützungsziffer; Wohnfläche ≈ 80 % der Geschossfläche.
          </p>
        </Section>

        {/* 4 Entwicklungspotenzial */}
        <Section title="4. Entwicklungspotenzial">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-5xl font-bold text-primary">{score.score}</span>
              <span className="text-lg text-muted-foreground">/ 100</span>
            </div>
            <Badge className={cat.tone}>{cat.label} ({cat.range})</Badge>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-foreground/90">{score.reasoning}</p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-semibold text-primary">Chancen</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-foreground/80">
                {score.opportunities.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-destructive">Bewertungs-Risiken</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-foreground/80">
                {score.risks.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          </div>
        </Section>

        {/* 5 Risiken */}
        <Section title="5. Risiken">
          {risks.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Keine spezifischen Risiken erfasst.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Kategorie</th>
                  <th className="py-2 pr-3">Risiko</th>
                  <th className="py-2 pr-3">Beschreibung</th>
                  <th className="py-2">Schwere</th>
                </tr>
              </thead>
              <tbody>
                {risks.map((r, i) => (
                  <tr key={i} className="border-b align-top last:border-0">
                    <td className="py-3 pr-3 text-xs uppercase text-muted-foreground">{r.category ?? "—"}</td>
                    <td className="py-3 pr-3 font-medium">{r.title}</td>
                    <td className="py-3 pr-3 text-foreground/80">{r.description}</td>
                    <td className="py-3"><Badge variant="outline">{r.severity ?? "—"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* 6 KI Empfehlung */}
        <Section title="6. KI-Empfehlung" icon={<Sparkles className="h-4 w-4 text-secondary" />}>
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-5">
            <p className="text-sm font-semibold text-primary">Empfehlung</p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/90">{score.recommendation}</p>
          </div>
        </Section>

        <footer className="mt-10 border-t pt-4 text-xs text-muted-foreground">
          <p>
            Dieser Bericht wurde automatisch durch SmarTerra generiert. Alle Angaben ohne Gewähr;
            massgebend sind die offiziellen Dokumente der zuständigen Behörden.
          </p>
        </footer>
      </article>

      <style>{`
        @media print {
          @page { size: A4; margin: 18mm; }
          body { background: white !important; }
          aside, nav, header[data-app-topbar], [data-sidebar] { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-8 break-inside-avoid">
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
        {icon}{title}
      </h2>
      {children}
    </section>
  );
}

function DataGrid({ rows }: { rows: [string, string][] }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([k, v], i) => (
            <tr key={k} className={i % 2 ? "bg-muted/30" : ""}>
              <td className="w-1/3 px-4 py-2.5 font-medium text-muted-foreground">{k}</td>
              <td className="px-4 py-2.5 text-foreground">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}
