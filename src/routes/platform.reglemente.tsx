import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { toast } from "sonner";
import {
  Building2, MapPin, FileText, Upload, Trash2, Download, Plus, ShieldAlert,
  Sparkles, Loader2, CheckCircle2, AlertCircle, RefreshCw, BookOpen, Layers,
  CloudUpload, X, Check, ChevronsUpDown, ShieldCheck,
} from "lucide-react";
import { extractRegulationDocument } from "@/lib/regulation-extract.functions";
import { listRegulationsMissingKnowledge } from "@/lib/regulation-bulk.functions";
import { MunicipalityDetailDialog } from "@/components/regulation/municipality-detail-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const Route = createFileRoute("/platform/reglemente")({
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
          <BulkExtractButton />
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
// Bulk: KI-Analyse für alle Reglemente ohne Wissenseinträge
// =====================================================================

function BulkExtractButton() {
  const qc = useQueryClient();
  const listFn = useServerFn(listRegulationsMissingKnowledge);
  const extractFn = useServerFn(extractRegulationDocument);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; current: string } | null>(
    null,
  );

  const run = async () => {
    if (running) return;
    setRunning(true);
    try {
      const docs = await listFn();
      if (docs.length === 0) {
        toast.success("Alle Reglemente haben bereits Wissenseinträge.");
        setRunning(false);
        return;
      }
      setProgress({ done: 0, total: docs.length, current: docs[0].municipalityName });
      let ok = 0;
      let fail = 0;
      for (let i = 0; i < docs.length; i++) {
        const d = docs[i];
        setProgress({ done: i, total: docs.length, current: d.municipalityName });
        try {
          await extractFn({ data: { documentId: d.id } });
          ok++;
        } catch (e) {
          fail++;
          console.error("Extract failed for", d.municipalityName, e);
        }
      }
      setProgress(null);
      toast[fail === 0 ? "success" : "warning"](
        `KI-Analyse abgeschlossen: ${ok} erfolgreich, ${fail} fehlgeschlagen.`,
      );
      qc.invalidateQueries({ queryKey: ["all-regdocs"] });
      qc.invalidateQueries({ queryKey: ["kb-stats"] });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="lg"
      onClick={run}
      disabled={running}
      className="gap-2"
      title="Führt die KI-Analyse für alle Reglemente ohne Wissenseinträge aus"
    >
      {running ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {progress
            ? `${progress.done}/${progress.total} — ${progress.current}`
            : "Wird vorbereitet…"}
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4" /> KI-Analyse: ausstehende
        </>
      )}
    </Button>
  );
}

// =====================================================================
// Dashboard
// =====================================================================


