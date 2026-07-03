import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Loader2, RefreshCcw, ScrollText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { buildRegulationComparison } from "@/lib/regulation-comparison.functions";

type ZoneRow = {
  zone: string;
  values: Record<string, string | number | null>;
};

type ComparisonPayload = {
  current: {
    documents: Array<{ id: string; title: string; version: string | null; valid_from: string | null }>;
    zones: Record<string, ZoneRow>;
  };
  previous: {
    document: { title: string | null; version: string | null; valid_from: string | null; archived_at: string } | null;
    zones: Record<string, ZoneRow>;
  } | null;
  differences: Array<{ zone: string; key: string; label: string; previous: string | number | null; current: string | number | null }>;
  generated_at: string;
};

const CORE_FIELDS: Array<[string, string]> = [
  ["utilization_ratio", "AZ"],
  ["building_coverage_ratio", "ÜZ"],
  ["max_floors", "Vollgesch."],
  ["max_height_m", "Gebäudehöhe (m)"],
  ["gesamthoehe", "Gesamthöhe"],
  ["grenzabstand_klein", "Grenzabstand klein"],
  ["grenzabstand_gross", "Grenzabstand gross"],
  ["laermempfindlichkeitsstufe", "Lärmempf."],
];

function fmt(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  if (typeof v === "number") return v.toString().replace(".", ",");
  return String(v);
}

export function RegulationComparisonCard({
  analysisId,
  activeZone,
}: {
  analysisId: string;
  activeZone: string | null;
}) {
  const qc = useQueryClient();
  const buildFn = useServerFn(buildRegulationComparison);
  const [zoneFilter, setZoneFilter] = useState<string | null>(activeZone);

  const compQ = useQuery({
    queryKey: ["analysis-comparison", analysisId],
    queryFn: async () => {
      const { data } = await supabase
        .from("analyses")
        .select("regulation_comparison")
        .eq("id", analysisId)
        .maybeSingle();
      return (data?.regulation_comparison as unknown as ComparisonPayload | null) ?? null;
    },
  });

  const buildMut = useMutation({
    mutationFn: () => buildFn({ data: { analysisId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["analysis-comparison", analysisId] }),
  });

  const payload = compQ.data;
  const zoneCodes = useMemo(() => {
    if (!payload) return [] as string[];
    const s = new Set([
      ...Object.keys(payload.current.zones),
      ...Object.keys(payload.previous?.zones ?? {}),
    ]);
    return [...s].filter((z) => z !== "_allgemein").sort();
  }, [payload]);

  const shownZone = zoneFilter ?? activeZone ?? zoneCodes[0] ?? null;
  const cur = shownZone ? payload?.current.zones[shownZone] : undefined;
  const prev = shownZone ? payload?.previous?.zones[shownZone] : undefined;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="font-display text-base flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-secondary" />
            Rechtsstand-Vergleich (Alt vs. Neu)
          </CardTitle>
          <CardDescription>
            Gegenüberstellung der aktuellen und der zuvor gültigen Fassung des Bau- & Zonenreglements der Gemeinde.
          </CardDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => buildMut.mutate()}
          disabled={buildMut.isPending}
        >
          {buildMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
          <span className="ml-2">Neu berechnen</span>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {!payload && (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Noch keine Vergleichs-Auswertung. Klick auf „Neu berechnen".
          </div>
        )}

        {payload && !payload.previous && (
          <Alert>
            <AlertTitle>Keine Vorgänger-Fassung archiviert</AlertTitle>
            <AlertDescription>
              Aktuell sind nur Werte aus der laufenden Fassung
              {payload.current.documents[0]?.title ? ` „${payload.current.documents[0].title}"` : ""} hinterlegt.
              Sobald eine neue Reglementsversion hochgeladen und die alte deaktiviert wird, wird die vorherige Fassung automatisch archiviert und hier angezeigt.
            </AlertDescription>
          </Alert>
        )}

        {payload && payload.previous && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="secondary">Aktuell: {payload.current.documents[0]?.title ?? "—"}{payload.current.documents[0]?.version ? ` · v${payload.current.documents[0].version}` : ""}</Badge>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <Badge variant="outline">Vorher: {payload.previous.document?.title ?? "—"}{payload.previous.document?.version ? ` · v${payload.previous.document.version}` : ""}</Badge>
            </div>

            {zoneCodes.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {zoneCodes.map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setZoneFilter(z)}
                    className={`rounded-full border px-2 py-0.5 text-xs ${
                      z === shownZone
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {z}
                  </button>
                ))}
              </div>
            )}

            {shownZone && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                      <th className="py-2 pr-3">Kennzahl</th>
                      <th className="py-2 pr-3">Vorherige Fassung</th>
                      <th className="py-2 pr-3">Aktuelle Fassung</th>
                      <th className="py-2 pr-3">Änderung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CORE_FIELDS.map(([key, label]) => {
                      const a = prev?.values?.[key] ?? null;
                      const b = cur?.values?.[key] ?? null;
                      const changed = a !== b && (a != null || b != null);
                      return (
                        <tr key={key} className="border-b last:border-none">
                          <td className="py-1.5 pr-3 font-medium">{label}</td>
                          <td className="py-1.5 pr-3 text-muted-foreground">{fmt(a)}</td>
                          <td className="py-1.5 pr-3">{fmt(b)}</td>
                          <td className="py-1.5 pr-3">
                            {changed ? (
                              <Badge variant="secondary" className="text-xs">geändert</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">unverändert</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {payload.differences.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Keine Wert-Änderungen zwischen den beiden Fassungen für die verglichenen Zonen erkannt.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
