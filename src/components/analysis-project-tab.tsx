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
  area_size?: number | null;
  building_coverage_ratio?: number | null;
  utilization_ratio?: number | null;
  max_height?: number | null;
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

  // ---- BGF-Vorschlag aus Parzellendaten ----
  const suggestion = useMemo(() => {
    const parzelle = Number(analysis.area_size) || 0;
    if (!parzelle) return null;
    const normalize = (v: number | null | undefined) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) return 0;
      return n > 1 ? n / 100 : n;
    };
    const uz = normalize(analysis.building_coverage_ratio);
    const az = normalize(analysis.utilization_ratio);
    const nOber = Math.max(1, floors.filter((f) => f.floor_index >= 0).length);
    let footprint = 0;
    let source = "";
    if (uz > 0) {
      footprint = parzelle * uz;
      source = `ÜZ ${(uz * 100).toFixed(0)}% × ${Math.round(parzelle)} m²`;
    } else if (az > 0) {
      footprint = (parzelle * az) / nOber;
      source = `AZ ${(az * 100).toFixed(0)}% × ${Math.round(parzelle)} m² / ${nOber} G.`;
    } else {
      return null;
    }
    return { footprint: Math.round(footprint), source };
  }, [analysis.area_size, analysis.building_coverage_ratio, analysis.utilization_ratio, floors]);

  const applySuggestions = async () => {
    if (!suggestion) return;
    const targets = floors.filter((f) => !f.gross_area_m2 || Number(f.gross_area_m2) <= 0);
    if (targets.length === 0) {
      toast.info("Alle Geschosse haben bereits einen BGF-Wert.");
      return;
    }
    await Promise.all(
      targets.map((f) =>
        supabase
          .from("analysis_floors")
          .update({ gross_area_m2: suggestion.footprint })
          .eq("id", f.id),
      ),
    );
    toast.success(`${targets.length} Geschoss(e) mit Vorschlag befüllt`, {
      description: suggestion.source,
    });
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
                        key={`${f.id}-${f.gross_area_m2 ?? "empty"}`}
                        type="number"
                        defaultValue={f.gross_area_m2 ?? ""}
                        placeholder={suggestion ? `≈ ${suggestion.footprint}` : ""}
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
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={addFloor}>
              <Plus className="mr-2 h-4 w-4" />Geschoss hinzufügen
            </Button>
            {suggestion && (
              <Button variant="secondary" size="sm" onClick={applySuggestions} title={suggestion.source}>
                <Calculator className="mr-2 h-4 w-4" />
                BGF-Vorschlag übernehmen (≈ {suggestion.footprint} m²/Geschoss)
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {suggestion
              ? `Vorschlag basiert auf: ${suggestion.source}`
              : "Indikative Volumenberechnung – kein Ersatz für ein CAD-Programm."}
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
  analysis,
  bgfM2,
  volumenM3,
}: {
  analysis: AnalysisLite;
  bgfM2: number;
  volumenM3: number;
}) {
  // Modus: auto (Detail wenn Floors vorhanden, sonst Schnellschätzung)
  const autoMode: "quick" | "detail" = bgfM2 > 0 ? "detail" : "quick";
  const [mode, setMode] = useState<"quick" | "detail">(autoMode);
  const [modeTouched, setModeTouched] = useState(false);
  useEffect(() => {
    if (!modeTouched) setMode(autoMode);
  }, [autoMode, modeTouched]);

  // Schnellschätzungs-Inputs (aus Analyse vorausgefüllt)
  const [quickInputs, setQuickInputs] = useState({
    grundstueckflaeche: Number(analysis.area_size ?? 0) || 0,
    uez:
      Number(analysis.building_coverage_ratio ?? analysis.utilization_ratio ?? 0) || 0,
    maxHoeheM: Number(analysis.max_height ?? 0) || 0,
    geschossHoeheM: 3.0,
  });
  useEffect(() => {
    setQuickInputs({
      grundstueckflaeche: Number(analysis.area_size ?? 0) || 0,
      uez:
        Number(analysis.building_coverage_ratio ?? analysis.utilization_ratio ?? 0) || 0,
      maxHoeheM: Number(analysis.max_height ?? 0) || 0,
      geschossHoeheM: 3.0,
    });
  }, [analysis.id, analysis.area_size, analysis.building_coverage_ratio, analysis.utilization_ratio, analysis.max_height]);

  const setQ = (key: keyof typeof quickInputs, value: number) =>
    setQuickInputs((p) => ({ ...p, [key]: Number.isFinite(value) ? value : 0 }));

  // Floors-Query nur für Detailmodus
  const { data: floors } = useQuery({
    queryKey: ["floors-wirt", analysis.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("analysis_floors")
        .select("floor_index,gross_area_m2,floor_height_m")
        .eq("analysis_id", analysis.id);
      return data ?? [];
    },
    enabled: mode === "detail",
  });

  // Kostenparameter (mit Debounce für Berechnungen)
  const [inputs, setInputs] = useState({
    kostenOberirdischProM3: 950,
    kostenUGProM3: 550,
    siaMinPct: 12,
    siaMaxPct: 15,
    bkp5MinPct: 3,
    bkp5MaxPct: 5,
    bkp6MinPct: 5,
    bkp6MaxPct: 8,
    marktpreisProM2: 8500,
    nwfFaktorPct: 65,
    risikoabschlagProzent: 15,
    aussenflaecheM2: 0,
    aussenflaecheAnrechnungsfaktorPct: 35,
  });
  const [params, setParams] = useState(inputs);
  const [parzellenpreis, setParzellenpreis] = useState<number | null>(null);
  const [sliderBandbreite, setSliderBandbreite] = useState<number>(20);
  const hydratedRef = useRef(false);

  // Persistente Parameter aus DB laden
  const { data: savedParams } = useQuery({
    queryKey: ["wirtschaft-params", analysis.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("analysis_wirtschaft")
        .select("*")
        .eq("analysis_id", analysis.id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!savedParams || hydratedRef.current) return;
    hydratedRef.current = true;
    setInputs({
      kostenOberirdischProM3: Number(savedParams.kosten_oberirdisch_pro_m3),
      kostenUGProM3: Number(savedParams.kosten_ug_pro_m3),
      siaMinPct: Number(savedParams.sia_honorare_min),
      siaMaxPct: Number(savedParams.sia_honorare_max),
      bkp5MinPct: Number(savedParams.bkp5_min),
      bkp5MaxPct: Number(savedParams.bkp5_max),
      bkp6MinPct: Number(savedParams.bkp6_min),
      bkp6MaxPct: Number(savedParams.bkp6_max),
      marktpreisProM2: Number(savedParams.marktpreis_pro_m2),
      nwfFaktorPct: Math.round(Number(savedParams.nwf_faktor) * 100),
      risikoabschlagProzent: Number(savedParams.risikoabschlag_prozent),
      aussenflaecheM2: Number(savedParams.aussenflaeche_m2),
      aussenflaecheAnrechnungsfaktorPct: Math.round(
        Number(savedParams.aussenflaeche_anrechnungsfaktor) * 100,
      ),
    });
    setParzellenpreis(
      savedParams.parzellenpreis != null ? Number(savedParams.parzellenpreis) : null,
    );
    setSliderBandbreite(Number(savedParams.slider_bandbreite));
  }, [savedParams]);

  useEffect(() => {
    const t = setTimeout(() => setParams(inputs), 500);
    return () => clearTimeout(t);
  }, [inputs]);

  // Debounced Persist an DB (nach Hydration)
  const qc2 = useQueryClient();
  useEffect(() => {
    if (!hydratedRef.current && savedParams === undefined) return;
    const t = setTimeout(async () => {
      await supabase.from("analysis_wirtschaft").upsert(
        {
          analysis_id: analysis.id,
          organization_id: analysis.organization_id,
          kosten_oberirdisch_pro_m3: inputs.kostenOberirdischProM3,
          kosten_ug_pro_m3: inputs.kostenUGProM3,
          sia_honorare_min: inputs.siaMinPct,
          sia_honorare_max: inputs.siaMaxPct,
          bkp5_min: inputs.bkp5MinPct,
          bkp5_max: inputs.bkp5MaxPct,
          bkp6_min: inputs.bkp6MinPct,
          bkp6_max: inputs.bkp6MaxPct,
          marktpreis_pro_m2: inputs.marktpreisProM2,
          nwf_faktor: inputs.nwfFaktorPct / 100,
          risikoabschlag_prozent: inputs.risikoabschlagProzent,
          aussenflaeche_m2: inputs.aussenflaecheM2,
          aussenflaeche_anrechnungsfaktor: inputs.aussenflaecheAnrechnungsfaktorPct / 100,
          parzellenpreis: parzellenpreis,
          slider_bandbreite: sliderBandbreite,
        },
        { onConflict: "analysis_id" },
      );
      hydratedRef.current = true;
      qc2.invalidateQueries({ queryKey: ["wirtschaft-report", analysis.id] });
    }, 800);
    return () => clearTimeout(t);
  }, [inputs, parzellenpreis, sliderBandbreite, analysis.id, analysis.organization_id, savedParams, qc2]);

  const setI = (key: keyof typeof inputs, value: number) =>
    setInputs((p) => ({ ...p, [key]: Number.isFinite(value) ? value : 0 }));

  // BGF / Volumen je nach Modus
  let bgfTotal = 0;
  let volOberirdisch = 0;
  let volUG = 0;

  if (mode === "quick") {
    const bebauteFlaeche = quickInputs.grundstueckflaeche * quickInputs.uez;
    const vollgeschosse =
      quickInputs.geschossHoeheM > 0
        ? Math.floor(quickInputs.maxHoeheM / quickInputs.geschossHoeheM)
        : 0;
    const bgfOberirdisch = bebauteFlaeche * vollgeschosse;
    const ugFlaeche = bebauteFlaeche * 1.3;
    bgfTotal = bgfOberirdisch + ugFlaeche;
    volOberirdisch = bgfOberirdisch * quickInputs.geschossHoeheM;
    volUG = ugFlaeche * quickInputs.geschossHoeheM;
  } else {
    bgfTotal = bgfM2;
    if (floors && floors.length > 0) {
      volOberirdisch = floors
        .filter((f) => (f.floor_index ?? 0) >= 0)
        .reduce((s, f) => s + (f.gross_area_m2 || 0) * (f.floor_height_m || 0), 0);
      volUG = floors
        .filter((f) => (f.floor_index ?? 0) < 0)
        .reduce((s, f) => s + (f.gross_area_m2 || 0) * (f.floor_height_m || 0), 0);
    } else {
      volOberirdisch = volumenM3;
      volUG = 0;
    }
  }

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
  const totalMittel = (totalMin + totalMax) / 2;

  const nwf = bgfTotal * (params.nwfFaktorPct / 100);
  const erloes = nwf * params.marktpreisProM2;
  const margeMin = erloes - totalMax;
  const margeMax = erloes - totalMin;
  const ratioMin = totalMax > 0 ? erloes / totalMax : 0;
  const ratioMax = totalMin > 0 ? erloes / totalMin : 0;

  const residualwert = erloes - totalMittel;
  const sliderMin = residualwert * (1 - sliderBandbreite / 100);
  const sliderMax = residualwert * (1 + sliderBandbreite / 100);
  const abweichungChf = parzellenpreis != null ? parzellenpreis - residualwert : null;
  const abweichungProzent =
    parzellenpreis != null && residualwert > 0
      ? ((parzellenpreis - residualwert) / residualwert) * 100
      : null;
  const sliderPosition =
    parzellenpreis != null && sliderMax !== sliderMin
      ? Math.max(0, Math.min(100, ((parzellenpreis - sliderMin) / (sliderMax - sliderMin)) * 100))
      : 50;

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

  const QuickNumInput = ({
    keyName,
    step = "1",
    className = "w-24",
  }: {
    keyName: keyof typeof quickInputs;
    step?: string;
    className?: string;
  }) => (
    <Input
      type="number"
      step={step}
      value={quickInputs[keyName]}
      onChange={(e) => setQ(keyName, Number(e.target.value))}
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
    <tr className={`border-t ${highlight ? "bg-primary/5" : ""} ${strong ? "font-semibold" : ""}`}>
      <td className="px-3 py-1.5">{label}</td>
      <td className="px-3 py-1.5 text-right font-mono tabular-nums">{minValue}</td>
      <td className="px-3 py-1.5 text-right font-mono tabular-nums">{maxValue}</td>
    </tr>
  );

  const switchMode = (m: "quick" | "detail") => {
    setModeTouched(true);
    setMode(m);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <Calculator className="h-4 w-4 text-secondary" />
              Wirtschaftlichkeit &amp; Grobkostenschätzung
            </CardTitle>
            <CardDescription>
              Indikative Baukosten (BKP 2 + Honorare + BKP 5/6) und Ertragspotenzial.
            </CardDescription>
          </div>
          <div className="inline-flex rounded-md border p-0.5 text-xs">
            <button
              type="button"
              onClick={() => switchMode("quick")}
              className={`rounded px-2.5 py-1 transition-colors ${
                mode === "quick" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Schnellschätzung
            </button>
            <button
              type="button"
              onClick={() => switchMode("detail")}
              className={`rounded px-2.5 py-1 transition-colors ${
                mode === "detail" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Detailrechnung
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-[280px_1fr]">
          {/* Parameter */}
          <div className="space-y-4">
            {mode === "quick" && (
              <ParamSection title="Schnellschätzung – Basis">
                <ParamRow label="Grundstück (m²)">
                  <QuickNumInput keyName="grundstueckflaeche" />
                </ParamRow>
                <ParamRow label="ÜZ (Faktor 0–1)">
                  <QuickNumInput keyName="uez" step="0.01" className="w-20" />
                </ParamRow>
                <ParamRow label="Max. Gebäudehöhe (m)">
                  <QuickNumInput keyName="maxHoeheM" step="0.1" className="w-20" />
                </ParamRow>
                <ParamRow label="Geschosshöhe (m)">
                  <QuickNumInput keyName="geschossHoeheM" step="0.1" className="w-20" />
                </ParamRow>
              </ParamSection>
            )}

            <ParamSection title="Gebäude & Kosten">
              <ParamRow label="Kosten oberirdisch (CHF/m³)">
                <NumInput keyName="kostenOberirdischProM3" />
              </ParamRow>
              <ParamRow label="Kosten UG (CHF/m³)">
                <NumInput keyName="kostenUGProM3" />
              </ParamRow>
              <ParamRow label="NWF-Faktor (% von BGF)">
                <div
                  className="flex items-center gap-1"
                  title="Schweizer Richtwert: 60–70%. Pauschalwert 80% überschätzt Wohnfläche. Referenz Emmen: 58%."
                >
                  <NumInput keyName="nwfFaktorPct" className="w-20" />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </ParamRow>
            </ParamSection>

            <ParamSection title="Honorare">
              <ParamRow label="SIA-Honorare (%)">
                <div className="flex items-center gap-1">
                  <NumInput keyName="siaMinPct" className="w-16" />
                  <span className="text-xs text-muted-foreground">–</span>
                  <NumInput keyName="siaMaxPct" className="w-16" />
                </div>
              </ParamRow>
              <ParamRow label="BKP5 Nebenkosten (%)">
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
              <ParamRow label="Aussenfläche (m²)">
                <NumInput keyName="aussenflaecheM2" />
              </ParamRow>
              <ParamRow label="Aussen-Anrechnung (%)">
                <div className="flex items-center gap-1">
                  <NumInput keyName="aussenflaecheAnrechnungsfaktorPct" className="w-20" />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </ParamRow>
            </ParamSection>

            <ParamSection title="Risiko & Slider">
              <ParamRow label="Risikoabschlag (%)">
                <div className="flex items-center gap-1">
                  <NumInput keyName="risikoabschlagProzent" className="w-20" />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </ParamRow>
              <ParamRow label="Slider-Bandbreite ±%">
                <Input
                  type="number"
                  className="h-8 w-20 text-right"
                  value={sliderBandbreite}
                  onChange={(e) => setSliderBandbreite(Number(e.target.value) || 20)}
                />
              </ParamRow>
            </ParamSection>
          </div>

          {/* Ergebnis */}
          <div className="space-y-3">
            {mode === "quick" ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                <strong>Schnellschätzung</strong> basierend auf ÜZ und Gebäudehöhe. Genauigkeit ±25–35%.
                Für präzise Berechnung: Geschosse im Rechner oben erfassen.
              </div>
            ) : bgfTotal === 0 ? (
              <div className="rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-900">
                <strong>Keine Geschossflächen erfasst.</strong> Trage im Geschossrechner oben die
                Bruttogeschossfläche (BGF m²) pro Geschoss ein — sonst bleiben alle Werte 0.
                Alternativ oben rechts auf <em>Schnellschätzung</em> wechseln.
              </div>
            ) : (
              <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900">
                <strong>Präzise Berechnung</strong> basierend auf erfassten Geschossdaten.
              </div>
            )}

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
                  <Row label="BGF total" minValue={`${CHF(bgfTotal)} m²`} maxValue="—" />
                  <Row label="Volumen oberirdisch" minValue={`${CHF(volOberirdisch)} m³`} maxValue="—" />
                  <Row label="Volumen UG" minValue={`${CHF(volUG)} m³`} maxValue="—" />
                  <Row label="BKP2 oberirdisch" minValue={`CHF ${CHF(bkp2Oberirdisch)}`} maxValue="—" />
                  <Row label="BKP2 UG" minValue={`CHF ${CHF(bkp2UG)}`} maxValue="—" />
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
                  />
                  <Row label="Residualwert" minValue={`CHF ${CHF(residualwert)}`} maxValue="—" strong highlight />
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

        {/* Residualwert & Preis-Regler */}
        <div className="mt-6 border-t pt-4">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4 text-secondary" />
            Residualwert der Parzelle
          </h4>

          <div className="mb-4 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">
                  Residualwert = Erlös − Ø Baukosten
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {residualwert.toLocaleString("de-CH", {
                    style: "currency",
                    currency: "CHF",
                    maximumFractionDigits: 0,
                  })}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Maximaler wirtschaftlich vertretbarer Parzellenpreis
                </p>
              </div>
              <Badge
                variant="outline"
                className={
                  residualwert > 0
                    ? "border-emerald-400 text-emerald-700"
                    : "border-red-400 text-red-700"
                }
              >
                {residualwert > 0 ? "Projekt wirtschaftlich" : "Projekt unrentabel"}
              </Badge>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="w-52 shrink-0 text-sm text-muted-foreground">
              Effektiver Angebotspreis (CHF)
            </label>
            <Input
              type="number"
              placeholder="z. B. 850000"
              className="h-9 max-w-48"
              value={parzellenpreis ?? ""}
              onChange={(e) =>
                setParzellenpreis(e.target.value === "" ? null : Number(e.target.value))
              }
            />
            {abweichungChf != null && (
              <span
                className={`text-sm font-medium ${
                  abweichungChf > 0 ? "text-red-600" : "text-emerald-600"
                }`}
              >
                {abweichungChf > 0 ? "+" : ""}
                {abweichungChf.toLocaleString("de-CH", {
                  style: "currency",
                  currency: "CHF",
                  maximumFractionDigits: 0,
                })}
                {abweichungProzent != null && (
                  <>
                    {" "}
                    ({abweichungProzent > 0 ? "+" : ""}
                    {abweichungProzent.toFixed(1)}%)
                  </>
                )}
              </span>
            )}
          </div>

          {/* Preis-Regler */}
          <div className="mt-2">
            <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
              <span>
                {sliderMin.toLocaleString("de-CH", {
                  style: "currency",
                  currency: "CHF",
                  maximumFractionDigits: 0,
                })}
              </span>
              <span className="font-medium text-foreground">
                Residualwert:{" "}
                {residualwert.toLocaleString("de-CH", {
                  style: "currency",
                  currency: "CHF",
                  maximumFractionDigits: 0,
                })}
              </span>
              <span>
                {sliderMax.toLocaleString("de-CH", {
                  style: "currency",
                  currency: "CHF",
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>

            <div
              className="relative h-6 overflow-hidden rounded-full"
              style={{
                background:
                  "linear-gradient(to right, #ef4444 0%, #f97316 25%, #fbbf24 45%, #d1d5db 50%, #86efac 55%, #22c55e 75%, #16a34a 100%)",
              }}
            >
              <div
                className="absolute bottom-0 top-0 w-0.5 bg-white/90"
                style={{ left: "50%", transform: "translateX(-50%)" }}
              />
              {parzellenpreis != null && (
                <div
                  className="absolute bottom-0 top-0 flex items-center transition-all duration-300"
                  style={{ left: `${sliderPosition}%`, transform: "translateX(-50%)" }}
                >
                  <div className="flex h-8 w-4 items-center justify-center rounded-sm border border-gray-300 bg-white shadow-md">
                    <div className="h-4 w-0.5 rounded bg-gray-500" />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>← Günstiger als Residualwert (attraktiv)</span>
              <span>Teurer als Residualwert (unattraktiv) →</span>
            </div>

            {parzellenpreis != null && abweichungChf != null && (
              <div
                className={`mt-3 rounded-lg border p-3 text-sm ${
                  abweichungChf <= 0
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-red-200 bg-red-50 text-red-800"
                }`}
              >
                {abweichungChf <= 0 ? (
                  <>
                    <span className="font-semibold">Attraktives Investment: </span>
                    Der Angebotspreis liegt{" "}
                    {Math.abs(abweichungProzent ?? 0).toFixed(1)}% unter dem Residualwert — das
                    Projekt hat einen Puffer von{" "}
                    {Math.abs(abweichungChf).toLocaleString("de-CH", {
                      style: "currency",
                      currency: "CHF",
                      maximumFractionDigits: 0,
                    })}
                    .
                  </>
                ) : (
                  <>
                    <span className="font-semibold">Wirtschaftlichkeit gefährdet: </span>
                    Der Angebotspreis liegt{" "}
                    {Math.abs(abweichungProzent ?? 0).toFixed(1)}% über dem Residualwert —
                    Nachverhandlung oder Kostenoptimierung empfohlen.
                  </>
                )}
              </div>
            )}
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
