import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  MapPin,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useOrg } from "@/hooks/use-org";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  checkMunicipalityCoverage,
  runKnowledgeAnalysis,
} from "@/lib/analyze-knowledge.functions";
import { SwissMap } from "@/components/swiss-map";

export const Route = createFileRoute("/_authenticated/analysen/neu")({
  head: () => ({ meta: [{ title: "Neue Analyse — SmarTerra" }] }),
  component: NewAnalysisWizard,
});

const KANTONE = [
  ["AG","Aargau"],["AI","Appenzell Innerrhoden"],["AR","Appenzell Ausserrhoden"],
  ["BE","Bern"],["BL","Basel-Landschaft"],["BS","Basel-Stadt"],
  ["FR","Freiburg"],["GE","Genf"],["GL","Glarus"],["GR","Graubünden"],
  ["JU","Jura"],["LU","Luzern"],["NE","Neuenburg"],["NW","Nidwalden"],
  ["OW","Obwalden"],["SG","St. Gallen"],["SH","Schaffhausen"],
  ["SO","Solothurn"],["SZ","Schwyz"],["TG","Thurgau"],["TI","Tessin"],
  ["UR","Uri"],["VD","Waadt"],["VS","Wallis"],["ZG","Zug"],["ZH","Zürich"],
] as const;

const formSchema = z.object({
  address: z.string().trim().min(2, "Adresse ist erforderlich").max(200),
  municipality: z.string().trim().min(1, "Gemeinde ist erforderlich").max(100),
  canton: z.string().length(2, "Kanton wählen"),
  area_size: z
    .string()
    .trim()
    .min(1, "Grundstücksfläche erforderlich")
    .refine((v) => Number(v) > 0, "Fläche > 0"),
  parcel_number: z.string().trim().max(50).optional().or(z.literal("")),
  postal_code: z.string().trim().optional().or(z.literal("")),
});

