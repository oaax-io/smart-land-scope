import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Building, Calculator, Download, FileUp, Loader2, Plus, Save, Trash2, TrendingUp, UploadCloud,
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
  // Live input state (immediate display); debounced state used for calculations
  const [inputs, setInputs] = useState({
    kostenOberirdischProM3: 950,
    kostenUGProM3: 550,
    ugAnteilPct: 25,
    siaMinPct: 12,
    siaMaxPct: 15,
    bkp5MinPct: 3,
    bkp5MaxPct: 5,
    bkp6MinPct: 5,
    bkp6MaxPct: 8,
    marktpreisProM2: 8500,
    nwfFaktorPct: 80,
  });
  const [params, setParams] = useState(inputs);

  useEffect(() => {
    const t = setTimeout(() => setParams(inputs), 500);
    return () => clearTimeout(t);
  }, [inputs]);

  const setI = (key: keyof typeof inputs, value: number) =>
    setInputs((p) => ({ ...p, [key]: Number.isFinite(value) ? value : 0 }));

  const volOberirdisch = volumenM3;
  const volUG = volOberirdisch * (params.ugAnteilPct / 100);
  const bkp2Oberirdisch = volOberirdisch * params.kostenOberirdischProM3;
  const bkp2UG = volUG * params.kostenUGProM3;
  const bkp2Total = bkp2Oberirdisch + bkp2UG;

  const siaMin = bkp2Total * (params.siaMinPct / 100);
  const siaMax = bkp2Total * (params.siaMaxPct / 100);
  const bkp5Min = bkp2Total * (params.bkp5MinPct / 100);
  const bkp5Max = bkp2Total * (params.bkp5MaxPct / 100);
  const bkp6Min = bkp2Total * (params.bkp6MinPct / 100);
  const bkp6Max = bkp2Total * (params.bkp6MaxPct / 100);

  const totalMin = bkp2Total + siaMin + bkp5Min + bkp6Min;
  const totalMax = bkp2Total + siaMax + bkp5Max + bkp6Max;

  const nwf = bgfM2 * (params.nwfFaktorPct / 100);
  const erloes = nwf * params.marktpreisProM2;
  const margeMin = erloes - totalMax; // schlechtester Fall
  const margeMax = erloes - totalMin; // bester Fall
  const ratioMin = totalMax > 0 ? erloes / totalMax : 0;
  const ratioMax = totalMin > 0 ? erloes / totalMin : 0;

  const badge = (() => {
    if (erloes === 0 || totalMin === 0) return null;
    if (margeMax > 0 && ratioMax > 1.3)
      return { label: "Wirtschaftlich attraktiv", tone: "bg-emerald-100 text-emerald-800 border-emerald-200" };
    if (ratioMax >= 1.1 && ratioMax <= 1.3)
      return { label: "Knapp wirtschaftlich", tone: "bg-amber-100 text-amber-800 border-amber-200" };
    if (ratioMax < 1.1)
      return { label: "Wirtschaftlichkeit gefährdet", tone: "bg-red-100 text-red-800 border-red-200" };
    return null;
  })();

  const NumInput = ({
    keyName,
    step = "1",
    className = "w-24",
  }: {
    keyName: keyof typeof inputs;
    step?: string;
    className?: string;
  }) => (
    <Input
      type="number"
      step={step}
      value={inputs[keyName]}
      onChange={(e) => setI(keyName, Number(e.target.value))}
      className={`h-8 text-right ${className}`}
    />
  );

  const Row = ({
    label,
    minValue,
    maxValue,
    strong,
    highlight,
  }: {
    label: string;
    minValue: string;
    maxValue: string;
    strong?: boolean;
    highlight?: boolean;
  }) => (
    <tr
      className={`border-t ${highlight ? "bg-primary/5" : ""} ${strong ? "font-semibold" : ""}`}
    >
      <td className="px-3 py-1.5">{label}</td>
      <td className="px-3 py-1.5 text-right font-mono tabular-nums">{minValue}</td>
      <td className="px-3 py-1.5 text-right font-mono tabular-nums">{maxValue}</td>
    </tr>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <Calculator className="h-4 w-4 text-secondary" />
          Wirtschaftlichkeit &amp; Grobkostenschätzung
        </CardTitle>
        <CardDescription>
          Indikative Baukosten (BKP 2 + Honorare + BKP 5/6) und Ertragspotenzial — basierend auf
          BGF und Volumen aus dem Geschossrechner.
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
          <div className="space-y-4">
            <ParamSection title="Baukosten">
              <ParamRow label="Kosten oberirdisch (CHF/m³)">
                <NumInput keyName="kostenOberirdischProM3" />
              </ParamRow>
              <ParamRow label="Kosten UG (CHF/m³)">
                <NumInput keyName="kostenUGProM3" />
              </ParamRow>
              <ParamRow label="UG-Anteil (% des Volumens)">
                <div className="flex items-center gap-1">
                  <NumInput keyName="ugAnteilPct" className="w-20" />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </ParamRow>
            </ParamSection>

            <ParamSection title="Honorare & Nebenkosten">
              <ParamRow label="SIA-Honorare (%)">
                <div className="flex items-center gap-1">
                  <NumInput keyName="siaMinPct" className="w-16" />
                  <span className="text-xs text-muted-foreground">–</span>
                  <NumInput keyName="siaMaxPct" className="w-16" />
                </div>
              </ParamRow>
              <ParamRow label="BKP5 Baunebenkosten (%)">
                <div className="flex items-center gap-1">
                  <NumInput keyName="bkp5MinPct" className="w-16" />
                  <span className="text-xs text-muted-foreground">–</span>
                  <NumInput keyName="bkp5MaxPct" className="w-16" />
                </div>
              </ParamRow>
              <ParamRow label="BKP6 Reserve (%)">
                <div className="flex items-center gap-1">
                  <NumInput keyName="bkp6MinPct" className="w-16" />
                  <span className="text-xs text-muted-foreground">–</span>
                  <NumInput keyName="bkp6MaxPct" className="w-16" />
                </div>
              </ParamRow>
            </ParamSection>

            <ParamSection title="Ertrag">
              <ParamRow label="Marktpreis NWF (CHF/m²)">
                <NumInput keyName="marktpreisProM2" />
              </ParamRow>
              <ParamRow label="NWF-Faktor (% von BGF)">
                <div className="flex items-center gap-1">
                  <NumInput keyName="nwfFaktorPct" className="w-20" />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </ParamRow>
            </ParamSection>
          </div>

          {/* Ergebnis */}
          <div className="space-y-3">
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Position</th>
                    <th className="px-3 py-2 text-right">Min</th>
                    <th className="px-3 py-2 text-right">Max</th>
                  </tr>
                </thead>
                <tbody>
                  <Row label="BGF (aus Rechner)" minValue={`${CHF(bgfM2)} m²`} maxValue="—" />
                  <Row label="Volumen oberirdisch" minValue={`${CHF(volOberirdisch)} m³`} maxValue="—" />
                  <Row label="Volumen UG" minValue={`${CHF(volUG)} m³`} maxValue="—" />
                  <Row label="BKP2 oberirdisch" minValue={`CHF ${CHF(bkp2Oberirdisch)}`} maxValue="—" strong />
                  <Row label="BKP2 UG" minValue={`CHF ${CHF(bkp2UG)}`} maxValue="—" strong />
                  <Row label="BKP2 Total" minValue={`CHF ${CHF(bkp2Total)}`} maxValue="—" strong highlight />
                  <Row label="SIA-Honorare" minValue={`CHF ${CHF(siaMin)}`} maxValue={`CHF ${CHF(siaMax)}`} />
                  <Row label="BKP5 Nebenkosten" minValue={`CHF ${CHF(bkp5Min)}`} maxValue={`CHF ${CHF(bkp5Max)}`} />
                  <Row label="BKP6 Reserve" minValue={`CHF ${CHF(bkp6Min)}`} maxValue={`CHF ${CHF(bkp6Max)}`} />
                  <Row label="Total Baukosten" minValue={`CHF ${CHF(totalMin)}`} maxValue={`CHF ${CHF(totalMax)}`} strong highlight />
                  <Row label="Nettowohnfläche (NWF)" minValue={`${CHF(nwf)} m²`} maxValue="—" />
                  <Row label="Geschätzter Erlös" minValue={`CHF ${CHF(erloes)}`} maxValue="—" />
                  <Row label="Marge" minValue={`CHF ${CHF(margeMin)}`} maxValue={`CHF ${CHF(margeMax)}`} strong highlight />
                  <Row
                    label="Erlös/Kosten-Ratio"
                    minValue={ratioMin ? ratioMin.toFixed(2) : "—"}
                    maxValue={ratioMax ? ratioMax.toFixed(2) : "—"}
                    strong
                    highlight
                  />
                </tbody>
              </table>
            </div>

            {badge && (
              <div>
                <Badge variant="outline" className={badge.tone}>
                  {badge.label}
                </Badge>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Richtwerte nach SIA 416 und kantonalen Baukostenkennwerten. Marktpreis ist ein
              Platzhalter — vor Baueingabe durch Marktanalyse ersetzen.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ParamSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-2 rounded-md border p-3">{children}</div>
    </div>
  );
}

function ParamRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
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
