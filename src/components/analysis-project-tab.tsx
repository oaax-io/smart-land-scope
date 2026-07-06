import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Building, Calculator, Download, FileUp, Loader2, Plus, Save, Trash2, UploadCloud,
} from "lucide-react";

type AnalysisLite = {
  id: string;
  organization_id: string;
  project_number: string | null;
  client_name: string | null;
  project_manager: string | null;
  floor_area: number | null;
  living_area: number | null;
  unit_count: number | null;
};

/* ---------------- Project Data Card ---------------- */

export function ProjectDataCard({ analysis }: { analysis: AnalysisLite }) {
  const qc = useQueryClient();
  const [values, setValues] = useState({
    project_number: analysis.project_number ?? "",
    client_name: analysis.client_name ?? "",
    project_manager: analysis.project_manager ?? "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValues({
      project_number: analysis.project_number ?? "",
      client_name: analysis.client_name ?? "",
      project_manager: analysis.project_manager ?? "",
    });
  }, [analysis.id, analysis.project_number, analysis.client_name, analysis.project_manager]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("analyses")
      .update({
        project_number: values.project_number || null,
        client_name: values.client_name || null,
        project_manager: values.project_manager || null,
      })
      .eq("id", analysis.id);
    setSaving(false);
    if (error) return toast.error("Speichern fehlgeschlagen", { description: error.message });
    toast.success("Projektdaten gespeichert");
    qc.invalidateQueries({ queryKey: ["analysis", analysis.id] });
  };

  const fields: Array<{ label: string; key: keyof typeof values; placeholder: string }> = [
    { label: "Projektnummer", key: "project_number", placeholder: "z. B. 2026-014" },
    { label: "Auftraggeber", key: "client_name", placeholder: "Name des Kunden" },
    { label: "Projektleiter", key: "project_manager", placeholder: "Verantwortliche Person" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <Building className="h-4 w-4 text-secondary" />
          Projektdaten
        </CardTitle>
        <CardDescription>Stammdaten für Berichts-Kopf und Akten-Referenz.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        {fields.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={f.key}>{f.label}</Label>
            <Input
              id={f.key}
              value={values[f.key]}
              placeholder={f.placeholder}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              onBlur={save}
            />
          </div>
        ))}
        <div className="md:col-span-3 flex justify-end">
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Speichern
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- Floor Calculator ---------------- */

type Floor = {
  id: string;
  floor_index: number;
  floor_label: string;
  gross_area_m2: number | null;
  floor_height_m: number;
  volume_m3: number | null;
};

type Unit = {
  id: string;
  floor_index: number;
  unit_label: string;
  unit_type: string;
  area_m2: number;
};

const DEFAULT_FLOORS: Array<Omit<Floor, "id" | "volume_m3">> = [
  { floor_index: -1, floor_label: "Untergeschoss", gross_area_m2: null, floor_height_m: 2.6 },
  { floor_index: 0, floor_label: "Erdgeschoss", gross_area_m2: null, floor_height_m: 3.0 },
  { floor_index: 1, floor_label: "1. Obergeschoss", gross_area_m2: null, floor_height_m: 2.85 },
];