function NewAnalysisWizard() {
  const { currentOrgId } = useOrg();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const analyzeFn = useServerFn(runKnowledgeAnalysis);
  const coverageFn = useServerFn(checkMunicipalityCoverage);

  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    address: "", postal_code: "", municipality: "",
    canton: "", parcel_number: "", area_size: "",
    lat: null as number | null,
    lng: null as number | null,
    egrid: null as string | null,
  });

  const set = (k: "address" | "postal_code" | "municipality" | "canton" | "parcel_number" | "area_size", v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const stepOneValid = useMemo(
    () => formSchema.safeParse(form).success,
    [form],
  );

  // Debounce municipality/canton for the coverage lookup
  const [debounced, setDebounced] = useState({ municipality: "", canton: "" });
  useEffect(() => {
    const t = setTimeout(
      () => setDebounced({ municipality: form.municipality.trim(), canton: form.canton }),
      350,
    );
    return () => clearTimeout(t);
  }, [form.municipality, form.canton]);

  const coverage = useQuery({
    queryKey: ["municipality-coverage", debounced.municipality, debounced.canton],
    enabled: debounced.municipality.length >= 2 && debounced.canton.length === 2,
    queryFn: () =>
      coverageFn({
        data: { municipality: debounced.municipality, canton: debounced.canton },
      }),
    staleTime: 30_000,
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!currentOrgId) throw new Error("Keine aktive Organisation");
      const parsed = formSchema.safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Formular ungültig");

      // 1. Create analysis directly in "processing"
      const { data: created, error } = await supabase
        .from("analyses")
        .insert({
          organization_id: currentOrgId,
          address: parsed.data.address,
          postal_code: parsed.data.postal_code || null,
          municipality: parsed.data.municipality,
          canton: parsed.data.canton,
          parcel_number: parsed.data.parcel_number || null,
          area_size: Number(parsed.data.area_size),
          lat: form.lat,
          lng: form.lng,
          egrid: form.egrid,
          status: "processing",
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;

      // 2. Fire-and-forget AI knowledge analysis
      analyzeFn({ data: { analysisId: created.id } }).catch((e: unknown) =>
        console.error("KI-Analyse fehlgeschlagen", e),
      );

      return created;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["analyses"] });
      toast.success("Analyse gestartet", {
        description: "Die KI nutzt die hinterlegte Wissensdatenbank der Gemeinde.",
      });
      navigate({ to: "/analysen/$id", params: { id: data.id } });
    },
    onError: (e: Error) => toast.error("Fehler", { description: e.message }),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link to="/analysen"><ArrowLeft className="mr-1 h-4 w-4" />Zurück</Link>
        </Button>
        <h1 className="font-display text-3xl font-bold tracking-tight">Schnellanalyse</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          In drei Schritten zur KI-gestützten Machbarkeitsanalyse.
        </p>
      </div>

      <Stepper step={step} />

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <MapPin className="h-4 w-4 text-secondary" />
              Schritt 1 — Grundstücksdaten
            </CardTitle>
            <CardDescription>Felder mit * sind erforderlich.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label>Grundstück auf der Karte suchen (empfohlen)</Label>
              <SwissMap
                mode="interactive"
                lat={form.lat}
                lng={form.lng}
                onParcelSelected={(data) => {
                  setForm((f) => ({
                    ...f,
                    lat: data.lat,
                    lng: data.lng,
                    egrid: data.egrid ?? f.egrid,
                    address: f.address.trim().length === 0 ? (data.address ?? f.address) : f.address,
                    municipality: data.municipality ?? f.municipality,
                    canton: data.canton ?? f.canton,
                    parcel_number: data.parcelNumber ?? f.parcel_number,
                  }));
                  if (data.municipality) {
                    toast.success("Grundstück erkannt", {
                      description: [data.municipality, data.canton].filter(Boolean).join(", "),
                    });
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Felder unten können danach noch angepasst werden.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="address">Adresse *</Label>
              <Input id="address" placeholder="z. B. Bahnhofstrasse 1" value={form.address}
                onChange={(e) => set("address", e.target.value)} maxLength={200} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[140px_1fr]">
              <div className="space-y-1.5">
                <Label htmlFor="plz">PLZ</Label>
                <Input id="plz" inputMode="numeric" placeholder="8001" value={form.postal_code}
                  onChange={(e) => set("postal_code", e.target.value.replace(/\D/g, "").slice(0, 4))}
                  maxLength={4} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ort">Gemeinde *</Label>
                <Input id="ort" placeholder="Zürich" value={form.municipality}
                  onChange={(e) => set("municipality", e.target.value)} maxLength={100} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="kanton">Kanton *</Label>
                <Select value={form.canton} onValueChange={(v) => set("canton", v)}>
                  <SelectTrigger id="kanton"><SelectValue placeholder="Kanton wählen" /></SelectTrigger>
                  <SelectContent>
                    {KANTONE.map(([code, name]) => (
                      <SelectItem key={code} value={code}>{code} — {name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="area">Grundstücksfläche (m²) *</Label>
                <Input id="area" inputMode="decimal" placeholder="z. B. 850" value={form.area_size}
                  onChange={(e) => set("area_size", e.target.value.replace(/[^\d.]/g, ""))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="parc">Parzellennummer (optional)</Label>
              <Input id="parc" placeholder="z. B. 1234" value={form.parcel_number}
                onChange={(e) => set("parcel_number", e.target.value)} maxLength={50} />
            </div>

            <CoverageHint
              loading={coverage.isFetching}
              data={coverage.data}
              enabled={debounced.municipality.length >= 2 && debounced.canton.length === 2}
              municipality={debounced.municipality}
              canton={debounced.canton}
            />

            <div className="flex justify-end pt-2">
              <Button onClick={() => setStep(2)} disabled={!stepOneValid}>
                Weiter <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <CheckCircle2 className="h-4 w-4 text-secondary" />
              Schritt 2 — Übersicht & Start
            </CardTitle>
            <CardDescription>
              Die KI nutzt die hinterlegte Wissensdatenbank der Gemeinde — kein manueller Dokumenten-Upload nötig.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <SummaryRow label="Adresse" value={form.address} />
              <SummaryRow label="PLZ / Ort" value={[form.postal_code, form.municipality].filter(Boolean).join(" ")} />
              <SummaryRow label="Kanton" value={form.canton} />
              <SummaryRow label="Fläche" value={form.area_size ? `${form.area_size} m²` : "—"} />
              <SummaryRow label="Parzelle" value={form.parcel_number || "—"} />
              {form.lat != null && form.lng != null && (
                <SummaryRow
                  label="Koordinaten"
                  value={`${form.lat.toFixed(5)}, ${form.lng.toFixed(5)}${form.egrid ? ` · E-GRID ${form.egrid}` : ""}`}
                />
              )}
            </div>

            <CoverageHint
              loading={coverage.isFetching}
              data={coverage.data}
              enabled={debounced.municipality.length >= 2 && debounced.canton.length === 2}
              municipality={debounced.municipality}
              canton={debounced.canton}
            />

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(1)} disabled={submit.isPending}>
                <ArrowLeft className="mr-2 h-4 w-4" />Zurück
              </Button>
              <Button onClick={() => submit.mutate()} disabled={submit.isPending || !stepOneValid}>
                {submit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Analyse starten
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}

function Stepper({ step }: { step: 1 | 2 }) {
  const items = [
    { n: 1, label: "Grundstück" },
    { n: 2, label: "Start" },
  ];
  return (
    <ol className="flex items-center gap-2 text-sm">
      {items.map((it, idx) => (
        <li key={it.n} className="flex items-center gap-2">
          <div
            className={cn(
              "grid h-7 w-7 place-items-center rounded-full border text-xs font-medium",
              step === it.n
                ? "border-primary bg-primary text-primary-foreground"
                : step > it.n
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground",
            )}
          >
            {step > it.n ? <CheckCircle2 className="h-4 w-4" /> : it.n}
          </div>
          <span className={cn("hidden sm:inline", step === it.n ? "font-medium" : "text-muted-foreground")}>
            {it.label}
          </span>
          {idx < items.length - 1 && <div className="mx-2 h-px w-8 bg-border sm:w-12" />}
        </li>
      ))}
    </ol>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value || "—"}</p>
    </div>
  );
}

type CoverageData = Awaited<ReturnType<typeof checkMunicipalityCoverage>>;

function CoverageHint({
  loading,
  data,
  enabled,
  municipality,
  canton,
}: {
  loading: boolean;
  data: CoverageData | undefined;
  enabled: boolean;
  municipality: string;
  canton: string;
}) {
  const { user } = useAuth();
  const isAdminQ = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
  });
  const isAdmin = !!isAdminQ.data;

  if (!enabled) return null;
  if (loading) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Wissensdatenbank wird geprüft …
      </p>
    );
  }
  if (!data) return null;

  const captureBtn = isAdmin ? (
    <Button asChild size="sm" variant="default" className="mt-2">
      <Link
        to="/admin/reglemente"
        search={{ canton, gemeinde: municipality }}
      >
        <Upload className="mr-2 h-4 w-4" /> Reglemente erfassen
      </Link>
    </Button>
  ) : null;

  if (!data.exists) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Gemeinde noch nicht verfügbar</AlertTitle>
        <AlertDescription>
          Für „{municipality}" ({canton}) sind noch keine Reglemente hinterlegt.
          {isAdmin
            ? " Als Administrator können Sie die Reglemente jetzt erfassen."
            : " Sobald ein Administrator die Reglemente erfasst hat, kann die Analyse starten."}
          {captureBtn}
        </AlertDescription>
      </Alert>
    );
  }

  if (!data.ready) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Wissensdatenbank noch leer</AlertTitle>
        <AlertDescription>
          {data.municipalityName} ist erfasst ({data.documentCount} Dokument(e)), aber
          es wurden noch keine Vorschriften extrahiert.
          {captureBtn}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="border-secondary/40 bg-secondary/5">
      <CheckCircle2 className="h-4 w-4 text-secondary" />
      <AlertTitle>Wissensdatenbank verfügbar</AlertTitle>
      <AlertDescription>
        {data.municipalityName} ({data.cantonCode}) — {data.entryCount} Einträge,{" "}
        {data.ruleCount} Regeln aus {data.documentCount} Reglement(en).
      </AlertDescription>
    </Alert>
  );
}
