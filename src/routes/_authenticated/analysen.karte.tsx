import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, MapPin, Sparkles, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SwissMap } from "@/components/swiss-map";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/use-org";
import { useAuth } from "@/hooks/use-auth";
import { runKnowledgeAnalysis } from "@/lib/analyze-knowledge.functions";

export const Route = createFileRoute("/_authenticated/analysen/karte")({
  head: () => ({ meta: [{ title: "Karte — SmarTerra" }] }),
  component: KartePage,
});

type Selected = {
  lat: number;
  lng: number;
  address: string | null;
  postalCode: string | null;
  municipality: string | null;
  canton: string | null;
  parcelNumber: string | null;
  egrid: string | null;
};

function KartePage() {
  const navigate = useNavigate();
  const { currentOrgId } = useOrg();
  const { user } = useAuth();
  const analyzeFn = useServerFn(runKnowledgeAnalysis);

  const [selected, setSelected] = useState<Selected | null>(null);
  const [areaSize, setAreaSize] = useState<string>("");

  const createAnalysis = useMutation({
    mutationFn: async () => {
      if (!currentOrgId) throw new Error("Keine aktive Organisation");
      if (!selected) throw new Error("Bitte zuerst eine Parzelle auswählen");
      if (!selected.address) throw new Error("Adresse konnte nicht ermittelt werden");
      if (!selected.municipality || !selected.canton) {
        throw new Error("Gemeinde und Kanton konnten nicht ermittelt werden");
      }
      const area = Number(areaSize);
      if (!area || area <= 0) throw new Error("Bitte Grundstücksfläche angeben");

      const { data: created, error } = await supabase
        .from("analyses")
        .insert({
          organization_id: currentOrgId,
          address: selected.address,
          postal_code: selected.postalCode,
          municipality: selected.municipality,
          canton: selected.canton,
          parcel_number: selected.parcelNumber,
          area_size: area,
          lat: selected.lat,
          lng: selected.lng,
          egrid: selected.egrid,
          status: "processing",
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;

      analyzeFn({ data: { analysisId: created.id } }).catch((e: unknown) =>
        console.error("KI-Analyse fehlgeschlagen", e),
      );
      return created;
    },
    onSuccess: (data) => {
      toast.success("Analyse gestartet");
      navigate({ to: "/analysen/$id", params: { id: data.id } });
    },
    onError: (e: Error) => toast.error("Fehler", { description: e.message }),
  });

  return (
    <div className="-m-6 relative h-[calc(100vh-3.5rem)] overflow-hidden">
      <SwissMap
        mode="interactive"
        floatingSearch
        allowExpand={false}
        showCantons
        heightClassName="h-full"
        lat={selected?.lat ?? null}
        lng={selected?.lng ?? null}
        onParcelSelected={(d) => {
          setSelected(d);
          setAreaSize("");
        }}
      />

      {selected && (
        <Card className="absolute right-4 top-20 z-30 w-[min(92vw,22rem)] shadow-2xl">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 font-display text-base">
                  <MapPin className="h-4 w-4 text-secondary" />
                  Parzelle ausgewählt
                </CardTitle>
                <CardDescription className="mt-1 truncate">
                  {selected.address ?? "Adresse unbekannt"}
                </CardDescription>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="-mr-1 -mt-1 h-7 w-7 shrink-0"
                onClick={() => setSelected(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <InfoField label="PLZ / Ort" value={[selected.postalCode, selected.municipality].filter(Boolean).join(" ") || "—"} />
              <InfoField label="Kanton" value={selected.canton ?? "—"} />
              <InfoField label="Parzelle" value={selected.parcelNumber ?? "—"} />
              <InfoField label="E-GRID" value={selected.egrid ?? "—"} mono />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="karte-area" className="text-xs font-medium">
                Grundstücksfläche (m²)
              </Label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="karte-area"
                  type="number"
                  inputMode="decimal"
                  placeholder="z.B. 450"
                  className="pl-9"
                  value={areaSize}
                  onChange={(e) => setAreaSize(e.target.value)}
                />
              </div>
            </div>

            {(!selected.municipality || !selected.canton) && (
              <Badge variant="outline" className="w-full justify-center py-1.5 text-xs">
                Gemeinde / Kanton fehlt — andere Parzelle wählen
              </Badge>
            )}

            <Button
              className="w-full"
              onClick={() => createAnalysis.mutate()}
              disabled={createAnalysis.isPending}
            >
              {createAnalysis.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Analysieren
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Die KI-Auswertung nutzt die hinterlegte Wissensdatenbank der Gemeinde.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`truncate text-sm ${mono ? "font-mono text-xs" : ""}`} title={value}>
        {value}
      </div>
    </div>
  );
}