export function FloorCalculatorCard({
  analysis,
  onCalcChange,
}: {
  analysis: AnalysisLite;
  onCalcChange?: (bgfM2: number, volumenM3: number) => void;
}) {
  const qc = useQueryClient();
  const { data: floors = [], refetch: refetchFloors } = useQuery({
    queryKey: ["analysis-floors", analysis.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analysis_floors")
        .select("*")
        .eq("analysis_id", analysis.id)
        .order("floor_index", { ascending: true });
      if (error) throw error;
      return data as Floor[];
    },
  });
  const { data: units = [], refetch: refetchUnits } = useQuery({
    queryKey: ["analysis-units", analysis.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analysis_units")
        .select("*")
        .eq("analysis_id", analysis.id)
        .order("floor_index", { ascending: true });
      if (error) throw error;
      return data as Unit[];
    },
  });

  // Seed defaults the first time
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (floors.length === 0) {
      seededRef.current = true;
      (async () => {
        await supabase.from("analysis_floors").insert(
          DEFAULT_FLOORS.map((f) => ({
            ...f,
            analysis_id: analysis.id,
            organization_id: analysis.organization_id,
          })),
        );
        refetchFloors();
      })();
    }
  }, [floors.length, analysis.id, analysis.organization_id, refetchFloors]);

  const totalArea = useMemo(
    () => floors.reduce((s, f) => s + (Number(f.gross_area_m2) || 0), 0),
    [floors],
  );
  const totalVolume = useMemo(
    () =>
      floors.reduce(
        (s, f) => s + (Number(f.gross_area_m2) || 0) * (Number(f.floor_height_m) || 0),
        0,
      ),
    [floors],
  );
  const totalUnitArea = useMemo(
    () => units.reduce((s, u) => s + (Number(u.area_m2) || 0), 0),
    [units],
  );

  useEffect(() => {
    onCalcChange?.(totalArea, totalVolume);
  }, [totalArea, totalVolume, onCalcChange]);

  const debouncers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const debounceUpdate = (id: string, patch: Partial<Floor>) => {
    if (debouncers.current[id]) clearTimeout(debouncers.current[id]);
    debouncers.current[id] = setTimeout(async () => {
      await supabase.from("analysis_floors").update(patch).eq("id", id);
      refetchFloors();
    }, 600);
  };
  const debounceUpdateUnit = (id: string, patch: Partial<Unit>) => {
    if (debouncers.current[id]) clearTimeout(debouncers.current[id]);
    debouncers.current[id] = setTimeout(async () => {
      await supabase.from("analysis_units").update(patch).eq("id", id);
      refetchUnits();
    }, 600);
  };

  const addFloor = async () => {
    const nextIdx = floors.length ? Math.max(...floors.map((f) => f.floor_index)) + 1 : 0;
    await supabase.from("analysis_floors").insert({
      analysis_id: analysis.id,
      organization_id: analysis.organization_id,
      floor_index: nextIdx,
      floor_label: `${nextIdx}. Obergeschoss`,
      gross_area_m2: null,
      floor_height_m: 2.85,
    });
    refetchFloors();
  };
  const removeFloor = async (id: string) => {
    await supabase.from("analysis_floors").delete().eq("id", id);
    refetchFloors();
  };
  const addUnit = async () => {
    const idx = floors[0]?.floor_index ?? 0;
    await supabase.from("analysis_units").insert({
      analysis_id: analysis.id,
      organization_id: analysis.organization_id,
      floor_index: idx,
      unit_label: "Neue Wohnung",
      unit_type: "3.5 Zi.",
      area_m2: 0,
    });
    refetchUnits();
  };
  const removeUnit = async (id: string) => {
    await supabase.from("analysis_units").delete().eq("id", id);
    refetchUnits();
  };

  const applyToAnalysis = async () => {
    const { error } = await supabase
      .from("analyses")
      .update({
        floor_area: Math.round(totalArea),
        living_area: Math.round(totalArea * 0.8),
        unit_count: units.length,
      })
      .eq("id", analysis.id);
    if (error) return toast.error("Fehler", { description: error.message });
    toast.success("In Analyse übernommen", {
      description: `GF ${Math.round(totalArea)} m² · ${units.length} WE`,
    });
    qc.invalidateQueries({ queryKey: ["analysis", analysis.id] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <Calculator className="h-4 w-4 text-secondary" />
          Geschoss- &amp; Volumenrechner
        </CardTitle>
        <CardDescription>
          Parametrische Berechnung von Bruttogeschossfläche (BGF) und Volumen pro Geschoss.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Floors table */}
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Geschoss</th>
                <th className="px-3 py-2 text-left">Bezeichnung</th>
                <th className="px-3 py-2 text-right">BGF (m²)</th>
                <th className="px-3 py-2 text-right">Höhe (m)</th>
                <th className="px-3 py-2 text-right">Volumen (m³)</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {floors.map((f) => {
                const vol = (Number(f.gross_area_m2) || 0) * (Number(f.floor_height_m) || 0);
                return (
                  <tr key={f.id} className="border-t">
                    <td className="px-3 py-2 w-20">
                      <Input
                        type="number"
                        defaultValue={f.floor_index}
                        className="h-8"
                        onChange={(e) =>
                          debounceUpdate(f.id, { floor_index: Number(e.target.value) })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        defaultValue={f.floor_label}
                        className="h-8"
                        onChange={(e) => debounceUpdate(f.id, { floor_label: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        defaultValue={f.gross_area_m2 ?? ""}
                        className="h-8 text-right"
                        onChange={(e) =>
                          debounceUpdate(f.id, {
                            gross_area_m2: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        step="0.05"
                        defaultValue={f.floor_height_m}
                        className="h-8 text-right"
                        onChange={(e) =>
                          debounceUpdate(f.id, { floor_height_m: Number(e.target.value) })
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {vol ? Math.round(vol).toLocaleString("de-CH") : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeFloor(f.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t bg-muted/20 font-medium">
              <tr>
                <td colSpan={2} className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {Math.round(totalArea).toLocaleString("de-CH")} m²
                </td>
                <td></td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {Math.round(totalVolume).toLocaleString("de-CH")} m³
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" size="sm" onClick={addFloor}>
            <Plus className="mr-2 h-4 w-4" />Geschoss hinzufügen
          </Button>
          <p className="text-xs text-muted-foreground">
            Indikative Volumenberechnung – kein Ersatz für ein CAD-Programm.
          </p>
        </div>

        {/* Units table */}
        <div className="space-y-3">
          <h3 className="font-display text-sm font-semibold">Wohnungsindex</h3>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Geschoss</th>
                  <th className="px-3 py-2 text-left">Bezeichnung</th>
                  <th className="px-3 py-2 text-left">Typ</th>
                  <th className="px-3 py-2 text-right">Fläche (m²)</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {units.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-xs text-muted-foreground">
                      Noch keine Wohnungen erfasst.
                    </td>
                  </tr>
                )}
                {units.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="px-3 py-2 w-20">
                      <Input
                        type="number"
                        defaultValue={u.floor_index}
                        className="h-8"
                        onChange={(e) =>
                          debounceUpdateUnit(u.id, { floor_index: Number(e.target.value) })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        defaultValue={u.unit_label}
                        className="h-8"
                        onChange={(e) => debounceUpdateUnit(u.id, { unit_label: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2 w-40">
                      <Select
                        defaultValue={u.unit_type}
                        onValueChange={(v) => debounceUpdateUnit(u.id, { unit_type: v })}
                      >
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["1.5 Zi.", "2.5 Zi.", "3.5 Zi.", "4.5 Zi.", "5.5 Zi.", "Atelier", "Gewerbe"].map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        defaultValue={u.area_m2}
                        className="h-8 text-right"
                        onChange={(e) =>
                          debounceUpdateUnit(u.id, { area_m2: Number(e.target.value) })
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeUnit(u.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-muted/20 font-medium">
                <tr>
                  <td colSpan={3} className="px-3 py-2">Total ({units.length} WE)</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {Math.round(totalUnitArea).toLocaleString("de-CH")} m²
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <Button variant="outline" size="sm" onClick={addUnit}>
            <Plus className="mr-2 h-4 w-4" />Wohnung hinzufügen
          </Button>
        </div>

        <div className="flex justify-end border-t pt-4">
          <Button onClick={applyToAnalysis}>
            <Save className="mr-2 h-4 w-4" />In Analyse übernehmen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- Wirtschaftlichkeit ---------------- */

const CHF = (n: number) =>
  new Intl.NumberFormat("de-CH", { maximumFractionDigits: 0 }).format(Math.round(n));

export function WirtschaftlichkeitCard({
  bgfM2,
  volumenM3,
}: {
  analysis: AnalysisLite;
  bgfM2: number;
  volumenM3: number;
}) {
  const [params, setParams] = useState({
    kostenOberirdischProM3: 950,
    kostenUGProM3: 550,
    ugAnteil: 0.25,
    siaHonorareMin: 12,
    siaHonorareMax: 15,
    bkp5Min: 3,
    bkp5Max: 5,
    bkp6Min: 5,
    bkp6Max: 8,
    nwfFaktor: 0.8,
    marktpreisProM2: 8500,
  });

  const setP = (key: keyof typeof params, value: number) =>
    setParams((p) => ({ ...p, [key]: Number.isFinite(value) ? value : 0 }));

  const volOberirdisch = volumenM3;
  const volUG = volOberirdisch * params.ugAnteil;
  const bkp2Oberirdisch = volOberirdisch * params.kostenOberirdischProM3;
  const bkp2UG = volUG * params.kostenUGProM3;
  const bkp2Total = bkp2Oberirdisch + bkp2UG;

  const siaMin = bkp2Total * (params.siaHonorareMin / 100);
  const siaMax = bkp2Total * (params.siaHonorareMax / 100);
  const bkp5Min = bkp2Total * (params.bkp5Min / 100);
  const bkp5Max = bkp2Total * (params.bkp5Max / 100);
  const bkp6Min = bkp2Total * (params.bkp6Min / 100);
  const bkp6Max = bkp2Total * (params.bkp6Max / 100);

  const totalMin = bkp2Total + siaMin + bkp5Min + bkp6Min;
  const totalMax = bkp2Total + siaMax + bkp5Max + bkp6Max;

  const nwf = bgfM2 * params.nwfFaktor;
  const erloes = nwf * params.marktpreisProM2;
  const margeMin = erloes - totalMax;
  const margeMax = erloes - totalMin;
  const ratioMin = totalMin > 0 ? erloes / totalMin : 0;
  const ratioMax = totalMax > 0 ? erloes / totalMax : 0;

  const paramInputs: Array<{
    label: string;
    key: keyof typeof params;
    step?: string;
    suffix?: string;
  }> = [
    { label: "Kosten oberirdisch (BKP 2)", key: "kostenOberirdischProM3", suffix: "CHF/m³" },
    { label: "Kosten Untergeschoss (BKP 2)", key: "kostenUGProM3", suffix: "CHF/m³" },
    { label: "UG-Anteil vom oberirdischen Volumen", key: "ugAnteil", step: "0.05", suffix: "×" },
    { label: "SIA-Honorare Min", key: "siaHonorareMin", suffix: "%" },
    { label: "SIA-Honorare Max", key: "siaHonorareMax", suffix: "%" },
    { label: "Baunebenkosten (BKP 5) Min", key: "bkp5Min", suffix: "%" },
    { label: "Baunebenkosten (BKP 5) Max", key: "bkp5Max", suffix: "%" },
    { label: "Reserve (BKP 6) Min", key: "bkp6Min", suffix: "%" },
    { label: "Reserve (BKP 6) Max", key: "bkp6Max", suffix: "%" },
    { label: "NWF-Faktor (NWF = BGF × Faktor)", key: "nwfFaktor", step: "0.01", suffix: "×" },
    { label: "Marktpreis pro m² NWF", key: "marktpreisProM2", suffix: "CHF/m²" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <Calculator className="h-4 w-4 text-secondary" />
          Wirtschaftlichkeit &amp; Grobkostenschätzung
        </CardTitle>
        <CardDescription>
          Indikative Baukosten (BKP 2 + Honorare + Nebenkosten + Reserve) und Ertragspotenzial
          basierend auf BGF und Volumen aus dem Geschossrechner.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {bgfM2 === 0 && volumenM3 === 0 && (
          <p className="mb-4 rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
            Erfassen Sie zuerst Geschosse im Rechner darüber, damit BGF und Volumen berechnet werden.
          </p>
        )}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Parameter */}
          <div className="space-y-3">
            <h3 className="font-display text-sm font-semibold">Parameter</h3>
            <div className="space-y-2">
              {paramInputs.map((p) => (
                <div key={p.key} className="grid grid-cols-[1fr_auto] items-center gap-2">
                  <Label className="text-xs" htmlFor={`w-${p.key}`}>
                    {p.label}
                  </Label>
                  <div className="flex items-center gap-1">
                    <Input
                      id={`w-${p.key}`}
                      type="number"
                      step={p.step ?? "1"}
                      value={params[p.key]}
                      onChange={(e) => setP(p.key, Number(e.target.value))}
                      className="h-8 w-28 text-right"
                    />
                    {p.suffix && (
                      <span className="w-16 text-xs text-muted-foreground">{p.suffix}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-md border bg-muted/20 p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">BGF (aus Rechner)</span>
                <span className="font-mono tabular-nums">{CHF(bgfM2)} m²</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Volumen oberirdisch</span>
                <span className="font-mono tabular-nums">{CHF(volOberirdisch)} m³</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Volumen UG (berechnet)</span>
                <span className="font-mono tabular-nums">{CHF(volUG)} m³</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nettowohnfläche (NWF)</span>
                <span className="font-mono tabular-nums">{CHF(nwf)} m²</span>
              </div>
            </div>
          </div>

          {/* Ergebnis */}
          <div className="space-y-3">
            <h3 className="font-display text-sm font-semibold">Ergebnis</h3>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Position</th>
                    <th className="px-3 py-2 text-right">Min (CHF)</th>
                    <th className="px-3 py-2 text-right">Max (CHF)</th>
                  </tr>
                </thead>
                <tbody className="[&_tr]:border-t">
                  <tr>
                    <td className="px-3 py-2">BKP 2 oberirdisch</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums" colSpan={2}>
                      {CHF(bkp2Oberirdisch)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">BKP 2 Untergeschoss</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums" colSpan={2}>
                      {CHF(bkp2UG)}
                    </td>
                  </tr>
                  <tr className="bg-muted/20 font-medium">
                    <td className="px-3 py-2">BKP 2 Total</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums" colSpan={2}>
                      {CHF(bkp2Total)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">
                      SIA-Honorare ({params.siaHonorareMin}–{params.siaHonorareMax}%)
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{CHF(siaMin)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{CHF(siaMax)}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">
                      BKP 5 Nebenkosten ({params.bkp5Min}–{params.bkp5Max}%)
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{CHF(bkp5Min)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{CHF(bkp5Max)}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">
                      BKP 6 Reserve ({params.bkp6Min}–{params.bkp6Max}%)
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{CHF(bkp6Min)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{CHF(bkp6Max)}</td>
                  </tr>
                  <tr className="bg-primary/5 font-semibold">
                    <td className="px-3 py-2">Total Investition</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{CHF(totalMin)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{CHF(totalMax)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Ertragspotenzial</th>
                    <th className="px-3 py-2 text-right"></th>
                    <th className="px-3 py-2 text-right"></th>
                  </tr>
                </thead>
                <tbody className="[&_tr]:border-t">
                  <tr>
                    <td className="px-3 py-2">Erlös (NWF × Marktpreis)</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums" colSpan={2}>
                      {CHF(erloes)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Marge (Erlös − Invest.)</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{CHF(margeMin)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{CHF(margeMax)}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">Erlös / Investition</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {ratioMin ? `${ratioMin.toFixed(2)}×` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {ratioMax ? `${ratioMax.toFixed(2)}×` : "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground">
              Grobschätzung nach SIA-Kostenkennwerten. Ersetzt keine Kostenschätzung nach BKP durch
              Architekt/Kostenplaner.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- Document Uploads ---------------- */


const SLOTS: Array<{ kind: string; label: string; hint?: string }> = [
  { kind: "situation", label: "Situation (Katasterplan)" },
  { kind: "umgebung", label: "Umgebung / Lageplan mit Baukörper" },
  { kind: "grundriss", label: "Grundrisse (UG / EG / OG)" },
  { kind: "schnitt", label: "Schnitte" },
  { kind: "fassade", label: "Fassaden (optional)" },
];

type AnalysisDoc = {
  id: string;
  kind: string;
  file_name: string;
  storage_path: string;
  created_at: string;
};

export function DocumentUploadsCard({
  analysisId,
  organizationId,
}: {
  analysisId: string;
  organizationId: string;
}) {
  const { data: docs = [], refetch } = useQuery({
    queryKey: ["analysis-docs", analysisId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analysis_documents")
        .select("id, kind, file_name, storage_path, created_at")
        .eq("analysis_id", analysisId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AnalysisDoc[];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <FileUp className="h-4 w-4 text-secondary" />
          Architekten-Zeichnungen
        </CardTitle>
        <CardDescription>
          Pläne und Schnitte für die Machbarkeitsstudie. Akzeptiert PDF, PNG, JPG.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {SLOTS.map((slot) => (
          <UploadSlot
            key={slot.kind}
            slot={slot}
            analysisId={analysisId}
            organizationId={organizationId}
            docs={docs.filter((d) => d.kind === slot.kind)}
            onChanged={refetch}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function UploadSlot({
  slot,
  analysisId,
  organizationId,
  docs,
  onChanged,
}: {
  slot: { kind: string; label: string };
  analysisId: string;
  organizationId: string;
  docs: AnalysisDoc[];
  onChanged: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | File[]) => {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${organizationId}/${analysisId}/${slot.kind}/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("analysis-documents")
          .upload(path, file, { contentType: file.type || "application/octet-stream" });
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from("analysis_documents").insert({
          analysis_id: analysisId,
          organization_id: organizationId,
          kind: slot.kind as never,
          file_name: file.name,
          size_bytes: file.size,
          mime_type: file.type || null,
          storage_path: path,
        });
        if (insErr) throw insErr;
      }
      toast.success(`${slot.label}: Upload abgeschlossen`);
      onChanged();
    } catch (e) {
      toast.error("Upload fehlgeschlagen", { description: (e as Error).message });
    } finally {
      setUploading(false);
    }
  };

  const download = async (d: AnalysisDoc) => {
    const { data, error } = await supabase.storage
      .from("analysis-documents")
      .createSignedUrl(d.storage_path, 60);
    if (error || !data) return toast.error("Download fehlgeschlagen");
    window.open(data.signedUrl, "_blank");
  };

  const remove = async (d: AnalysisDoc) => {
    await supabase.storage.from("analysis-documents").remove([d.storage_path]);
    await supabase.from("analysis_documents").delete().eq("id", d.id);
    onChanged();
  };

  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-2">
        <p className="text-sm font-medium">{slot.label}</p>
        <span className="text-xs text-muted-foreground">{docs.length} Datei(en)</span>
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInput.current?.click()}
        className={`m-3 cursor-pointer rounded-md border-2 border-dashed px-4 py-6 text-center transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
        }`}
      >
        {uploading ? (
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <UploadCloud className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-1 text-xs text-muted-foreground">
              Drag &amp; Drop oder klicken zum Hochladen
            </p>
          </>
        )}
        <input
          ref={fileInput}
          type="file"
          multiple
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {docs.length > 0 && (
        <ul className="divide-y border-t">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <span className="truncate">{d.file_name}</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => download(d)}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(d)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
