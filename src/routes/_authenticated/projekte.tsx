import { createFileRoute } from "@tanstack/react-router";
import { FolderKanban, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/projekte")({
  head: () => ({ meta: [{ title: "Projekte — SmarTerra" }] }),
  component: ProjekteePage,
});

function ProjekteePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Projekte</h1>
          <p className="mt-1 text-sm text-muted-foreground">Bündeln Sie Analysen und Berichte in Projekten.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Neues Projekt
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Alle Projekte</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
              <FolderKanban className="h-5 w-5" />
            </div>
            <p className="mt-4 font-medium">Noch keine Projekte</p>
            <p className="mt-1 text-sm text-muted-foreground">Erstellen Sie ein Projekt, um Analysen zu organisieren.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
