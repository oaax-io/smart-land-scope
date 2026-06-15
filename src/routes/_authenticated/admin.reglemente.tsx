import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Building2, MapPin, FileText, Upload, Trash2, Download, Plus, ShieldAlert,
  Sparkles, Loader2, CheckCircle2, AlertCircle, RefreshCw, BookOpen, Layers,
  CloudUpload, X,
} from "lucide-react";
import { extractRegulationDocument } from "@/lib/regulation-extract.functions";

export const Route = createFileRoute("/_authenticated/admin/reglemente")({
  component: ReglementePage,
});

const DOC_TYPES = ["BZR", "BZO", "Zonenplan", "Gestaltungsplan", "Sondervorschriften", "Sonstige"] as const;
type DocType = (typeof DOC_TYPES)[number];

type Canton = { id: string; code: string; name: string };
type Municipality = { id: string; canton_id: string; name: string };
type DocRow = {
  id: string;
  doc_type: DocType;
  title: string;
  version: string | null;
  file_path: string;
  file_name: string | null;
  created_at: string;
  municipality_id: string;
  municipality: { id: string; name: string; canton: { code: string; name: string } | null } | null;
  extraction: {
    status: string | null;
    error_message: string | null;
    processed_at: string | null;
    zones: unknown;
  } | null;
  entry_count: number;
};

function useIsAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles").select("role").eq("user_id", user!.id).eq("role", "admin").maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
}

