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
import type { FloorInput } from "@/lib/wirtschaft-engine";
import { zoneSuggestion, type WirtschaftRow } from "@/lib/wirtschaft-input";
import { useWirtschaft } from "@/hooks/use-wirtschaft";
import { buildWirtschaftRows, fmtChf } from "@/lib/wirtschaft-rows";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import {
  Building, Calculator, ChevronDown, Download, Info, FileUp, Loader2, Plus, Save, Trash2, TrendingUp, UploadCloud,
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
  max_floors?: number | null;
  extracted_data?: Record<string, unknown> | null;
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

function floorLabelFor(index: number): string {
  if (index < 0) return index === -1 ? "Untergeschoss" : `${-index}. Untergeschoss`;
  return index === 0 ? "Erdgeschoss" : `${index}. Obergeschoss`;
}

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
  onCalcChange?: (floors: FloorInput[]) => void;
}) {
  const qc = useQueryClient();
  const { data: floors = [], refetch: refetchFloors, isFetched: floorsFetched } = useQuery({
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
  const [draftFloors, setDraftFloors] = useState<Floor[]>([]);

  useEffect(() => {
    setDraftFloors(floors);
  }, [floors]);

  const displayFloors = draftFloors.length > 0 ? draftFloors : floors;

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

  // ---- BGF-Vorschlag aus Zonenwerten (Single Source: wirtschaft-engine) ----
  const zone = useMemo(() => zoneSuggestion(analysis), [analysis]);
  const suggestFor = (f: { floor_index: number }) =>
    f.floor_index < 0 ? zone.footprintUg : zone.footprintOber;

  // Seed defaults the first time (idempotent: rechecks DB, um Duplikate durch Remounts zu vermeiden)
  const seededRef = useRef(false);
  useEffect(() => {
    if (!floorsFetched) return;
    if (seededRef.current) return;
    if (floors.length > 0) {
      seededRef.current = true;
      return;
    }
    seededRef.current = true;
    (async () => {
      const { count } = await supabase
        .from("analysis_floors")
        .select("id", { count: "exact", head: true })
        .eq("analysis_id", analysis.id);
      if ((count ?? 0) > 0) {
        refetchFloors();
        return;
      }
      const seed =
        zone.floors.length > 0
          ? zone.floors.map((f) => ({
              floor_index: f.index,
              floor_label: floorLabelFor(f.index),
              gross_area_m2: f.bgfM2 !== null ? Math.round(f.bgfM2) : null,
              floor_height_m: f.heightM ?? 3.0,
            }))
          : DEFAULT_FLOORS;
      await supabase.from("analysis_floors").insert(
        seed.map((f) => ({
          ...f,
          analysis_id: analysis.id,
          organization_id: analysis.organization_id,
        })),
      );
      refetchFloors();
    })();
  }, [floorsFetched, floors.length, analysis.id, analysis.organization_id, refetchFloors, zone]);

  const debouncers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const debounceUpdate = (id: string, patch: Partial<Floor>) => {
    setDraftFloors((current) => current.map((floor) => (floor.id === id ? { ...floor, ...patch } : floor)));
    qc.setQueryData<Floor[]>(["analysis-floors", analysis.id], (current) =>
      current?.map((floor) => (floor.id === id ? { ...floor, ...patch } : floor)) ?? current,
    );
    if (debouncers.current[id]) clearTimeout(debouncers.current[id]);
    debouncers.current[id] = setTimeout(async () => {
      const { error } = await supabase.from("analysis_floors").update(patch).eq("id", id);
      if (error) {
        toast.error("Geschoss konnte nicht gespeichert werden", { description: error.message });
      }
      refetchFloors();
      qc.invalidateQueries({ queryKey: ["floors-wirt", analysis.id] });
      qc.invalidateQueries({ queryKey: ["wirtschaft-report", analysis.id] });
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

  const getEffectiveGrossArea = (floor: Floor) => {
    const entered = Number(floor.gross_area_m2);
    if (Number.isFinite(entered) && entered > 0) return entered;
    return suggestFor(floor) ?? 0;
  };

  const totalArea = useMemo(
    () => displayFloors.reduce((s, f) => s + getEffectiveGrossArea(f), 0),
    [displayFloors, zone],
  );
  const totalVolume = useMemo(
    () =>
      displayFloors.reduce(
        (s, f) => s + getEffectiveGrossArea(f) * (Number(f.floor_height_m) || 0),
        0,
      ),
    [displayFloors, zone],
  );
  const totalUnitArea = useMemo(
    () => units.reduce((s, u) => s + (Number(u.area_m2) || 0), 0),
    [units],
  );

  const effectiveFloors = useMemo<FloorInput[]>(
    () =>
      displayFloors.map((f) => {
        const bgf = getEffectiveGrossArea(f);
        const h = Number(f.floor_height_m);
        return { index: f.floor_index, bgfM2: bgf > 0 ? bgf : null, heightM: h > 0 ? h : null };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayFloors, zone],
  );
  const bgfOber = useMemo(
    () => effectiveFloors.filter((f) => f.index >= 0).reduce((s, f) => s + (f.bgfM2 ?? 0), 0),
    [effectiveFloors],
  );

  useEffect(() => {
    onCalcChange?.(effectiveFloors);
  }, [effectiveFloors, onCalcChange]);

  const applySuggestions = async () => {
    const targets = displayFloors.filter(
      (f) => (!f.gross_area_m2 || Number(f.gross_area_m2) <= 0) && suggestFor(f) !== null,
    );
    if (targets.length === 0) {
      toast.info("Alle Geschosse haben bereits einen BGF-Wert.");
      return;
    }
    const targetIds = new Set(targets.map((f) => f.id));
    setDraftFloors((current) =>
      current.map((floor) => (targetIds.has(floor.id) ? { ...floor, gross_area_m2: suggestFor(floor) } : floor)),
    );
    await Promise.all(
      targets.map((f) =>
        supabase
          .from("analysis_floors")
          .update({ gross_area_m2: suggestFor(f) })
          .eq("id", f.id),
      ),
    );
    toast.success(`${targets.length} Geschoss(e) mit Vorschlag befüllt`, {
      description: zone.source,
    });
    refetchFloors();
    qc.invalidateQueries({ queryKey: ["floors-wirt", analysis.id] });
    qc.invalidateQueries({ queryKey: ["wirtschaft-report", analysis.id] });
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
    const { data: w } = await supabase
      .from("analysis_wirtschaft")
      .select("nwf_faktor")
      .eq("analysis_id", analysis.id)
      .maybeSingle();
    const nwf = Number(w?.nwf_faktor) > 0 ? Number(w?.nwf_faktor) : 0.65;
    const { error } = await supabase
      .from("analyses")
      .update({
        floor_area: Math.round(bgfOber),
        living_area: Math.round(bgfOber * nwf),
        unit_count: units.length,
      })
      .eq("id", analysis.id);
    if (error) return toast.error("Fehler", { description: error.message });
    toast.success("In Analyse übernommen", {
      description: `BGF oberirdisch ${Math.round(bgfOber)} m² · NWF ×${nwf} · ${units.length} WE`,
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
        <div
          className={`rounded-md border px-3 py-2 text-xs ${
            zone.warnings.length > 0
              ? "border-warning/40 bg-warning/10 text-foreground"
              : "border-border bg-muted/30 text-muted-foreground"
          }`}
        >
          <div>
            <span className="font-medium">Vorschlag:</span> {zone.source}
            {zone.nOber > 0 && (
              <>
                {" "}· {zone.nOber} Obergeschosse à {zone.footprintOber?.toLocaleString("de-CH")} m² · UG{" "}
                {zone.footprintUg?.toLocaleString("de-CH")} m²
              </>
            )}
          </div>
          {zone.warnings.map((w) => (
            <div key={w}>⚠ {w}</div>
          ))}
        </div>
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
                const vol = getEffectiveGrossArea(f) * (Number(f.floor_height_m) || 0);
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
                      <div className="flex items-center justify-end gap-1">
                      {(f.gross_area_m2 === null || Number(f.gross_area_m2) <= 0) && suggestFor(f) !== null && (
                        <Badge variant="outline" className="shrink-0 text-[10px]">Vorschlag</Badge>
                      )}
                      <Input
                        key={`${f.id}-${f.gross_area_m2 ?? "empty"}`}
                        type="number"
                        defaultValue={f.gross_area_m2 ?? ""}
                        placeholder={suggestFor(f) !== null ? `≈ ${suggestFor(f)}` : ""}
                        className="h-8 text-right"
                        onChange={(e) =>
                          debounceUpdate(f.id, {
                            gross_area_m2: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                      />
                      </div>
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
            {zone.footprintOber !== null && (
              <Button variant="secondary" size="sm" onClick={applySuggestions} title={zone.source}>
                <Calculator className="mr-2 h-4 w-4" />
                BGF-Vorschlag übernehmen (≈ {zone.footprintOber} m²/Geschoss)
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {zone.footprintOber !== null
              ? `Vorschlag basiert auf: ${zone.source}`
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

type NumKey =
  | "kosten_oberirdisch_pro_m3"
  | "kosten_ug_pro_m3"
  | "sia_honorare_min"
  | "sia_honorare_max"
  | "bkp1_pct"
  | "abbruch_m3"
  | "abbruch_pro_m3"
  | "umgebung_pro_m2"
  | "bkp5_min"
  | "bkp5_max"
  | "bkp6_min"
  | "bkp6_max"
  | "nwf_faktor"
  | "marktpreis_pro_m2"
  | "aussenflaeche_m2"
  | "aussenflaeche_anrechnungsfaktor"
  | "parkplaetze"
  | "preis_pro_parkplatz"
  | "entwicklergewinn_pct"
  | "vermarktung_pct"
  | "finanzierung_pct"
  | "grundstuecks_nebenkosten_pct"
  | "sicherheitsabschlag_pct";

type WParams = Record<NumKey, number> & { kennwert_inkl_honorare: boolean };

const DEFAULT_PARAMS: WParams = {
  kosten_oberirdisch_pro_m3: 950,
  kosten_ug_pro_m3: 550,
  kennwert_inkl_honorare: true,
  sia_honorare_min: 12,
  sia_honorare_max: 15,
  bkp1_pct: 2,
  abbruch_m3: 0,
  abbruch_pro_m3: 45,
  umgebung_pro_m2: 150,
  bkp5_min: 3,
  bkp5_max: 5,
  bkp6_min: 5,
  bkp6_max: 8,
  nwf_faktor: 0.65,
  marktpreis_pro_m2: 0,
  aussenflaeche_m2: 0,
  aussenflaeche_anrechnungsfaktor: 0.35,
  parkplaetze: 0,
  preis_pro_parkplatz: 0,
  entwicklergewinn_pct: 12,
  vermarktung_pct: 2,
  finanzierung_pct: 3,
  grundstuecks_nebenkosten_pct: 3,
  sicherheitsabschlag_pct: 0,
};

function NumField({
  value,
  onChange,
  step = "1",
  className = "w-24",
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: string;
  className?: string;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        className={`h-8 text-right ${className}`}
      />
      {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
    </div>
  );
}

function CollapsibleSection({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="rounded-md border">
      <CollapsibleTrigger className="group flex w-full items-center justify-between px-3 py-2 font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
        <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 border-t p-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export function WirtschaftlichkeitCard({
  analysis,
  floors,
}: {
  analysis: AnalysisLite;
  floors?: FloorInput[];
}) {
  const qc = useQueryClient();
  const [params, setParams] = useState<WParams>(DEFAULT_PARAMS);
  const [debounced, setDebounced] = useState<WParams | null>(null);
  const [parzellenpreis, setParzellenpreis] = useState<number | null>(null);
  const [sliderBandbreite, setSliderBandbreite] = useState<number>(20);
  const hydratedRef = useRef(false);
  const dirtyRef = useRef(false);
  const [mode, setMode] = useState<"quick" | "detail">("detail");
  const [modeTouched, setModeTouched] = useState(false);

  const paramsOverride = useMemo<WirtschaftRow | undefined>(
    () => (debounced ? { ...debounced, parzellenpreis, slider_bandbreite: sliderBandbreite } : undefined),
    [debounced, parzellenpreis, sliderBandbreite],
  );
  const w = useWirtschaft(analysis.id, mode, floors, paramsOverride);

  useEffect(() => {
    if (!modeTouched) setMode(w.autoMode);
  }, [w.autoMode, modeTouched]);

  // Hydration aus DB
  useEffect(() => {
    if (hydratedRef.current || !w.savedParamsLoaded) return;
    hydratedRef.current = true;
    const s = w.savedParams as Record<string, unknown> | null;
    if (!s) {
      setDebounced(DEFAULT_PARAMS);
      return;
    }
    const next = { ...DEFAULT_PARAMS };
    (Object.keys(DEFAULT_PARAMS) as (keyof WParams)[]).forEach((k) => {
      const v = s[k];
      if (k === "kennwert_inkl_honorare") {
        if (typeof v === "boolean") next.kennwert_inkl_honorare = v;
      } else if (v != null && Number.isFinite(Number(v))) {
        next[k] = Number(v);
      }
    });
    setParams(next);
    setDebounced(next);
    setParzellenpreis(s.parzellenpreis != null ? Number(s.parzellenpreis) : null);
    if (s.slider_bandbreite != null) setSliderBandbreite(Number(s.slider_bandbreite));
  }, [w.savedParams, w.savedParamsLoaded]);

  // Live-Rechnung (kurzer Debounce) + Persistenz (längerer Debounce)
  useEffect(() => {
    if (!hydratedRef.current) return;
    const t = setTimeout(() => setDebounced(params), 250);
    return () => clearTimeout(t);
  }, [params]);

  useEffect(() => {
    if (!dirtyRef.current) return;
    const t = setTimeout(async () => {
      const { error } = await supabase.from("analysis_wirtschaft").upsert(
        {
          analysis_id: analysis.id,
          organization_id: analysis.organization_id,
          ...params,
          parzellenpreis,
          slider_bandbreite: sliderBandbreite,
        },
        { onConflict: "analysis_id" },
      );
      if (error) toast.error("Parameter konnten nicht gespeichert werden", { description: error.message });
      qc.invalidateQueries({ queryKey: ["wirtschaft-report", analysis.id] });
    }, 800);
    return () => clearTimeout(t);
  }, [params, parzellenpreis, sliderBandbreite, analysis.id, analysis.organization_id, qc]);

  const setP = <K extends keyof WParams>(k: K, v: WParams[K]) => {
    dirtyRef.current = true;
    setParams((p) => ({ ...p, [k]: v }));
  };
  const num = (k: NumKey, opts: { step?: string; className?: string; suffix?: string } = {}) => (
    <NumField value={params[k]} onChange={(v) => setP(k, v)} {...opts} />
  );
  const range = (a: NumKey, b: NumKey) => (
    <div className="flex items-center gap-1">
      {num(a, { className: "w-16" })}
      <span className="text-xs text-muted-foreground">–</span>
      {num(b, { className: "w-16", suffix: "%" })}
    </div>
  );

  const result = w.result ?? null;
  const rows = result && w.input ? buildWirtschaftRows(result, w.input) : [];
  const residual = result?.residualwertLand ?? null;
  const sliderMin = residual != null ? residual * (1 - sliderBandbreite / 100) : null;
  const sliderMax = residual != null ? residual * (1 + sliderBandbreite / 100) : null;
  const abweichungChf = parzellenpreis != null && residual != null ? parzellenpreis - residual : null;
  const abweichungProzent =
    abweichungChf != null && residual != null && residual > 0 ? (abweichungChf / residual) * 100 : null;
  const sliderPosition =
    parzellenpreis != null && sliderMin != null && sliderMax != null && sliderMax !== sliderMin
      ? Math.max(0, Math.min(100, ((parzellenpreis - sliderMin) / (sliderMax - sliderMin)) * 100))
      : 50;

  const ratioMax = result?.ratio.max ?? null;
  const margeMax = result?.marge.max ?? null;
  const badge = (() => {
    if (ratioMax == null) return null;
    if (margeMax != null && margeMax > 0 && ratioMax > 1.3)
      return { label: "Wirtschaftlich attraktiv", tone: "bg-emerald-100 text-emerald-800 border-emerald-200" };
    if (ratioMax >= 1.1) return { label: "Knapp wirtschaftlich", tone: "bg-amber-100 text-amber-800 border-amber-200" };
    return { label: "Wirtschaftlichkeit gefährdet", tone: "bg-red-100 text-red-800 border-red-200" };
  })();

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
            <CardDescription>Anlagekosten nach BKP, Erlös und Residualwert des Landes.</CardDescription>
          </div>
          <div className="inline-flex rounded-md border p-0.5 text-xs">
            {(["quick", "detail"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`rounded px-2.5 py-1 transition-colors ${
                  mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {m === "quick" ? "Schnellschätzung" : "Detailrechnung"}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-[300px_1fr]">
          <div className="space-y-3">
            <CollapsibleSection title="Baukosten" defaultOpen>
              <ParamRow label="Kennwert oberirdisch (CHF/m³)">{num("kosten_oberirdisch_pro_m3")}</ParamRow>
              <ParamRow label="Kennwert UG (CHF/m³)">{num("kosten_ug_pro_m3")}</ParamRow>
              <ParamRow label="Kennwerte inkl. Honorare (BKP 29)">
                <Switch
                  checked={params.kennwert_inkl_honorare}
                  onCheckedChange={(v) => setP("kennwert_inkl_honorare", v)}
                />
              </ParamRow>
              <ParamRow label="Honorare (%)">{range("sia_honorare_min", "sia_honorare_max")}</ParamRow>
              <ParamRow label="BKP 1 (%)">{num("bkp1_pct", { className: "w-16", suffix: "%" })}</ParamRow>
              <ParamRow label="Abbruchvolumen (m³)">{num("abbruch_m3")}</ParamRow>
              <ParamRow label="Abbruch (CHF/m³)">{num("abbruch_pro_m3")}</ParamRow>
              <ParamRow label="Umgebung (CHF/m²)">{num("umgebung_pro_m2")}</ParamRow>
              <ParamRow label="BKP 5 (%)">{range("bkp5_min", "bkp5_max")}</ParamRow>
              <ParamRow label="BKP 6 (%)">{range("bkp6_min", "bkp6_max")}</ParamRow>
            </CollapsibleSection>
            <CollapsibleSection title="Erlös" defaultOpen>
              <ParamRow label="NWF-Faktor">{num("nwf_faktor", { step: "0.01", className: "w-20" })}</ParamRow>
              <ParamRow label="Marktpreis (CHF/m²)">{num("marktpreis_pro_m2")}</ParamRow>
              <ParamRow label="Aussenfläche (m²)">{num("aussenflaeche_m2")}</ParamRow>
              <ParamRow label="Anrechnung (%)">
                <NumField
                  value={Math.round(params.aussenflaeche_anrechnungsfaktor * 1000) / 10}
                  onChange={(v) => setP("aussenflaeche_anrechnungsfaktor", v / 100)}
                  className="w-20"
                  suffix="%"
                />
              </ParamRow>
              <ParamRow label="Parkplätze">{num("parkplaetze", { className: "w-20" })}</ParamRow>
              <ParamRow label="Preis pro Parkplatz (CHF)">{num("preis_pro_parkplatz")}</ParamRow>
            </CollapsibleSection>
            <CollapsibleSection title="Residualwert">
              <ParamRow label="Entwicklergewinn (%)">{num("entwicklergewinn_pct", { className: "w-16", suffix: "%" })}</ParamRow>
              <ParamRow label="Vermarktung (%)">{num("vermarktung_pct", { className: "w-16", suffix: "%" })}</ParamRow>
              <ParamRow label="Finanzierung (%)">{num("finanzierung_pct", { className: "w-16", suffix: "%" })}</ParamRow>
              <ParamRow label="Grundstücksnebenkosten (%)">
                {num("grundstuecks_nebenkosten_pct", { className: "w-16", suffix: "%" })}
              </ParamRow>
              <ParamRow label="Sicherheitsabschlag (%)">
                {num("sicherheitsabschlag_pct", { className: "w-16", suffix: "%" })}
              </ParamRow>
              <ParamRow label="Slider-Bandbreite ±%">
                <NumField
                  value={sliderBandbreite}
                  onChange={(v) => {
                    dirtyRef.current = true;
                    setSliderBandbreite(v > 0 ? v : 20);
                  }}
                  className="w-16"
                  suffix="%"
                />
              </ParamRow>
            </CollapsibleSection>
          </div>

          <div className="space-y-3">
            {mode === "quick" && w.zone && (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <strong>Schnellschätzung</strong> aus Zonenwerten: {w.zone.source}
              </div>
            )}
            {result && result.warnings.length > 0 && (
              <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
                {result.warnings.map((m) => (
                  <div key={m}>⚠ {m}</div>
                ))}
              </div>
            )}

            <TooltipProvider delayDuration={100}>
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
                    {rows.map((r) => (
                      <tr
                        key={r.label}
                        className={`border-t ${r.highlight ? "bg-primary/5" : ""} ${r.strong ? "font-semibold" : ""}`}
                      >
                        <td className={`py-1.5 pr-3 ${r.indent ? "pl-8 text-xs text-muted-foreground" : "pl-3"}`}>
                          <span className="inline-flex items-center gap-1.5">
                            {r.label}
                            {r.formula && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3.5 w-3.5 shrink-0 cursor-help text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-sm whitespace-pre-line text-xs">{r.formula}</TooltipContent>
                              </Tooltip>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono tabular-nums">{r.min}</td>
                        <td className="px-3 py-1.5 text-right font-mono tabular-nums">{r.max}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TooltipProvider>

            {badge && (
              <Badge variant="outline" className={badge.tone}>
                {badge.label}
              </Badge>
            )}
            <p className="text-xs text-muted-foreground">
              Richtwerte nach SIA 416 / BKP. Marktpreis vor Baueingabe durch Marktanalyse bestätigen.
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
                <p className="text-xs text-muted-foreground">Residualwert Land (nach Gewinn, Vermarktung, Finanzierung, Nebenkosten)</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{fmtChf(residual)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Maximaler wirtschaftlich vertretbarer Parzellenpreis</p>
              </div>
              {residual != null && (
                <Badge
                  variant="outline"
                  className={residual > 0 ? "border-emerald-400 text-emerald-700" : "border-red-400 text-red-700"}
                >
                  {residual > 0 ? "Projekt wirtschaftlich" : "Projekt unrentabel"}
                </Badge>
              )}
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="w-52 shrink-0 text-sm text-muted-foreground">Effektiver Angebotspreis (CHF)</label>
            <Input
              type="number"
              placeholder="z. B. 850000"
              className="h-9 max-w-48"
              value={parzellenpreis ?? ""}
              onChange={(e) => {
                dirtyRef.current = true;
                setParzellenpreis(e.target.value === "" ? null : Number(e.target.value));
              }}
            />
            {abweichungChf != null && (
              <span className={`text-sm font-medium ${abweichungChf > 0 ? "text-red-600" : "text-emerald-600"}`}>
                {abweichungChf > 0 ? "+" : ""}
                {fmtChf(abweichungChf)}
                {abweichungProzent != null && (
                  <> ({abweichungProzent > 0 ? "+" : ""}{abweichungProzent.toFixed(1)}%)</>
                )}
              </span>
            )}
          </div>

          {residual != null && sliderMin != null && sliderMax != null && (
            <div className="mt-2">
              <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                <span>{fmtChf(sliderMin)}</span>
                <span className="font-medium text-foreground">Residualwert: {fmtChf(residual)}</span>
                <span>{fmtChf(sliderMax)}</span>
              </div>
              <div
                className="relative h-6 overflow-hidden rounded-full"
                style={{
                  background:
                    "linear-gradient(to right, #ef4444 0%, #f97316 25%, #fbbf24 45%, #d1d5db 50%, #86efac 55%, #22c55e 75%, #16a34a 100%)",
                }}
              >
                <div className="absolute bottom-0 top-0 w-0.5 bg-white/90" style={{ left: "50%", transform: "translateX(-50%)" }} />
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
                    abweichungChf <= 0 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"
                  }`}
                >
                  {abweichungChf <= 0 ? (
                    <>
                      <span className="font-semibold">Attraktives Investment: </span>
                      Der Angebotspreis liegt {Math.abs(abweichungProzent ?? 0).toFixed(1)}% unter dem Residualwert — Puffer{" "}
                      {fmtChf(Math.abs(abweichungChf))}.
                    </>
                  ) : (
                    <>
                      <span className="font-semibold">Wirtschaftlichkeit gefährdet: </span>
                      Der Angebotspreis liegt {Math.abs(abweichungProzent ?? 0).toFixed(1)}% über dem Residualwert —
                      Nachverhandlung oder Kostenoptimierung empfohlen.
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
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
