import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileDown, Printer, Sparkles } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { computeDevelopmentScore, SCORE_CATEGORY } from "@/lib/scoring";
import { LegalDisclaimer } from "@/components/legal-disclaimer";
import { RechtlicheGrundlagenTable } from "@/components/rechtliche-grundlagen-table";
import { OEREBTopicsTable } from "@/components/oereb-topics-table";
import { SwissMap } from "@/components/swiss-map";
import { loadOEREBData } from "@/lib/oereb.functions";

type Risk = { category?: string; title: string; description: string; severity?: string };

type Props = {
  analysisId: string;
  /** Wenn true, zeigt die Toolbar mit Print/Word-Buttons oberhalb des Berichts. */
  showToolbar?: boolean;
  /** DOM-ID des Report-Containers — muss eindeutig sein, wenn mehrere Instanzen möglich sind. */
  domId?: string;
};

export function AnalysisReport({ analysisId, showToolbar = true, domId = "report-body" }: Props) {
  const id = analysisId;
  const loadOereb = useServerFn(loadOEREBData);

  const { data: a, isLoading } = useQuery({
    queryKey: ["analysis", id, "report"],
    queryFn: async () => {
      const { data, error } = await supabase.from("analyses").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: floors = [] } = useQuery({
    queryKey: ["analysis-floors", id, "report"],
    queryFn: async () => {
      const { data } = await supabase.from("analysis_floors").select("*").eq("analysis_id", id).order("floor_index", { ascending: true });
      return data ?? [];
    },
  });
  const { data: units = [] } = useQuery({
    queryKey: ["analysis-units", id, "report"],
    queryFn: async () => {
      const { data } = await supabase.from("analysis_units").select("*").eq("analysis_id", id).order("floor_index", { ascending: true });
      return data ?? [];
    },
  });
  const { data: wirtschaft } = useQuery({
    queryKey: ["wirtschaft-report", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("analysis_wirtschaft")
        .select("*")
        .eq("analysis_id", id)
        .maybeSingle();
      return data;
    },
  });
  const { data: archDocuments = [] } = useQuery({
    queryKey: ["analysis-documents", id, "report"],
    queryFn: async () => {
      const { data } = await supabase.from("analysis_documents").select("*").eq("analysis_id", id).order("created_at", { ascending: true });
      return data ?? [];
    },
  });
  const { data: oerebData } = useQuery({
    queryKey: ["oereb", id, "report"],
    staleTime: 1000 * 60 * 30,
    enabled: !!a?.lat && !!a?.lng,
    queryFn: async () => loadOereb({ data: { analysisId: id } }),
  });
  const { data: easements = [] } = useQuery({
    queryKey: ["easements", id, "report"],
    queryFn: async () => {
      const { data } = await supabase.from("analysis_easements").select("*").eq("analysis_id", id).order("easement_type", { ascending: true });
      return (data ?? []) as Array<{
        easement_type: string;
        reg_nr: string | null;
        title: string;
        description: string | null;
        beneficiary: string | null;
        amount_chf: number | null;
        rank: number | null;
        source: string;
      }>;
    },
  });
  const { data: zoneData } = useQuery({
    queryKey: ["zone-extraction", a?.zone, a?.municipality],
    enabled: !!a?.zone && !!a?.municipality,
    queryFn: async () => {
      const { data: muni } = await supabase
        .from("municipalities")
        .select("id")
        .ilike("name", a?.municipality ?? "")
        .limit(1)
        .maybeSingle();
      if (!muni) return null;
      const { data: docs } = await supabase
        .from("regulation_documents")
        .select("id")
        .eq("municipality_id", muni.id)
        .eq("active", true)
        .limit(1);
      if (!docs?.length) return null;
      const { data: extr } = await supabase
        .from("regulation_extractions")
        .select("zones")
        .eq("document_id", docs[0].id)
        .maybeSingle();
      if (!extr?.zones) return null;
      const zones = extr.zones as Array<{ code?: string; name?: string; [key: string]: unknown }>;
      const zKey = (a?.zone ?? "").toLowerCase();
      const match = zones.find(
        (z) => z.code?.toLowerCase() === zKey || z.name?.toLowerCase().includes(zKey),
      );
      return match ?? zones[0] ?? null;
    },
  });

  const { data: docUrls = {} } = useQuery({
    queryKey: ["analysis-document-urls", id, archDocuments.map((d) => d.id).join(",")],
    enabled: archDocuments.length > 0,
    queryFn: async () => {
      const out: Record<string, string> = {};
      await Promise.all(
        archDocuments.map(async (d) => {
          const { data } = await supabase.storage.from("analysis-documents").createSignedUrl(d.storage_path, 60 * 60);
          if (data?.signedUrl) out[d.id] = data.signedUrl;
        }),
      );
      return out;
    },
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Lade Bericht …</div>;
  if (!a) return <div className="p-6 text-sm text-muted-foreground">Analyse nicht gefunden.</div>;

  const chf = (n: number) =>
    n.toLocaleString("de-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 });

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

  const hasSituation = archDocuments.some((d) => d.kind === "situation");
  const hasGrundriss = archDocuments.some((d) => d.kind === "grundriss");
  const hasSchnitt = archDocuments.some((d) => d.kind === "schnitt");

  const toc: Array<[string, string]> = [
    ["1", "Rechtliche Grundlagen"],
    ["2", "ÖREB-Auszug"],
    ["3", "Dienstbarkeiten & Lasten"],
    ["4", "Lage / Situation"],
    ["5", "Wohnungsanalyse"],
    ["6", "Gebäudevolumen"],
    ["7", "Wirtschaftlichkeit & Grobkostenschätzung"],
    ["8", "Baurechtliche Analyse"],
    ["9", "Entwicklungspotenzial"],
    ["10", "Risiken"],
  ];
  if (hasSituation) toc.push(["A1", "Situation (Beilagen)"]);
  if (hasGrundriss) toc.push(["A2", "Grundrisse (Beilagen)"]);
  if (hasSchnitt) toc.push(["A3", "Schnitte (Beilagen)"]);

  const buildReportHtml = () => {
    const body = document.getElementById(domId);
    if (!body) throw new Error("Bericht-Inhalt nicht gefunden");
    const styles = `
      *{box-sizing:border-box}
      body{font-family:Calibri,Arial,sans-serif;color:#111;margin:24px;line-height:1.45}
      h1{font-size:22pt;margin:0 0 8pt}
      h2{font-size:14pt;border-bottom:1px solid #888;padding-bottom:2pt;margin-top:18pt}
      h3{font-size:12pt;margin-top:12pt}
      p{margin:4pt 0}
      table{border-collapse:collapse;width:100%;margin:6pt 0}
      td,th{border:1px solid #bbb;padding:6pt;text-align:left;font-size:10pt;vertical-align:top}
      th{background:#f3f4f6}
      .muted{color:#666}
      .kpi{font-size:18pt;font-weight:bold}
      canvas,iframe{display:none}
      img{max-width:100%}
      .print\\:hidden,[data-print-hide]{display:none !important}
      @media print{@page{size:A4;margin:18mm}}
    `;
    return `<!doctype html><html><head><meta charset="utf-8"><title>Machbarkeitsstudie</title><style>${styles}</style></head><body>${body.outerHTML}</body></html>`;
  };

  const exportPdf = async () => {
    const body = document.getElementById(domId);
    if (!body) {
      toast.error("Bericht-Inhalt nicht gefunden");
      return;
    }
    const toastId = toast.loading("PDF wird generiert…");
    try {
      // Snapshot at higher resolution for crisp text
      const canvas = await html2canvas(body, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: body.scrollWidth,
      });

      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10; // mm
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;

      // Full image height in mm when rendered at usable width
      const imgHeightMm = (canvas.height * usableWidth) / canvas.width;

      // Slice canvas into page-sized chunks so no image is cropped mid-line
      const pageCanvasHeightPx = (usableHeight * canvas.width) / usableWidth;
      let renderedPx = 0;
      let pageIndex = 0;
      while (renderedPx < canvas.height) {
        const sliceHeight = Math.min(pageCanvasHeightPx, canvas.height - renderedPx);
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceHeight;
        const ctx = sliceCanvas.getContext("2d");
        if (!ctx) throw new Error("Canvas-Kontext nicht verfügbar");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(
          canvas,
          0, renderedPx, canvas.width, sliceHeight,
          0, 0, canvas.width, sliceHeight,
        );
        const imgData = sliceCanvas.toDataURL("image/jpeg", 0.92);
        const sliceHeightMm = (sliceHeight * usableWidth) / canvas.width;
        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", margin, margin, usableWidth, sliceHeightMm, undefined, "FAST");
        renderedPx += sliceHeight;
        pageIndex += 1;
      }
      void imgHeightMm;

      const projectRef = (a.project_number as string | null) ?? id.slice(0, 8).toUpperCase();
      const safeAddr = (a.address ?? "Grundstueck").replace(/[^\w\-]+/g, "-");
      pdf.save(`Machbarkeitsstudie-${projectRef}-${safeAddr}.pdf`);
      toast.success("PDF heruntergeladen", { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error("PDF-Export fehlgeschlagen", {
        id: toastId,
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };


  const exportWord = () => {
    try {
      const html = buildReportHtml();
      const doc = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>${html.replace(/^<!doctype html>/i, "")}`;
      const blob = new Blob(["\ufeff", doc], { type: "application/msword" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const projectRef = (a.project_number as string | null) ?? id.slice(0, 8).toUpperCase();
      link.href = url;
      link.download = `Machbarkeitsstudie-${projectRef}-${(a.address ?? "Grundstueck").replace(/\s+/g, "-")}.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Word-Dokument wird heruntergeladen");
    } catch (e) {
      console.error(e);
      toast.error("Word-Export fehlgeschlagen", { description: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <div>
      {showToolbar && (
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={exportPdf}>
            <FileDown className="mr-2 h-4 w-4" />PDF herunterladen
          </Button>
          <Button size="sm" onClick={exportWord}>
            <Download className="mr-2 h-4 w-4" />Word exportieren
          </Button>
        </div>
      )}

      <article
        id={domId}
        className="rounded-xl border bg-card p-8 text-card-foreground shadow-sm print:border-0 print:shadow-none print:p-0"
      >
        {/* Titelblatt */}
        <section className="break-after-page mb-10 flex min-h-[260mm] flex-col justify-between">
          <header className="flex items-start justify-between border-b pb-6">
            <div>
              <p className="font-display text-2xl font-bold">SmarTerra</p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Property Intelligence</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">Machbarkeitsstudie</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {new Date().toLocaleDateString("de-CH", { day: "2-digit", month: "long", year: "numeric" })}
              </p>
            </div>
          </header>

          <div className="my-12">
            <p className="text-sm uppercase tracking-widest text-muted-foreground">
              Projekt {(a.project_number as string | null) ?? "—"}
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold leading-tight tracking-tight">
              {a.address ?? "Grundstücksanalyse"}
            </h1>
            <p className="mt-2 text-base text-muted-foreground">Vorstudie · Stufe Machbarkeit</p>
          </div>

          <div className="grid grid-cols-2 gap-x-10 gap-y-3 border-t pt-6 text-sm">
            <DefRow label="Parzelle" value={a.parcel_number ?? "—"} />
            <DefRow label="Grundstücksfläche" value={a.area_size ? `${a.area_size} m²` : "—"} />
            <DefRow label="Adresse" value={a.address ?? "—"} />
            <DefRow
              label="Gemeinde"
              value={[a.postal_code, a.municipality, a.canton ? `(${a.canton})` : null].filter(Boolean).join(" ")}
            />
            <DefRow label="E-GRID" value={(a.egrid as string | null) ?? "—"} />
            <DefRow label="Auftraggeber" value={(a.client_name as string | null) ?? "—"} />
            <DefRow label="Verantwortlich" value={(a.project_manager as string | null) ?? "—"} />
            <DefRow
              label="Erstellt am"
              value={new Date().toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })}
            />
          </div>
        </section>

        {/* Inhaltsverzeichnis */}
        <section className="break-after-page mb-10">
          <h2 className="mb-4 font-display text-lg font-semibold">Inhaltsverzeichnis</h2>
          <ol className="space-y-1.5 text-sm">
            {toc.map(([nr, label]) => (
              <li key={nr} className="flex items-baseline gap-3 border-b border-dotted py-1">
                <span className="w-8 font-mono text-xs text-muted-foreground">{nr}</span>
                <span className="flex-1">{label}</span>
              </li>
            ))}
          </ol>
        </section>

        <Section title="Executive Summary" icon={<Sparkles className="h-4 w-4 text-secondary" />}>
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{summary}</p>
        </Section>

        <Section title="1. Rechtliche Grundlagen">
          {zoneData ? (
            <RechtlicheGrundlagenTable
              zone={zoneData}
              municipalityName={a.municipality}
              cantonCode={a.canton}
              grundstueckflaeche={a.area_size as number | null}
            />
          ) : (
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
          )}
        </Section>

        <Section title="2. ÖREB-Auszug">
          <OEREBTopicsTable
            topics={oerebData?.topics ?? []}
            note={oerebData?.note ?? "ÖREB-Daten werden geladen oder konnten nicht ermittelt werden."}
          />
        </Section>

        <Section title="3. Dienstbarkeiten & Lasten">
          {easements.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine Dienstbarkeiten erfasst. Vor Projektierung Grundbuchauszug prüfen.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="p-2 font-medium">Typ</th>
                    <th className="p-2 font-medium">Stichwort</th>
                    <th className="p-2 font-medium">Beschreibung</th>
                    <th className="p-2 font-medium">Betr. / Beleg</th>
                    <th className="p-2 font-medium">Betrag</th>
                  </tr>
                </thead>
                <tbody>
                  {easements.map((e, i) => (
                    <tr key={i} className="border-t align-top">
                      <td className="p-2 capitalize">{e.easement_type}</td>
                      <td className="p-2 font-medium">
                        {e.title}
                        {e.reg_nr ? (
                          <span className="ml-1 font-mono text-muted-foreground">({e.reg_nr})</span>
                        ) : null}
                      </td>
                      <td className="p-2 text-muted-foreground">{e.description ?? "—"}</td>
                      <td className="p-2 text-muted-foreground">{e.beneficiary ?? "—"}</td>
                      <td className="p-2">
                        {e.amount_chf != null
                          ? `CHF ${e.amount_chf.toLocaleString("de-CH")} (Pst. ${e.rank ?? "?"})`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Quelle:{" "}
            {easements.some((e) => e.source === "ai")
              ? "KI-Extraktion aus Grundbuchauszug + manuelle Ergänzungen"
              : "Manuelle Erfassung"}
            . Vollständige Rechtsverbindlichkeit nur aus dem originalen Grundbuchauszug.
          </p>
        </Section>

        <Section title="4. Lage / Situation">
          {a.lat != null && a.lng != null ? (
            <div className="overflow-hidden rounded-lg border">
              <SwissMap
                mode="readonly"
                lat={Number(a.lat)}
                lng={Number(a.lng)}
                heightClassName="h-[420px]"
                allowExpand={false}
                parcelGeometry={a.parcel_geometry as never}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Keine Koordinaten — Karte nicht verfügbar.</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Kartengrundlage: © swisstopo (amtliche Vermessung)
          </p>
        </Section>

        <Section title="5. Wohnungsanalyse">
          <div className="grid grid-cols-3 gap-4">
            <Kpi label="Max. Geschossfläche" value={a.floor_area ? `${Math.round(Number(a.floor_area))} m²` : "—"} />
            <Kpi label="Geschätzte Wohnfläche" value={a.living_area ? `${Math.round(Number(a.living_area))} m²` : "—"} />
            <Kpi label="Wohnungsanzahl" value={a.unit_count?.toString() ?? "—"} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Berechnung auf Basis Grundstücksfläche × Ausnützungsziffer; Wohnfläche ≈ 80 % der Geschossfläche.
          </p>

          {units.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold">Wohnungsindex</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Geschoss</th>
                    <th className="py-2 pr-3">Bezeichnung</th>
                    <th className="py-2 pr-3">Typ</th>
                    <th className="py-2 text-right">Fläche (m²)</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="py-2 pr-3">{u.floor_index}</td>
                      <td className="py-2 pr-3">{u.unit_label}</td>
                      <td className="py-2 pr-3">{u.unit_type}</td>
                      <td className="py-2 text-right tabular-nums">{u.area_m2}</td>
                    </tr>
                  ))}
                  <tr className="bg-muted/30 font-medium">
                    <td colSpan={3} className="py-2 pr-3">Total ({units.length} WE)</td>
                    <td className="py-2 text-right tabular-nums">
                      {Math.round(units.reduce((s, u) => s + (Number(u.area_m2) || 0), 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="6. Gebäudevolumen">
          {floors.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Geschoss</th>
                  <th className="py-2 pr-3">Bezeichnung</th>
                  <th className="py-2 pr-3 text-right">BGF (m²)</th>
                  <th className="py-2 pr-3 text-right">Höhe (m)</th>
                  <th className="py-2 text-right">Volumen (m³)</th>
                </tr>
              </thead>
              <tbody>
                {floors.map((f) => {
                  const vol = (Number(f.gross_area_m2) || 0) * (Number(f.floor_height_m) || 0);
                  return (
                    <tr key={f.id} className="border-b last:border-0">
                      <td className="py-2 pr-3">{f.floor_index}</td>
                      <td className="py-2 pr-3">{f.floor_label}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{f.gross_area_m2 ?? "—"}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{f.floor_height_m}</td>
                      <td className="py-2 text-right tabular-nums">{vol ? Math.round(vol) : "—"}</td>
                    </tr>
                  );
                })}
                <tr className="bg-muted/30 font-medium">
                  <td colSpan={2} className="py-2 pr-3">Total</td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {Math.round(floors.reduce((s, f) => s + (Number(f.gross_area_m2) || 0), 0))} m²
                  </td>
                  <td></td>
                  <td className="py-2 text-right tabular-nums">
                    {Math.round(
                      floors.reduce(
                        (s, f) => s + (Number(f.gross_area_m2) || 0) * (Number(f.floor_height_m) || 0),
                        0,
                      ),
                    )}{" "}m³
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Noch keine Geschossdaten erfasst. Im Tab „Projekt" kann der Geschossrechner befüllt werden.
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Indikative Volumenberechnung – kein Ersatz für ein CAD-Programm.
          </p>
        </Section>

        <Section title="7. Wirtschaftlichkeit & Grobkostenschätzung">
          {(() => {
            const floorsBgf = floors.reduce((s, f) => s + (Number(f.gross_area_m2) || 0), 0);
            const floorsVol = floors.reduce(
              (s, f) => s + (Number(f.gross_area_m2) || 0) * (Number(f.floor_height_m) || 0),
              0,
            );
            const hasFloors = floorsBgf > 0;

            // Fallback-Schnellschätzung wenn keine Geschossflächen erfasst
            const grundstueck = Number(a.area_size ?? 0);
            const uez = Number(a.building_coverage_ratio ?? a.utilization_ratio ?? 0);
            const maxH = Number(a.max_height ?? 0);
            const gH = 3.0;
            const bebauteFlaeche = grundstueck * uez;
            const vollgeschosse = gH > 0 ? Math.floor(maxH / gH) : 0;
            const quickBgfOber = bebauteFlaeche * vollgeschosse;
            const quickUgFlaeche = bebauteFlaeche * 1.3;
            const quickBgf = quickBgfOber + quickUgFlaeche;
            const quickVol = quickBgfOber * gH + quickUgFlaeche * gH;
            const canQuick = grundstueck > 0 && uez > 0 && maxH > 0;

            if (!hasFloors && !canQuick) {
              return (
                <p className="text-sm italic text-muted-foreground">
                  Keine Geschossdaten und keine Baurechts-Kennwerte (Grundstückfläche, ÜZ,
                  Gebäudehöhe) verfügbar — Wirtschaftlichkeit kann nicht berechnet werden.
                </p>
              );
            }

            const totalBgf = hasFloors ? floorsBgf : quickBgf;
            const totalVol = hasFloors ? floorsVol : quickVol;
            const mode: "detail" | "quick" = hasFloors ? "detail" : "quick";
            const p = {
              kostenOberirdischProM3: Number(wirtschaft?.kosten_oberirdisch_pro_m3 ?? 950),
              kostenUGProM3: Number(wirtschaft?.kosten_ug_pro_m3 ?? 550),
              siaHonorareMin: Number(wirtschaft?.sia_honorare_min ?? 12),
              siaHonorareMax: Number(wirtschaft?.sia_honorare_max ?? 15),
              bkp5Min: Number(wirtschaft?.bkp5_min ?? 3),
              bkp5Max: Number(wirtschaft?.bkp5_max ?? 5),
              bkp6Min: Number(wirtschaft?.bkp6_min ?? 5),
              bkp6Max: Number(wirtschaft?.bkp6_max ?? 8),
              nwfFaktor: Number(wirtschaft?.nwf_faktor ?? 0.65),
              marktpreisProM2: Number(wirtschaft?.marktpreis_pro_m2 ?? 8500),
              parzellenpreis:
                wirtschaft?.parzellenpreis != null ? Number(wirtschaft.parzellenpreis) : null,
              risikoabschlagProzent: Number(wirtschaft?.risikoabschlag_prozent ?? 15),
              aussenflaecheM2: Number(wirtschaft?.aussenflaeche_m2 ?? 0),
              aussenflaecheAnrechnungsfaktor: Number(
                wirtschaft?.aussenflaeche_anrechnungsfaktor ?? 0.35,
              ),
              sliderBandbreite: Number(wirtschaft?.slider_bandbreite ?? 20),
            };
            // Volumen-Split: Detail = aus Floors, Quick = aus Schnellschätzung
            const volOberFromFloors = floors
              .filter((f) => (Number(f.floor_index) ?? 0) >= 0)
              .reduce((s, f) => s + (Number(f.gross_area_m2) || 0) * (Number(f.floor_height_m) || 0), 0);
            const volUGFromFloors = floors
              .filter((f) => (Number(f.floor_index) ?? 0) < 0)
              .reduce((s, f) => s + (Number(f.gross_area_m2) || 0) * (Number(f.floor_height_m) || 0), 0);
            const volOber = mode === "quick" ? quickBgfOber * gH : volOberFromFloors > 0 ? volOberFromFloors : totalVol;
            const volUG = mode === "quick" ? quickUgFlaeche * gH : volUGFromFloors > 0 ? volUGFromFloors : totalVol * 0.25;
            const bkp2Oberirdisch = volOber * p.kostenOberirdischProM3;
            const bkp2UG = volUG * p.kostenUGProM3;
            const bkp2Total = bkp2Oberirdisch + bkp2UG;
            const siaMin = bkp2Total * (p.siaHonorareMin / 100);
            const siaMax = bkp2Total * (p.siaHonorareMax / 100);
            const bkp5Min = bkp2Total * (p.bkp5Min / 100);
            const bkp5Max = bkp2Total * (p.bkp5Max / 100);
            const bkp6Min = bkp2Total * (p.bkp6Min / 100);
            const bkp6Max = bkp2Total * (p.bkp6Max / 100);
            const totalMin = bkp2Total + siaMin + bkp5Min + bkp6Min;
            const totalMax = bkp2Total + siaMax + bkp5Max + bkp6Max;
            const nwf = totalBgf * p.nwfFaktor;
            const aussenErloes = p.aussenflaecheM2 * p.aussenflaecheAnrechnungsfaktor * p.marktpreisProM2;
            const erloes = nwf * p.marktpreisProM2;
            const erloesMitAussenflaeche = erloes + aussenErloes;
            const margeMin = erloesMitAussenflaeche - totalMax;
            const margeMax = erloesMitAussenflaeche - totalMin;
            const ratioMin = totalMax > 0 ? erloesMitAussenflaeche / totalMax : 0;
            const ratioMax = totalMin > 0 ? erloesMitAussenflaeche / totalMin : 0;
            const residualwert = erloesMitAussenflaeche - (totalMin + totalMax) / 2;
            const residualwertBereinigt = residualwert * (1 - p.risikoabschlagProzent / 100);
            const grundstueckM2 = Number(a.area_size ?? 0);
            const residualwertProM2 = grundstueckM2 > 0 ? residualwert / grundstueckM2 : null;
            const rows: Array<[string, string, string, boolean?]> = [
              ["BKP2 Baukosten oberirdisch", chf(bkp2Oberirdisch), "—"],
              ["BKP2 Baukosten Untergeschoss", chf(bkp2UG), "—"],
              ["BKP2 Total", chf(bkp2Total), "—", true],
              [`SIA-Honorare (${p.siaHonorareMin}–${p.siaHonorareMax}%)`, chf(siaMin), chf(siaMax)],
              [`BKP5 Nebenkosten (${p.bkp5Min}–${p.bkp5Max}%)`, chf(bkp5Min), chf(bkp5Max)],
              [`BKP6 Reserve (${p.bkp6Min}–${p.bkp6Max}%)`, chf(bkp6Min), chf(bkp6Max)],
              ["Total Baukosten", chf(totalMin), chf(totalMax), true],
              ["Nettowohnfläche (NWF)", `${Math.round(nwf)} m²`, "—"],
              ...(p.aussenflaecheM2 > 0
                ? ([[
                    `Aussenflächen (${Math.round(p.aussenflaecheAnrechnungsfaktor * 100)}% von ${Math.round(p.aussenflaecheM2)} m²)`,
                    chf(aussenErloes),
                    "—",
                  ]] as [string, string, string][])
                : []),
              [`Marktpreis ${chf(p.marktpreisProM2)}/m²`, "—", "—"],
              ["Geschätzter Erlös", chf(erloesMitAussenflaeche), "—"],
              ["Marge", chf(margeMin), chf(margeMax), true],
              ["Erlös / Kosten Ratio", ratioMin.toFixed(2), ratioMax.toFixed(2), true],
              ["Residualwert (unbereinigt)", chf(residualwert), "—", true],
              [
                `Risikoabschlag (−${p.risikoabschlagProzent}%)`,
                chf(-(residualwert * p.risikoabschlagProzent) / 100),
                "—",
              ],
              ["Residualwert bereinigt", chf(residualwertBereinigt), "—", true],
              ...(residualwertProM2 != null
                ? ([[
                    "Residualwert / m² Grundstück",
                    `${chf(residualwertProM2)}/m²`,
                    "—",
                  ]] as [string, string, string][])
                : []),
              ...(p.parzellenpreis != null && residualwertBereinigt !== 0
                ? ([[
                    "Angebotspreis Parzelle",
                    chf(p.parzellenpreis),
                    `${(((p.parzellenpreis - residualwertBereinigt) / residualwertBereinigt) * 100).toFixed(1)}%`,
                    true,
                  ]] as [string, string, string, boolean][])
                : []),
            ];
            return (
              <div className="space-y-4 break-inside-avoid">
                {mode === "quick" && (
                  <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                    <strong>Schnellschätzung</strong> auf Basis der Baurechts-Kennwerte
                    (Grundstück {Math.round(grundstueck)} m² · ÜZ {uez} · max. Höhe {maxH} m ·
                    Geschosshöhe {gH} m). Genauigkeit ±25–35%. Für präzise Werte im Projekt-Tab
                    Geschossflächen erfassen.
                  </p>
                )}
                <div className="grid grid-cols-3 gap-3">
                  {(
                    [
                      ["BGF total", `${Math.round(totalBgf)} m²`],
                      ["Volumen oberirdisch", `${Math.round(totalVol)} m³`],
                      ["Nettowohnfläche (NWF)", `${Math.round(nwf)} m²`],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="rounded-lg border bg-muted/30 p-3 text-center">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="mt-0.5 text-lg font-bold">{value}</p>
                    </div>
                  ))}
                </div>

                <table className="w-full overflow-hidden rounded-lg border text-sm break-inside-avoid">
                  <thead>
                    <tr className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2 text-left">Position</th>
                      <th className="px-4 py-2 text-right">Minimum</th>
                      <th className="px-4 py-2 text-right">Maximum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(([label, min, max, bold], i) => (
                      <tr key={label} className={i % 2 ? "bg-muted/20" : ""}>
                        <td className={`px-4 py-2 ${bold ? "font-semibold" : ""}`}>{label}</td>
                        <td className={`px-4 py-2 text-right ${bold ? "font-semibold" : ""}`}>{min}</td>
                        <td className={`px-4 py-2 text-right ${bold ? "font-semibold" : ""}`}>{max}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>


                <div className="rounded-lg border bg-muted/30 p-4 break-inside-avoid">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Residualwert der Parzelle
                  </p>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Residualwert (Erlös − Ø Baukosten)
                      </p>
                      <p className="mt-0.5 text-xl font-bold tabular-nums">{chf(residualwert)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Bereinigt (−{p.risikoabschlagProzent}% Risikoabschlag)
                      </p>
                      <p
                        className={`mt-0.5 text-xl font-bold tabular-nums ${
                          residualwertBereinigt > 0 ? "text-emerald-700" : "text-red-700"
                        }`}
                      >
                        {chf(residualwertBereinigt)}
                      </p>
                    </div>
                    {residualwertProM2 != null && (
                      <div>
                        <p className="text-xs text-muted-foreground">Pro m² Grundstück</p>
                        <p className="mt-0.5 text-sm font-semibold tabular-nums">
                          {chf(residualwertProM2)}/m²
                        </p>
                      </div>
                    )}
                    {p.parzellenpreis != null && (
                      <div>
                        <p className="text-xs text-muted-foreground">Effektiver Angebotspreis</p>
                        <p className="mt-0.5 text-sm font-semibold tabular-nums">
                          {chf(p.parzellenpreis)}
                          {residualwertBereinigt !== 0 && (
                            <span
                              className={`ml-2 text-xs font-medium ${
                                p.parzellenpreis - residualwertBereinigt > 0
                                  ? "text-red-700"
                                  : "text-emerald-700"
                              }`}
                            >
                              {p.parzellenpreis - residualwertBereinigt > 0 ? "+" : ""}
                              {(
                                ((p.parzellenpreis - residualwertBereinigt) /
                                  residualwertBereinigt) *
                                100
                              ).toFixed(1)}
                              %
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Der Residualwert ist der maximal wirtschaftlich vertretbare Parzellenpreis.
                    Der bereinigte Wert berücksichtigt einen Risikoabschlag von{" "}
                    {p.risikoabschlagProzent}% für Unsicherheiten in Bau- und Marktpreisen.
                  </p>

                  {/* Visuelle Preis-Bandbreite */}
                  {(() => {
                    const sliderMin = residualwert * (1 - p.sliderBandbreite / 100);
                    const sliderMax = residualwert * (1 + p.sliderBandbreite / 100);
                    const sliderPosition =
                      p.parzellenpreis != null && sliderMax !== sliderMin
                        ? Math.max(
                            0,
                            Math.min(
                              100,
                              ((p.parzellenpreis - sliderMin) / (sliderMax - sliderMin)) * 100,
                            ),
                          )
                        : null;
                    return (
                      <div className="mt-4 break-inside-avoid">
                        <div className="mb-1.5 flex justify-between text-[10px] text-muted-foreground">
                          <span>{chf(sliderMin)}</span>
                          <span className="font-medium text-foreground">
                            Residualwert: {chf(residualwert)}
                          </span>
                          <span>{chf(sliderMax)}</span>
                        </div>
                        <div
                          className="relative h-5 overflow-hidden rounded-full border"
                          style={{
                            background:
                              "linear-gradient(to right, #ef4444 0%, #f97316 25%, #fbbf24 45%, #d1d5db 50%, #86efac 55%, #22c55e 75%, #16a34a 100%)",
                          }}
                        >
                          <div
                            className="absolute bottom-0 top-0 w-0.5 bg-white/90"
                            style={{ left: "50%", transform: "translateX(-50%)" }}
                          />
                          {sliderPosition != null && (
                            <div
                              className="absolute bottom-0 top-0 flex items-center"
                              style={{
                                left: `${sliderPosition}%`,
                                transform: "translateX(-50%)",
                              }}
                            >
                              <div className="flex h-7 w-3.5 items-center justify-center rounded-sm border border-gray-400 bg-white shadow">
                                <div className="h-3 w-0.5 rounded bg-gray-600" />
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
                          <span>← teurer als Residualwert (unattraktiv)</span>
                          <span>günstiger als Residualwert (attraktiv) →</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>


                <p className="text-xs text-muted-foreground">
                  Baukostenkennwerte: CHF {p.kostenOberirdischProM3}.–/m³ oberirdisch, CHF{" "}
                  {p.kostenUGProM3}.–/m³ UG (Quelle: SIA 416 / kantonale Richtwerte). Marktpreis{" "}
                  {chf(p.marktpreisProM2)}/m² NWF ist ein Platzhalter — vor Baueingabe durch
                  aktuelle Marktanalyse ersetzen.
                </p>
              </div>
            );
          })()}
        </Section>


        <Section title="8. Baurechtliche Analyse">
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

        <Section title="9. Entwicklungspotenzial">
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

        <Section title="10. Risiken">
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

        <Section title="KI-Empfehlung" icon={<Sparkles className="h-4 w-4 text-secondary" />}>
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-5">
            <p className="text-sm font-semibold text-primary">Empfehlung</p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/90">{score.recommendation}</p>
          </div>
        </Section>

        {archDocuments.length > 0 && (
          <Section title="Beilagen — Architekten-Dokumente">
            <div className="space-y-6">
              {archDocuments.map((doc) => {
                const url = docUrls[doc.id];
                const isImage = doc.mime_type?.startsWith("image/");
                return (
                  <div key={doc.id} className="break-inside-avoid rounded-lg border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-semibold">{doc.file_name}</p>
                      <Badge variant="outline" className="uppercase">{doc.kind}</Badge>
                    </div>
                    {isImage && url ? (
                      <img src={url} alt={doc.file_name} className="w-full rounded border bg-muted/20 object-contain" />
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        PDF-Beilage — im Word-Export als Link eingebunden.{" "}
                        {url && (
                          <a href={url} target="_blank" rel="noreferrer" className="text-primary underline">
                            Öffnen ↗
                          </a>
                        )}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        <LegalDisclaimer variant="prominent" className="mt-8" />

        <footer className="mt-6 border-t pt-4 text-xs text-muted-foreground">
          <p>
            Dieser Bericht wurde automatisch durch SmarTerra generiert. Alle Angaben ohne Gewähr;
            massgebend sind die offiziellen Dokumente der zuständigen Behörden.
          </p>
        </footer>
      </article>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 18mm 15mm; }
          body { background: white !important; font-size: 10pt; }
          aside, nav, header[data-app-topbar], [data-sidebar] { display: none !important; }
          .break-after-page { break-after: page; }
          .break-inside-avoid { break-inside: avoid; }
          table { break-inside: avoid; }
          section { break-inside: avoid; }
          img { max-height: 180mm; width: 100%; object-fit: contain; }
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

function DefRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="mt-0.5 font-medium">{value || "—"}</span>
    </div>
  );
}