function ReglementePage() {
  const { data: isAdmin, isLoading: roleLoading } = useIsAdmin();
  const [open, setOpen] = useState(false);

  if (roleLoading) return <div className="p-6 text-muted-foreground">Lade…</div>;
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl pt-12">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              <CardTitle>Zugriff verweigert</CardTitle>
            </div>
            <CardDescription>Dieses Modul ist nur für Plattform-Administratoren zugänglich.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Reglemente</h1>
          <p className="text-muted-foreground">
            Schweizer Bau- und Zonenreglemente — zentrale Wissensdatenbank.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">Admin</Badge>
          <Button onClick={() => setOpen(true)} size="lg" className="gap-2">
            <Plus className="h-4 w-4" /> Reglement hinzufügen
          </Button>
        </div>
      </div>

      <KnowledgeBaseDashboard />
      <DocumentsList />
      <AddRegulationDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

// =====================================================================
// Dashboard
// =====================================================================

function KnowledgeBaseDashboard() {
  const stats = useQuery({
    queryKey: ["kb-stats"],
    queryFn: async () => {
      const [c, m, d, e] = await Promise.all([
        supabase.from("cantons").select("id", { count: "exact", head: true }),
        supabase.from("municipalities").select("id", { count: "exact", head: true }),
        supabase.from("regulation_documents").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("knowledge_entries").select("id", { count: "exact", head: true }),
      ]);
      return {
        cantons: c.count ?? 0,
        municipalities: m.count ?? 0,
        documents: d.count ?? 0,
        entries: e.count ?? 0,
      };
    },
    staleTime: 30_000,
  });

  const tiles = [
    { label: "Kantone", value: stats.data?.cantons ?? 0, icon: Layers },
    { label: "Gemeinden", value: stats.data?.municipalities ?? 0, icon: MapPin },
    { label: "Dokumente", value: stats.data?.documents ?? 0, icon: FileText },
    { label: "Wissenseinträge", value: stats.data?.entries ?? 0, icon: BookOpen },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((t) => (
        <Card key={t.label}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-secondary/10 text-secondary">
              <t.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{t.label}</p>
              <p className="font-display text-2xl font-bold leading-tight">
                {stats.isLoading ? "—" : t.value.toLocaleString("de-CH")}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// =====================================================================
// Documents list (flat, all municipalities)
// =====================================================================

function DocumentsList() {
  const qc = useQueryClient();
  const extractFn = useServerFn(extractRegulationDocument);

  const q = useQuery({
    queryKey: ["all-regdocs"],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data: docs, error } = await supabase
        .from("regulation_documents")
        .select(
          "id, doc_type, title, version, file_path, file_name, created_at, municipality_id, municipality:municipalities(id, name, canton:cantons(code, name))",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (docs ?? []).map((d) => d.id);
      const muniIds = Array.from(new Set((docs ?? []).map((d) => d.municipality_id)));

      const [extr, entries] = await Promise.all([
        ids.length
          ? supabase
              .from("regulation_extractions")
              .select("document_id, status, error_message, processed_at, zones")
              .in("document_id", ids)
          : Promise.resolve({ data: [], error: null }),
        muniIds.length
          ? supabase
              .from("knowledge_entries")
              .select("municipality_id")
              .in("municipality_id", muniIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (extr.error) throw extr.error;
      if (entries.error) throw entries.error;

      const extrMap = new Map(
        (extr.data ?? []).map((e) => [e.document_id, e]),
      );
      const countMap = new Map<string, number>();
      (entries.data ?? []).forEach((e) => {
        countMap.set(e.municipality_id, (countMap.get(e.municipality_id) ?? 0) + 1);
      });

      return (docs ?? []).map((d) => ({
        ...d,
        extraction: extrMap.get(d.id) ?? null,
        entry_count: countMap.get(d.municipality_id) ?? 0,
      })) as DocRow[];
    },
  });

  const handleDownload = async (path: string, name: string | null) => {
    const { data, error } = await supabase.storage.from("regulation-documents").createSignedUrl(path, 60);
    if (error) return toast.error(error.message);
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = name ?? "document";
    a.click();
  };

  const handleDelete = async (d: DocRow) => {
    if (!confirm(`"${d.title}" wirklich löschen?`)) return;
    await supabase.storage.from("regulation-documents").remove([d.file_path]);
    const { error } = await supabase.from("regulation_documents").delete().eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success("Gelöscht");
    qc.invalidateQueries({ queryKey: ["all-regdocs"] });
    qc.invalidateQueries({ queryKey: ["kb-stats"] });
  };

  const handleReExtract = async (d: DocRow) => {
    const tid = toast.loading("KI-Analyse läuft…");
    try {
      await extractFn({ data: { documentId: d.id } });
      toast.success("KI-Analyse abgeschlossen", { id: tid });
      qc.invalidateQueries({ queryKey: ["all-regdocs"] });
      qc.invalidateQueries({ queryKey: ["kb-stats"] });
    } catch (e) {
      toast.error((e as Error).message, { id: tid });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" /> Alle Reglemente
        </CardTitle>
        <CardDescription>
          Hochgeladene Dokumente mit Status der KI-Analyse und Anzahl Wissenseinträge.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Lade…</p>
        ) : (q.data?.length ?? 0) === 0 ? (
          <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            Noch keine Reglemente erfasst. Klicke oben auf <strong>Reglement hinzufügen</strong>.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Gemeinde</TableHead>
                <TableHead>Kt.</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Titel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Wissen</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data?.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.municipality?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono">
                      {d.municipality?.canton?.code ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell><Badge variant="outline">{d.doc_type}</Badge></TableCell>
                  <TableCell className="max-w-[280px] truncate">{d.title}</TableCell>
                  <TableCell>
                    <ExtractionStatusBadge
                      status={d.extraction?.status ?? undefined}
                      error={d.extraction?.error_message ?? undefined}
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{d.entry_count}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" title="Erneut analysieren" onClick={() => handleReExtract(d)}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDownload(d.file_path, d.file_name)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(d)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ExtractionStatusBadge({ status, error }: { status?: string; error?: string }) {
  if (!status) return <Badge variant="outline" className="gap-1"><Sparkles className="h-3 w-3" /> Bereit</Badge>;
  if (status === "processing" || status === "pending")
    return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Analyse läuft</Badge>;
  if (status === "completed")
    return <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700"><CheckCircle2 className="h-3 w-3" /> Analysiert</Badge>;
  return <Badge variant="destructive" className="gap-1" title={error}><AlertCircle className="h-3 w-3" /> Fehler</Badge>;
}

// =====================================================================
// Add Regulation Dialog (Canton → Gemeinde → Drag&Drop → Analysis)
// =====================================================================

type Step = "form" | "processing" | "result";

type AnalysisResult = {
  documentId: string;
  municipalityId: string;
  municipalityName: string;
  cantonCode: string;
  zones: number;
  entries: number;
  rules: number;
  status: "completed" | "failed";
  errorMessage: string | null;
};

function AddRegulationDialog({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const extractFn = useServerFn(extractRegulationDocument);

  const cantonsQ = useQuery({
    queryKey: ["cantons"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cantons").select("*").order("code");
      if (error) throw error;
      return data as Canton[];
    },
  });

  const [step, setStep] = useState<Step>("form");
  const [cantonId, setCantonId] = useState<string>("");
  const [muniName, setMuniName] = useState("");
  const [docType, setDocType] = useState<DocType>("BZR");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const munisQ = useQuery({
    queryKey: ["munis-for-canton", cantonId],
    enabled: !!cantonId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("municipalities").select("*").eq("canton_id", cantonId).order("name");
      if (error) throw error;
      return data as Municipality[];
    },
  });

  const reset = () => {
    setStep("form");
    setCantonId(""); setMuniName(""); setDocType("BZR"); setTitle("");
    setFile(null); setResult(null); setDragOver(false);
  };

  const close = () => { onOpenChange(false); setTimeout(reset, 200); };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) { setFile(f); if (!title) setTitle(f.name.replace(/\.[^.]+$/, "")); }
  }, [title]);

  const handleFile = (f: File | null) => {
    setFile(f);
    if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  };

  const canSubmit = !!cantonId && !!muniName.trim() && !!file && !!title.trim();

  const run = async () => {
    if (!canSubmit || !file) return;
    setStep("processing");
    try {
      // 1) Resolve or create municipality
      let muniId: string;
      const existing = munisQ.data?.find(
        (m) => m.name.trim().toLowerCase() === muniName.trim().toLowerCase(),
      );
      if (existing) muniId = existing.id;
      else {
        const { data: newM, error } = await supabase
          .from("municipalities")
          .insert({ canton_id: cantonId, name: muniName.trim() })
          .select("id, name").single();
        if (error) throw error;
        muniId = newM.id;
      }

      // 2) Upload to storage
      const path = `${muniId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("regulation-documents").upload(path, file);
      if (upErr) throw upErr;

      // 3) Insert document row
      const { data: u } = await supabase.auth.getUser();
      const { data: inserted, error: insErr } = await supabase
        .from("regulation_documents").insert({
          municipality_id: muniId,
          doc_type: docType,
          title: title.trim(),
          file_path: path,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: u.user?.id ?? null,
        }).select("id").single();
      if (insErr) throw insErr;

      // 4) Run extraction synchronously and show result
      try {
        await extractFn({ data: { documentId: inserted.id } });
      } catch (e) {
        // Still continue to result page with error
        const canton = cantonsQ.data?.find((c) => c.id === cantonId);
        setResult({
          documentId: inserted.id, municipalityId: muniId,
          municipalityName: muniName.trim(),
          cantonCode: canton?.code ?? "",
          zones: 0, entries: 0, rules: 0,
          status: "failed", errorMessage: (e as Error).message,
        });
        setStep("result");
        qc.invalidateQueries({ queryKey: ["all-regdocs"] });
        qc.invalidateQueries({ queryKey: ["kb-stats"] });
        return;
      }

      // 5) Load extraction summary + counts
      const [{ data: extr }, { count: entryCount }, { count: ruleCount }] = await Promise.all([
        supabase.from("regulation_extractions")
          .select("status, error_message, zones, residential_zones, commercial_zones, mixed_zones")
          .eq("document_id", inserted.id).maybeSingle(),
        supabase.from("knowledge_entries")
          .select("id", { count: "exact", head: true })
          .eq("source_document", inserted.id),
        supabase.from("regulation_rules")
          .select("id", { count: "exact", head: true })
          .eq("source_document", inserted.id),
      ]);
      const zoneCount =
        ((extr?.zones as unknown[] | null)?.length ?? 0) +
        ((extr?.residential_zones as unknown[] | null)?.length ?? 0) +
        ((extr?.commercial_zones as unknown[] | null)?.length ?? 0) +
        ((extr?.mixed_zones as unknown[] | null)?.length ?? 0);

      const canton = cantonsQ.data?.find((c) => c.id === cantonId);
      setResult({
        documentId: inserted.id,
        municipalityId: muniId,
        municipalityName: muniName.trim(),
        cantonCode: canton?.code ?? "",
        zones: zoneCount,
        entries: entryCount ?? 0,
        rules: ruleCount ?? 0,
        status: extr?.status === "completed" ? "completed" : "failed",
        errorMessage: extr?.error_message ?? null,
      });
      setStep("result");
      qc.invalidateQueries({ queryKey: ["all-regdocs"] });
      qc.invalidateQueries({ queryKey: ["kb-stats"] });
    } catch (e) {
      toast.error((e as Error).message);
      setStep("form");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); else onOpenChange(true); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reglement hinzufügen</DialogTitle>
          <DialogDescription>
            Kanton und Gemeinde wählen, Datei hochladen — die KI analysiert das Dokument sofort und
            erfasst die Wissenseinträge.
          </DialogDescription>
        </DialogHeader>

        {step === "form" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kanton</Label>
                <Select value={cantonId} onValueChange={setCantonId}>
                  <SelectTrigger><SelectValue placeholder="Kanton wählen…" /></SelectTrigger>
                  <SelectContent>
                    {cantonsQ.data?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="font-mono mr-2">{c.code}</span>{c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Gemeinde</Label>
                <Input
                  list="muni-list"
                  value={muniName}
                  onChange={(e) => setMuniName(e.target.value)}
                  placeholder={cantonId ? "z. B. Luzern" : "Zuerst Kanton wählen"}
                  disabled={!cantonId}
                />
                <datalist id="muni-list">
                  {munisQ.data?.map((m) => <option key={m.id} value={m.name} />)}
                </datalist>
                <p className="mt-1 text-xs text-muted-foreground">
                  Neue Gemeinde wird automatisch angelegt.
                </p>
              </div>
              <div>
                <Label>Dokumenttyp</Label>
                <Select value={docType} onValueChange={(v) => setDocType(v as DocType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Titel</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="BZR 2024" />
              </div>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="flex items-center gap-3">
                  <FileText className="h-6 w-6 text-primary" />
                  <div className="text-left">
                    <p className="font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <CloudUpload className="h-10 w-10 text-muted-foreground" />
                  <p className="font-medium">Datei hier ablegen oder klicken zum Auswählen</p>
                  <p className="text-xs text-muted-foreground">PDF, DOC, DOCX, PNG, JPG</p>
                </>
              )}
            </div>
          </div>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium">KI analysiert das Reglement…</p>
              <p className="text-sm text-muted-foreground">
                Zonen, Vorschriften und Wissenseinträge werden extrahiert.
              </p>
            </div>
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-4">
            <div className={`flex items-center gap-3 rounded-md border p-4 ${
              result.status === "completed"
                ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                : "border-destructive/30 bg-destructive/5"
            }`}>
              {result.status === "completed"
                ? <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                : <AlertCircle className="h-6 w-6 text-destructive" />}
              <div>
                <p className="font-medium">
                  {result.status === "completed" ? "Reglement erfasst" : "Analyse fehlgeschlagen"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {result.municipalityName} ({result.cantonCode})
                  {result.errorMessage ? ` — ${result.errorMessage}` : ""}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <ResultTile label="Zonen" value={result.zones} />
              <ResultTile label="Regeln" value={result.rules} />
              <ResultTile label="Wissenseinträge" value={result.entries} />
            </div>

            {result.status === "completed" && result.entries === 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                Die KI hat keine Wissenseinträge gefunden. Möglicherweise ist das PDF gescannt
                (kein Text-Layer) oder enthält keine extrahierbaren Zonenwerte.
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "form" && (
            <>
              <Button variant="ghost" onClick={close}>Abbrechen</Button>
              <Button onClick={run} disabled={!canSubmit}>
                <Upload className="h-4 w-4" /> Hochladen & Analysieren
              </Button>
            </>
          )}
          {step === "processing" && (
            <Button disabled><Loader2 className="h-4 w-4 animate-spin" /> Analysiere…</Button>
          )}
          {step === "result" && (
            <>
              <Button variant="outline" onClick={reset}>Weiteres Reglement</Button>
              <Button onClick={close}>Fertig</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResultTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-card p-4 text-center">
      <p className="font-display text-3xl font-bold leading-tight">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
