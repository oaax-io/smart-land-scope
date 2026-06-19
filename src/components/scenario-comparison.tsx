import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Loader2, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { createScenario, runScenarioAnalysis } from "@/lib/analyze-scenario.functions";

type Props = { analysisId: string; organizationId: string };

const STATUS_LABEL: Record<string, string> = {
  draft: "Entwurf",
  processing: "Wird berechnet …",
  completed: "Fertig",
  failed: "Fehlgeschlagen",
};

const fmtNum = (v: unknown, unit = "") => {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return "—";
  return `${n.toLocaleString("de-CH", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;
};

export function ScenarioComparison({ analysisId, organizationId }: Props) {
  const qc = useQueryClient();
  const createFn = useServerFn(createScenario);
  const runFn = useServerFn(runScenarioAnalysis);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [assumption, setAssumption] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const scenariosQ = useQuery({
    queryKey: ["analysis-scenarios", analysisId],
    refetchInterval: (q) => {
      const list = (q.state.data as Array<{ status: string }> | undefined) ?? [];
      return list.some((s) => s.status === "processing" || s.status === "draft") ? 3000 : false;
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analysis_scenarios")
        .select("*")
        .eq("analysis_id", analysisId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function handleCreate() {
    if (!label.trim() || !assumption.trim()) return;
    setSubmitting(true);
    try {
      const { scenarioId } = await createFn({
        data: {
          analysisId,
          organizationId,
          label: label.trim(),
          usageAssumption: assumption.trim(),
        },
      });
      toast.success("Variante wird ausgewertet …");
      setOpen(false);
      setLabel("");
      setAssumption("");
      qc.invalidateQueries({ queryKey: ["analysis-scenarios", analysisId] });
      runFn({ data: { scenarioId } })
        .catch((e) => {
          toast.error("Auswertung fehlgeschlagen", {
            description: e instanceof Error ? e.message : undefined,
          });
        })
        .finally(() => {
          qc.invalidateQueries({ queryKey: ["analysis-scenarios", analysisId] });
        });
    } catch (e) {
      toast.error("Variante konnte nicht erstellt werden", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    await supabase.from("analysis_scenarios").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["analysis-scenarios", analysisId] });
  }

  async function handleRerun(id: string) {
    try {
      await runFn({ data: { scenarioId: id } });
    } catch (e) {
      toast.error("Auswertung fehlgeschlagen", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      qc.invalidateQueries({ queryKey: ["analysis-scenarios", analysisId] });
    }
  }

  const scenarios = (scenariosQ.data ?? []) as Array<Record<string, unknown>>;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Vergleichen Sie unterschiedliche Nutzungsannahmen für dieselbe Parzelle nebeneinander.
        </p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Variante hinzufügen
        </Button>
      </div>

      {scenarios.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Noch keine Varianten erfasst. Fügen Sie z. B. „Vollständig Wohnen" und „Erdgeschoss
            Gewerbe + Wohnen darüber" hinzu, um zu vergleichen.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {scenarios.map((s) => {
            const status = String(s.status ?? "draft");
            return (
              <Card key={String(s.id)} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="flex items-start justify-between gap-2 text-base">
                    <span className="font-display">{String(s.label)}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(String(s.id))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{String(s.usage_assumption)}</p>
                  <div className="flex items-center gap-2 pt-1">
                    <Badge variant={status === "completed" ? "default" : "secondary"}>
                      {status === "processing" && (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      )}
                      {STATUS_LABEL[status] ?? status}
                    </Badge>
                    {status === "failed" && (
                      <Button size="sm" variant="ghost" onClick={() => handleRerun(String(s.id))}>
                        Neu auswerten
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {status === "failed" && Boolean(s.error_message) && (
                    <p className="text-xs text-destructive">{String(s.error_message)}</p>
                  )}
                  {status === "completed" && (
                    <>
                      <Row label="Zone" value={s.zone ? String(s.zone) : "—"} />
                      <Row label="Geschosse" value={fmtNum(s.max_floors)} />
                      <Row label="AZ" value={fmtNum(s.utilization_ratio)} />
                      <Row label="Geschossfläche" value={fmtNum(s.floor_area, "m²")} />
                      <Row label="Wohnfläche" value={fmtNum(s.living_area, "m²")} />
                      <Row label="Gewerbefläche" value={fmtNum(s.commercial_area, "m²")} />
                      <Row label="Wohneinheiten" value={fmtNum(s.unit_count)} />
                      <Row label="Potenzial" value={s.potential_level ? String(s.potential_level) : "—"} />
                      {s.ai_summary ? (
                        <p className="pt-2 text-xs text-muted-foreground">
                          {String(s.ai_summary)}
                        </p>
                      ) : null}
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neue Variante</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Bezeichnung</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="z. B. Vollständig Wohnen"
              />
            </div>
            <div className="space-y-1">
              <Label>Nutzungsannahme</Label>
              <Textarea
                value={assumption}
                onChange={(e) => setAssumption(e.target.value)}
                rows={3}
                placeholder="z. B. Erdgeschoss Gewerbe/Gastronomie, 1.–4. OG Wohnen, Attika Wohnen"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleCreate}
              disabled={submitting || !label.trim() || !assumption.trim()}
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Auswerten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium">{value || "—"}</span>
    </div>
  );
}
