import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPinned, Plus, ArrowRight, Trash2, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useOrg } from "@/hooks/use-org";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/analysen/")({
  head: () => ({ meta: [{ title: "Analysen — SmarTerra" }] }),
  component: AnalysenListPage,
});

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Entwurf", variant: "outline" },
  processing: { label: "In Analyse", variant: "secondary" },
  pending: { label: "Wartend", variant: "secondary" },
  completed: { label: "Analyse abgeschlossen", variant: "default" },
  failed: { label: "Analyse fehlgeschlagen", variant: "destructive" },
};

function AnalysenListPage() {
  const { currentOrgId } = useOrg();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: analyses = [], isLoading } = useQuery({
    queryKey: ["analyses", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analyses")
        .select("id, address, parcel_number, municipality, canton, status, created_at")
        .eq("organization_id", currentOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const allSelected = useMemo(
    () => analyses.length > 0 && selected.size === analyses.length,
    [analyses, selected],
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => (prev.size === analyses.length ? new Set() : new Set(analyses.map((a) => a.id))));
  };

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("analyses").delete().in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      toast.success(count === 1 ? "Analyse gelöscht" : `${count} Analysen gelöscht`);
      setSelected(new Set());
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["analyses", currentOrgId] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Löschen fehlgeschlagen";
      toast.error(msg);
    },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Grundstücksanalysen</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Übersicht aller laufenden und abgeschlossenen Analysen Ihrer Organisation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              {selected.size === 1 ? "Löschen" : `${selected.size} löschen`}
            </Button>
          )}
          <Button asChild>
            <Link to="/dashboard">
              <Plus className="mr-2 h-4 w-4" />
              Neue Analyse
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="font-display text-lg">Alle Analysen</CardTitle>
          {analyses.length > 0 && (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              Alle auswählen
            </label>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Lade …</p>
          ) : analyses.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
                <MapPinned className="h-5 w-5" />
              </div>
              <p className="mt-4 font-medium">Noch keine Analysen</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Starten Sie Ihre erste Grundstücksanalyse — Adresse, Parzelle, Zone und Potenzial in einem Schritt.
              </p>
              <Button asChild className="mt-5">
                <Link to="/dashboard">
                  <Plus className="mr-2 h-4 w-4" />
                  Neue Analyse
                </Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y rounded-lg border">
              {analyses.map((a) => {
                const s = statusLabels[a.status as string] ?? { label: a.status as string, variant: "secondary" as const };
                const isChecked = selected.has(a.id);
                return (
                  <div
                    key={a.id}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 ${
                      isChecked ? "bg-muted/30" : ""
                    }`}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggle(a.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Analyse auswählen"
                    />
                    <button
                      type="button"
                      onClick={() => navigate({ to: "/analysen/$id", params: { id: a.id } })}
                      className="flex min-w-0 flex-1 items-center justify-between gap-4 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{a.address ?? "Ohne Adresse"}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {[a.parcel_number && `Parz. ${a.parcel_number}`, a.municipality, a.canton]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <Badge variant={s.variant}>{s.label}</Badge>
                      <span className="hidden text-xs text-muted-foreground sm:inline">
                        {new Date(a.created_at).toLocaleDateString("de-CH")}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selected.size === 1 ? "Analyse löschen?" : `${selected.size} Analysen löschen?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Zugehörige Dokumente, Ergebnisse und Varianten werden ebenfalls entfernt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                deleteMutation.mutate(Array.from(selected));
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Lösche …
                </>
              ) : (
                "Endgültig löschen"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
