import { useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ArrowLeft, FileUp, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrg } from "@/hooks/use-org";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { runAnalysis } from "@/lib/analyze.functions";

export const Route = createFileRoute("/_authenticated/analysen/neu")({
  head: () => ({ meta: [{ title: "Neue Analyse — SmarTerra" }] }),
  component: NewAnalysisPage,
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

const MAX_DOC_BYTES = 15 * 1024 * 1024; // 15 MB

const schema = z.object({
  address: z.string().trim().min(2, "Adresse ist erforderlich").max(200),
  postal_code: z.string().trim().regex(/^\d{4}$/, "4-stellige PLZ"),
  municipality: z.string().trim().min(1, "Ort ist erforderlich").max(100),
  canton: z.string().length(2, "Kanton wählen"),
  parcel_number: z.string().trim().max(50).optional().or(z.literal("")),
  area_size: z.string().trim().optional().or(z.literal("")),
});

function NewAnalysisPage() {
  const { currentOrgId } = useOrg();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const analyzeFn = useServerFn(runAnalysis);

  const [form, setForm] = useState({
    address: "", postal_code: "", municipality: "",
    canton: "", parcel_number: "", area_size: "",
  });
  const [doc, setDoc] = useState<File | null>(null);

  const set = <K extends keyof typeof form>(k: K, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof schema>) => {
      if (!currentOrgId) throw new Error("Keine aktive Organisation");
      const area = values.area_size ? Number(values.area_size) : null;

      const { data: created, error } = await supabase
        .from("analyses")
        .insert({
          organization_id: currentOrgId,
          address: values.address,
          postal_code: values.postal_code,
          municipality: values.municipality,
          canton: values.canton,
          parcel_number: values.parcel_number || null,
          area_size: area,
          status: "processing",
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;

      let documentPath: string | null = null;
      let documentName: string | null = null;
      if (doc) {
        const safeName = doc.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
        const path = `${currentOrgId}/${created.id}/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("analysis-documents")
          .upload(path, doc, { upsert: false, contentType: doc.type || undefined });
        if (upErr) throw upErr;
        documentPath = path;
        documentName = doc.name;
        const { error: updErr } = await supabase
          .from("analyses")
          .update({ document_path: documentPath, document_name: documentName })
          .eq("id", created.id);
        if (updErr) throw updErr;
      }

      // Fire-and-forget KI-Auswertung
      analyzeFn({ data: { analysisId: created.id } }).catch((e) =>
        console.error("KI-Analyse fehlgeschlagen", e),
      );

      return created;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["analyses"] });
      toast.success("Analyse gestartet", {
        description: "Die KI wertet die Daten aus — das dauert ca. 10 – 30 Sek.",
      });
      navigate({ to: "/analysen/$id", params: { id: data.id } });
    },
    onError: (e: Error) => toast.error("Fehler", { description: e.message }),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error("Bitte Formular prüfen", { description: parsed.error.issues[0]?.message });
      return;
    }
    mutation.mutate(parsed.data);
  }

  function pickFile(f: File | null) {
    if (!f) { setDoc(null); return; }
    if (f.size > MAX_DOC_BYTES) {
      toast.error("Datei zu gross", { description: "Maximale Grösse: 15 MB" });
      return;
    }
    setDoc(f);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link to="/analysen"><ArrowLeft className="mr-1 h-4 w-4" />Zurück</Link>
        </Button>
        <h1 className="font-display text-3xl font-bold tracking-tight">Neue Machbarkeitsanalyse</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Erfassen Sie das Grundstück und laden Sie optional das kommunale BZR/BZO-Dokument hoch.
          Die KI erstellt anschliessend automatisch die Auswertung.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Grundstücksdaten</CardTitle>
          <CardDescription>Felder mit * sind erforderlich.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="address">Adresse *</Label>
              <Input id="address" placeholder="z. B. Bahnhofstrasse 1" value={form.address}
                onChange={(e) => set("address", e.target.value)} maxLength={200} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[140px_1fr]">
              <div className="space-y-1.5">
                <Label htmlFor="plz">PLZ *</Label>
                <Input id="plz" inputMode="numeric" placeholder="8001" value={form.postal_code}
                  onChange={(e) => set("postal_code", e.target.value.replace(/\D/g, "").slice(0, 4))}
                  maxLength={4} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ort">Gemeinde / Ort *</Label>
                <Input id="ort" placeholder="Zürich" value={form.municipality}
                  onChange={(e) => set("municipality", e.target.value)} maxLength={100} />
              </div>
            </div>

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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="area">Grundstücksfläche (m²) *</Label>
                <Input id="area" inputMode="decimal" placeholder="z. B. 850" value={form.area_size}
                  onChange={(e) => set("area_size", e.target.value.replace(/[^\d.]/g, ""))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="parc">Parzellennummer (optional)</Label>
                <Input id="parc" placeholder="z. B. 1234" value={form.parcel_number}
                  onChange={(e) => set("parcel_number", e.target.value)} maxLength={50} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>BZR / BZO-Dokument (optional)</Label>
              <div className="rounded-lg border border-dashed bg-muted/30 p-4">
                {doc ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(doc.size / 1024).toFixed(0)} KB
                      </p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => pickFile(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-2 text-center">
                    <FileUp className="h-6 w-6 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Bau- und Zonenreglement der Gemeinde hochladen (PDF, TXT, DOCX, max. 15 MB)
                    </p>
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                      Datei auswählen
                    </Button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.doc,.docx"
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" type="button" asChild>
                <Link to="/analysen">Abbrechen</Link>
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                KI-Analyse starten
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