function KnowledgeBaseDashboard() {
  const stats = useQuery({
    queryKey: ["kb-stats"],
    queryFn: async () => {
      const [c, m, d, e, ev, r, rv] = await Promise.all([
        supabase.from("cantons").select("id", { count: "exact", head: true }),
        supabase.from("municipalities").select("id", { count: "exact", head: true }),
        supabase.from("regulation_documents").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("knowledge_entries").select("id", { count: "exact", head: true }),
        supabase.from("knowledge_entries").select("id", { count: "exact", head: true }).eq("verified", true),
        supabase.from("regulation_rules").select("id", { count: "exact", head: true }),
        supabase.from("regulation_rules").select("id", { count: "exact", head: true }).eq("verified", true),
      ]);
      const totalItems = (e.count ?? 0) + (r.count ?? 0);
      const verifiedItems = (ev.count ?? 0) + (rv.count ?? 0);
      return {
        cantons: c.count ?? 0,
        municipalities: m.count ?? 0,
        documents: d.count ?? 0,
        entries: e.count ?? 0,
        verified: verifiedItems,
        totalItems,
      };
    },
    staleTime: 30_000,
  });

  const verifiedTile = stats.data
    ? `${stats.data.verified.toLocaleString("de-CH")} / ${stats.data.totalItems.toLocaleString("de-CH")}`
    : "—";

  const tiles = [
    { label: "Kantone", value: stats.data?.cantons ?? 0, icon: Layers, display: undefined as string | undefined },
    { label: "Gemeinden", value: stats.data?.municipalities ?? 0, icon: MapPin, display: undefined },
    { label: "Dokumente", value: stats.data?.documents ?? 0, icon: FileText, display: undefined },
    { label: "Wissenseinträge", value: stats.data?.entries ?? 0, icon: BookOpen, display: undefined },
    { label: "Geprüfte Einträge", value: stats.data?.verified ?? 0, icon: ShieldCheck, display: verifiedTile },
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
// Municipalities list (grouped) — click to open detail modal with versions
// =====================================================================

type MuniGroup = {
  id: string;
  name: string;
  cantonCode: string;
  cantonName: string;
  doc_count: number;
  entry_count: number;
  latest: string | null;
  has_failed: boolean;
  has_processing: boolean;
};

function DocumentsList() {
  const [openMuni, setOpenMuni] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cantonFilter, setCantonFilter] = useState<string>("all");
  const [onlyWith, setOnlyWith] = useState<"all" | "with" | "without">("all");

  const q = useQuery({
    queryKey: ["all-regdocs"],
    refetchInterval: 5000,
    queryFn: async () => {
      const [munisRes, docsRes] = await Promise.all([
        supabase
          .from("municipalities")
          .select("id, name, canton:cantons(code, name)")
          .order("name"),
        supabase
          .from("regulation_documents")
          .select(
            "id, doc_type, title, version, file_path, file_name, created_at, municipality_id",
          )
          .order("created_at", { ascending: false }),
      ]);
      if (munisRes.error) throw munisRes.error;
      if (docsRes.error) throw docsRes.error;
      const docs = docsRes.data ?? [];
      const munis = munisRes.data ?? [];
      const ids = docs.map((d) => d.id);
      // Only fetch entries for municipalities that actually have documents.
      // Sending an IN-list with all 2000+ municipality UUIDs blows past the
      // URL length limit and silently truncates, producing 0 counts.
      const muniIdsWithDocs = Array.from(new Set(docs.map((d) => d.municipality_id)));

      const [extr, entries] = await Promise.all([
        ids.length
          ? supabase
              .from("regulation_extractions")
              .select("document_id, status")
              .in("document_id", ids)
          : Promise.resolve({ data: [], error: null }),
        muniIdsWithDocs.length
          ? supabase
              .from("knowledge_entries")
              .select("municipality_id")
              .in("municipality_id", muniIdsWithDocs)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (extr.error) throw extr.error;
      if (entries.error) throw entries.error;


      const extrMap = new Map((extr.data ?? []).map((e) => [e.document_id, e.status as string]));
      const entryCount = new Map<string, number>();
      (entries.data ?? []).forEach((e) => {
        entryCount.set(e.municipality_id, (entryCount.get(e.municipality_id) ?? 0) + 1);
      });

      const groups = new Map<string, MuniGroup>();
      for (const m of munis) {
        const canton = m.canton as { code: string; name: string } | null;
        groups.set(m.id, {
          id: m.id,
          name: m.name,
          cantonCode: canton?.code ?? "—",
          cantonName: canton?.name ?? "",
          doc_count: 0,
          entry_count: entryCount.get(m.id) ?? 0,
          latest: null,
          has_failed: false,
          has_processing: false,
        });
      }
      for (const d of docs) {
        const g = groups.get(d.municipality_id);
        if (!g) continue;
        g.doc_count += 1;
        if (!g.latest || d.created_at > g.latest) g.latest = d.created_at;
        const st = extrMap.get(d.id);
        if (st === "failed") g.has_failed = true;
        if (st === "processing" || st === "pending") g.has_processing = true;
      }
      return Array.from(groups.values());
    },
  });

  const cantons = useMemo(() => {
    const s = new Map<string, string>();
    (q.data ?? []).forEach((g) => {
      if (g.cantonCode && g.cantonCode !== "—") s.set(g.cantonCode, g.cantonName);
    });
    return Array.from(s.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [q.data]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (q.data ?? [])
      .filter((g) => {
        if (cantonFilter !== "all" && g.cantonCode !== cantonFilter) return false;
        if (onlyWith === "with" && g.doc_count === 0) return false;
        if (onlyWith === "without" && g.doc_count > 0) return false;
        if (!needle) return true;
        return (
          g.name.toLowerCase().includes(needle) ||
          g.cantonCode.toLowerCase().includes(needle) ||
          g.cantonName.toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => {
        if ((b.doc_count > 0 ? 1 : 0) !== (a.doc_count > 0 ? 1 : 0))
          return (b.doc_count > 0 ? 1 : 0) - (a.doc_count > 0 ? 1 : 0);
        if (a.doc_count > 0 && b.doc_count > 0)
          return (b.latest ?? "").localeCompare(a.latest ?? "");
        return a.name.localeCompare(b.name);
      });
  }, [q.data, search, cantonFilter, onlyWith]);

  const total = q.data?.length ?? 0;
  const withDocs = (q.data ?? []).filter((g) => g.doc_count > 0).length;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" /> Gemeinden ({withDocs} / {total} mit Reglement)
          </CardTitle>
          <CardDescription>
            Klicke auf eine Gemeinde, um Versionen anzusehen oder ein Reglement hochzuladen.
          </CardDescription>
          <div className="grid gap-2 pt-3 sm:grid-cols-[1fr_180px_200px]">
            <Input
              placeholder="Gemeinde / Kanton suchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select value={cantonFilter} onValueChange={setCantonFilter}>
              <SelectTrigger><SelectValue placeholder="Kanton" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Kantone</SelectItem>
                {cantons.map(([code, name]) => (
                  <SelectItem key={code} value={code}>{code} — {name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={onlyWith} onValueChange={(v) => setOnlyWith(v as "all" | "with" | "without")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle anzeigen</SelectItem>
                <SelectItem value="with">Nur mit Reglement</SelectItem>
                <SelectItem value="without">Nur ohne Reglement</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">Lade…</p>
          ) : filtered.length === 0 ? (
            <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
              Keine Treffer.
            </div>
          ) : (
            <div className="max-h-[65vh] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>Gemeinde</TableHead>
                    <TableHead>Kt.</TableHead>
                    <TableHead className="text-right">Versionen</TableHead>
                    <TableHead className="text-right">Wissen</TableHead>
                    <TableHead>Letzte Erfassung</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((g) => {
                    const empty = g.doc_count === 0;
                    return (
                      <TableRow
                        key={g.id}
                        className={`cursor-pointer hover:bg-muted/40 ${empty ? "text-muted-foreground" : ""}`}
                        onClick={() => setOpenMuni(g.id)}
                      >
                        <TableCell className="font-medium">{g.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-mono">{g.cantonCode}</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{g.doc_count}</TableCell>
                        <TableCell className="text-right tabular-nums">{g.entry_count}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {g.latest ? new Date(g.latest).toLocaleDateString("de-CH") : "—"}
                        </TableCell>
                        <TableCell>
                          {empty ? (
                            <Badge variant="outline" className="gap-1 text-muted-foreground">
                              <Upload className="h-3 w-3" /> Noch nicht hochgeladen
                            </Badge>
                          ) : g.has_processing ? (
                            <Badge variant="secondary" className="gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" /> Analyse
                            </Badge>
                          ) : g.has_failed ? (
                            <Badge variant="destructive" className="gap-1">
                              <AlertCircle className="h-3 w-3" /> Teilfehler
                            </Badge>
                          ) : (
                            <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700">
                              <CheckCircle2 className="h-3 w-3" /> OK
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <MunicipalityDetailDialog
        municipalityId={openMuni}
        onClose={() => setOpenMuni(null)}
      />
    </>
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
  status: "processing" | "completed" | "failed";
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
  const [version, setVersion] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [notes, setNotes] = useState("");
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
    setVersion(""); setValidFrom(""); setNotes("");
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
          version: version.trim() || null,
          valid_from: validFrom || null,
          notes: notes.trim() || null,
          file_path: path,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: u.user?.id ?? null,
        }).select("id").single();
      if (insErr) throw insErr;

      // 4) Immediately show result page in "processing" state — extraction
      //    runs in background and is observed via polling (see useEffect).
      const canton = cantonsQ.data?.find((c) => c.id === cantonId);
      setResult({
        documentId: inserted.id,
        municipalityId: muniId,
        municipalityName: muniName.trim(),
        cantonCode: canton?.code ?? "",
        zones: 0, entries: 0, rules: 0,
        status: "processing",
        errorMessage: null,
      });
      setStep("result");
      qc.invalidateQueries({ queryKey: ["all-regdocs"] });
      qc.invalidateQueries({ queryKey: ["kb-stats"] });

      // 5) Fire extraction without awaiting — the dialog stays open and the
      //    polling effect below picks up the final status.
      extractFn({ data: { documentId: inserted.id } }).catch((e) => {
        console.error("[extract] background run failed", e);
        setResult((prev) =>
          prev && prev.documentId === inserted.id
            ? { ...prev, status: "failed", errorMessage: (e as Error).message }
            : prev,
        );
      });
    } catch (e) {
      toast.error((e as Error).message);
      setStep("form");
    }
  };

  // Poll extraction status while the result is "processing".
  useEffect(() => {
    if (step !== "result" || !result || result.status !== "processing") return;
    const docId = result.documentId;
    let cancelled = false;

    const tick = async () => {
      const [{ data: extr }, { count: entryCount }, { count: ruleCount }] = await Promise.all([
        supabase.from("regulation_extractions")
          .select("status, error_message, zones, residential_zones, commercial_zones, mixed_zones")
          .eq("document_id", docId).maybeSingle(),
        supabase.from("knowledge_entries")
          .select("id", { count: "exact", head: true })
          .eq("source_document", docId),
        supabase.from("regulation_rules")
          .select("id", { count: "exact", head: true })
          .eq("source_document", docId),
      ]);
      if (cancelled) return;
      const zoneCount =
        ((extr?.zones as unknown[] | null)?.length ?? 0) +
        ((extr?.residential_zones as unknown[] | null)?.length ?? 0) +
        ((extr?.commercial_zones as unknown[] | null)?.length ?? 0) +
        ((extr?.mixed_zones as unknown[] | null)?.length ?? 0);
      const status = extr?.status;
      setResult((prev) =>
        prev && prev.documentId === docId
          ? {
              ...prev,
              zones: zoneCount,
              entries: entryCount ?? 0,
              rules: ruleCount ?? 0,
              status:
                status === "completed" ? "completed"
                : status === "failed" ? "failed"
                : "processing",
              errorMessage: extr?.error_message ?? prev.errorMessage,
            }
          : prev,
      );
      if (status === "completed" || status === "failed") {
        qc.invalidateQueries({ queryKey: ["all-regdocs"] });
        qc.invalidateQueries({ queryKey: ["kb-stats"] });
      }
    };

    tick();
    const interval = setInterval(tick, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [step, result, qc]);


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
                <MunicipalityCombobox
                  municipalities={munisQ.data ?? []}
                  value={muniName}
                  onChange={setMuniName}
                  disabled={!cantonId}
                />
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
              <div>
                <Label>Version / Erlass</Label>
                <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="z. B. 2024-1" />
              </div>
              <div>
                <Label>Gültig ab</Label>
                <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label>Notizen (optional)</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="z. B. Beschluss Stadtrat vom …" />
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
                accept=".pdf,.doc,.docx,.md,.markdown,.txt,.png,.jpg,.jpeg"
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
                : result.status === "failed"
                ? "border-destructive/30 bg-destructive/5"
                : "border-primary/30 bg-primary/5"
            }`}>
              {result.status === "completed" ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              ) : result.status === "failed" ? (
                <AlertCircle className="h-6 w-6 text-destructive" />
              ) : (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              )}
              <div>
                <p className="font-medium">
                  {result.status === "completed"
                    ? "Reglement erfasst"
                    : result.status === "failed"
                    ? "Analyse fehlgeschlagen"
                    : "KI analysiert im Hintergrund…"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {result.municipalityName} ({result.cantonCode})
                  {result.status === "processing"
                    ? " — du kannst dieses Fenster schliessen, die Analyse läuft weiter."
                    : result.errorMessage ? ` — ${result.errorMessage}` : ""}
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

function MunicipalityCombobox({
  municipalities, value, onChange, disabled,
}: {
  municipalities: Municipality[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const exactMatch = municipalities.some(
    (m) => m.name.trim().toLowerCase() === query.trim().toLowerCase(),
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={value ? "" : "text-muted-foreground"}>
            {value || (disabled ? "Zuerst Kanton wählen" : "Gemeinde wählen…")}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter>
          <CommandInput
            placeholder="Suchen oder neue Gemeinde eingeben…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {query.trim() ? (
                <button
                  type="button"
                  onClick={() => { onChange(query.trim()); setOpen(false); }}
                  className="mx-1 my-1 flex w-[calc(100%-0.5rem)] items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <Plus className="h-4 w-4" />
                  „{query.trim()}" als neue Gemeinde anlegen
                </button>
              ) : (
                <span className="block px-2 py-3 text-center text-sm text-muted-foreground">
                  Keine Gemeinde.
                </span>
              )}
            </CommandEmpty>
            <CommandGroup>
              {municipalities.map((m) => (
                <CommandItem
                  key={m.id}
                  value={m.name}
                  onSelect={() => { onChange(m.name); setQuery(""); setOpen(false); }}
                >
                  <Check className={`mr-2 h-4 w-4 ${value === m.name ? "opacity-100" : "opacity-0"}`} />
                  {m.name}
                </CommandItem>
              ))}
              {query.trim() && !exactMatch && (
                <CommandItem
                  value={`__create__${query}`}
                  onSelect={() => { onChange(query.trim()); setOpen(false); }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  „{query.trim()}" anlegen
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
