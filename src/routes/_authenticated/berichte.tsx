import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FileText, Plus, Loader2, ExternalLink } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/use-org";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/berichte")({
  head: () => ({ meta: [{ title: "Berichte — SmarTerra" }] }),
  component: BerichtePage,
});

function BerichtePage() {
  const { currentOrgId } = useOrg();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [analysisId, setAnalysisId] = useState<string>("");

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["reports", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("id, report_url, created_at, analysis_id, analyses!inner(id, organization_id, parcels(address, municipality))")
        .eq("analyses.organization_id", currentOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Array<{
        id: string;
        report_url: string;
        created_at: string;
        analysis_id: string;
        analyses: { id: string; parcels: { address: string | null; municipality: string | null } | null };
      }>;
    },
  });

  const { data: analyses = [] } = useQuery({
    queryKey: ["analyses-for-report", currentOrgId],
    enabled: !!currentOrgId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analyses")
        .select("id, created_at, parcels(address, municipality)")
        .eq("organization_id", currentOrgId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as unknown as Array<{
        id: string;
        created_at: string;
        parcels: { address: string | null; municipality: string | null } | null;
      }>;
    },
  });

  const createReport = useMutation({
    mutationFn: async () => {
      if (!analysisId) throw new Error("Bitte Analyse wählen");
      const url = `/analysen/${analysisId}/bericht`;
      const { error } = await supabase.from("reports").insert({
        analysis_id: analysisId,
        report_url: url,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      return analysisId;
    },
    onSuccess: (id) => {
      toast.success("Bericht erstellt");
      setOpen(false);
      setAnalysisId("");
      qc.invalidateQueries({ queryKey: ["reports", currentOrgId] });
      navigate({ to: "/analysen/$id/bericht", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Berichte</h1>
          <p className="mt-1 text-sm text-muted-foreground">Erstellen Sie professionelle Reports aus Ihren Analysen.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Neuer Bericht
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Alle Berichte</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
                <FileText className="h-5 w-5" />
              </div>
              <p className="mt-4 font-medium">Noch keine Berichte</p>
              <p className="mt-1 text-sm text-muted-foreground">Erzeugen Sie einen Bericht aus einer bestehenden Analyse.</p>
              <Button className="mt-4" onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Bericht erstellen
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {reports.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {r.analyses?.parcels?.address ?? "Analyse"}
                      {r.analyses?.parcels?.municipality && (
                        <span className="text-muted-foreground"> · {r.analyses.parcels.municipality}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("de-CH")}</p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/analysen/$id/bericht" params={{ id: r.analysis_id }}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Öffnen
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuer Bericht</DialogTitle>
            <DialogDescription>Wählen Sie eine Analyse als Grundlage für den Bericht.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Analyse</Label>
              {analyses.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Noch keine Analysen vorhanden. Legen Sie zuerst eine{" "}
                  <Link to="/analysen/neu" className="text-primary underline">Analyse</Link> an.
                </p>
              ) : (
                <Select value={analysisId} onValueChange={setAnalysisId}>
                  <SelectTrigger><SelectValue placeholder="Analyse wählen" /></SelectTrigger>
                  <SelectContent>
                    {analyses.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.parcels?.address ?? "Ohne Adresse"}
                        {a.parcels?.municipality ? ` · ${a.parcels.municipality}` : ""}
                        {" · "}
                        {new Date(a.created_at).toLocaleDateString("de-CH")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={() => createReport.mutate()} disabled={createReport.isPending || !analysisId}>
              {createReport.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
