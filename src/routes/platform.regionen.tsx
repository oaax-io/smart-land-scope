import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listRegionsAdmin,
  setCantonActive,
  setMunicipalityActive,
} from "@/lib/regions-admin.functions";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";

export const Route = createFileRoute("/platform/regionen")({
  component: RegionenPage,
});

type Canton = { id: string; code: string; name: string; active: boolean };
type Muni = { id: string; name: string; canton_id: string; active: boolean };

function RegionenPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["platform-regions"],
    queryFn: () => listRegionsAdmin(),
  });

  const cantonMut = useMutation({
    mutationFn: (vars: { id: string; active: boolean }) =>
      setCantonActive({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-regions"] });
      toast.success("Kanton aktualisiert");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  const muniMut = useMutation({
    mutationFn: (vars: { id: string; active: boolean }) =>
      setMunicipalityActive({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-regions"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
  });

  const [activeCanton, setActiveCanton] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const cantons: Canton[] = (data?.cantons as Canton[] | undefined) ?? [];
  const munis: Muni[] = (data?.municipalities as Muni[] | undefined) ?? [];

  const cantonById = useMemo(() => new Map(cantons.map((c) => [c.id, c])), [cantons]);
  const counts = useMemo(() => {
    const map = new Map<string, { total: number; active: number }>();
    for (const m of munis) {
      const e = map.get(m.canton_id) ?? { total: 0, active: 0 };
      e.total += 1;
      if (m.active) e.active += 1;
      map.set(m.canton_id, e);
    }
    return map;
  }, [munis]);

  const filteredMunis = useMemo(() => {
    let list = munis;
    if (activeCanton) list = list.filter((m) => m.canton_id === activeCanton);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q));
    }
    return list.slice(0, 500);
  }, [munis, activeCanton, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Regionen</h1>
        <p className="text-sm text-muted-foreground">
          Steuere, welche Kantone und Gemeinden in der Wissensdatenbank sichtbar sind.
          Deaktivierte Einträge erscheinen weder im Dashboard noch in den Analyse-Auswahlen.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kantone</CardTitle>
          <CardDescription>
            Schalte ganze Kantone an oder aus. Inaktive Kantone blenden automatisch alle ihre
            Gemeinden in der App aus.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {cantons.map((c) => {
                const cnt = counts.get(c.id) ?? { total: 0, active: 0 };
                const selected = activeCanton === c.id;
                return (
                  <div
                    key={c.id}
                    className={`flex items-center justify-between rounded-md border p-3 transition ${
                      selected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <button
                      type="button"
                      className="flex flex-1 flex-col items-start text-left"
                      onClick={() => setActiveCanton(selected ? null : c.id)}
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{c.code}</Badge>
                        <span className="font-medium">{c.name}</span>
                      </div>
                      <span className="mt-0.5 text-xs text-muted-foreground">
                        {cnt.active}/{cnt.total} Gemeinden aktiv
                      </span>
                    </button>
                    <Switch
                      checked={c.active}
                      onCheckedChange={(v) => cantonMut.mutate({ id: c.id, active: v })}
                      aria-label={`Kanton ${c.name} aktivieren`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Gemeinden{activeCanton ? ` – ${cantonById.get(activeCanton)?.name}` : ""}
          </CardTitle>
          <CardDescription>
            {activeCanton
              ? "Einzelne Gemeinden innerhalb des gewählten Kantons aktivieren/deaktivieren."
              : "Wähle oben einen Kanton, um seine Gemeinden zu filtern, oder suche unten direkt."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Gemeinde suchen…"
              className="pl-9"
            />
          </div>
          <div className="max-h-[480px] overflow-y-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2">Gemeinde</th>
                  <th className="px-3 py-2">Kanton</th>
                  <th className="px-3 py-2 text-right">Aktiv</th>
                </tr>
              </thead>
              <tbody>
                {filteredMunis.map((m) => {
                  const c = cantonById.get(m.canton_id);
                  return (
                    <tr key={m.id} className="border-t">
                      <td className="px-3 py-2">{m.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{c?.code ?? "–"}</td>
                      <td className="px-3 py-2 text-right">
                        <Switch
                          checked={m.active}
                          onCheckedChange={(v) =>
                            muniMut.mutate({ id: m.id, active: v })
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
                {filteredMunis.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                      Keine Gemeinden gefunden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {munis.length > 500 && !activeCanton && !search && (
            <p className="text-xs text-muted-foreground">
              Anzeige auf 500 Gemeinden begrenzt – nutze die Kanton-Auswahl oder die Suche.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
