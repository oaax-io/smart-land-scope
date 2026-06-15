import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FolderKanban, Plus, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/use-org";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/projekte")({
  head: () => ({ meta: [{ title: "Projekte — SmarTerra" }] }),
  component: ProjektePage,
});

function ProjektePage() {
  const { currentOrgId } = useOrg();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, description, status, created_at")
        .eq("organization_id", currentOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createProject = useMutation({
    mutationFn: async () => {
      if (!currentOrgId) throw new Error("Keine Organisation aktiv");
      if (!title.trim()) throw new Error("Titel erforderlich");
      const { error } = await supabase.from("projects").insert({
        organization_id: currentOrgId,
        title: title.trim(),
        description: description.trim() || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Projekt erstellt");
      setOpen(false);
      setTitle("");
      setDescription("");
      qc.invalidateQueries({ queryKey: ["projects", currentOrgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Projekte</h1>
          <p className="mt-1 text-sm text-muted-foreground">Bündeln Sie Analysen und Berichte in Projekten.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Neues Projekt
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Alle Projekte</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
                <FolderKanban className="h-5 w-5" />
              </div>
              <p className="mt-4 font-medium">Noch keine Projekte</p>
              <p className="mt-1 text-sm text-muted-foreground">Erstellen Sie ein Projekt, um Analysen zu organisieren.</p>
              <Button className="mt-4" onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Erstes Projekt anlegen
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  to="/projekte"
                  className="group rounded-lg border border-border p-4 transition hover:border-primary hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium leading-tight group-hover:text-primary">{p.title}</h3>
                    <Badge variant="secondary" className="capitalize">{p.status}</Badge>
                  </div>
                  {p.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                  )}
                  <p className="mt-3 text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString("de-CH")}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neues Projekt</DialogTitle>
            <DialogDescription>Erstellen Sie ein Projekt, um zugehörige Analysen zu bündeln.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="proj-title">Titel</Label>
              <Input id="proj-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Neubau Musterstrasse 12" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proj-desc">Beschreibung (optional)</Label>
              <Textarea id="proj-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={() => createProject.mutate()} disabled={createProject.isPending}>
              {createProject.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
