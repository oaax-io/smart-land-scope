import { createFileRoute } from "@tanstack/react-router";
import { Search, MapPinned } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/analysen")({
  head: () => ({ meta: [{ title: "Analysen — SmarTerra" }] }),
  component: AnalysenPage,
});

function AnalysenPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Grundstücksanalysen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Adresse oder Parzellennummer eingeben, um eine Analyse zu starten.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Neue Analyse</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input placeholder="Adresse, Parzellennummer oder EGRID" className="flex-1" />
            <Button>
              <Search className="mr-2 h-4 w-4" />
              Analysieren
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Die automatische Auswertung von Zonenplan, Ausnützungsziffer und Entwicklungspotenzial wird in Kürze aktiviert.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Alle Analysen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
              <MapPinned className="h-5 w-5" />
            </div>
            <p className="mt-4 font-medium">Noch keine Analysen</p>
            <p className="mt-1 text-sm text-muted-foreground">Starten Sie Ihre erste Analyse über das Eingabefeld oben.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
