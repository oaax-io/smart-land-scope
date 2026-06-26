import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { extractRegulationDocument } from "@/lib/regulation-extract.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  FileText, Download, RefreshCw, Trash2, CloudUpload, X, Loader2,
  CheckCircle2, AlertCircle, Sparkles, Plus, MapPin, BookOpen,
  ShieldCheck, ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

const DOC_TYPES = [
  "BZR", "BZO", "Zonenplan", "Gestaltungsplan", "Sondervorschriften", "Sonstige",
] as const;
type DocType = (typeof DOC_TYPES)[number];

type DocRow = {
  id: string;
  doc_type: DocType;
  title: string;
  version: string | null;
  valid_from: string | null;
  notes: string | null;
  file_path: string;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
  active: boolean;
  extraction: {
    status: string | null;
    error_message: string | null;
    processed_at: string | null;
    zones: unknown;
  } | null;
  entry_count: number;
};

type EntryRowData = {
  id: string;
  category: string;
  key: string;
  value: string | null;
  verified: boolean;
  verified_at: string | null;
};

type RuleRowData = {
  id: string;
  zone: string | null;
  rule_type: string;
  title: string;
  description: string | null;
  verified: boolean;
  verified_at: string | null;
};

type Props = {
  municipalityId: string | null;
  onClose: () => void;
};

export function MunicipalityDetailDialog({ municipalityId, onClose }: Props) {
  const qc = useQueryClient();
  const extractFn = useServerFn(extractRegulationDocument);
  const { user } = useAuth();
  const [showUpload, setShowUpload] = useState(false);

  const muniQ = useQuery({
    queryKey: ["muni-detail", municipalityId],
    enabled: !!municipalityId,
    queryFn: async () => {
      const { data: m, error } = await supabase
        .from("municipalities")
        .select("id, name, canton:cantons(code, name)")
        .eq("id", municipalityId!)
        .single();
      if (error) throw error;
      return m;
    },
  });

  const docsQ = useQuery({
    queryKey: ["muni-docs", municipalityId],
    enabled: !!municipalityId,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data: docs, error } = await supabase
        .from("regulation_documents")
        .select(
          "id, doc_type, title, version, valid_from, notes, file_path, file_name, file_size, created_at, active",
        )
        .eq("municipality_id", municipalityId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (docs ?? []).map((d) => d.id);
      const [extr, ent] = await Promise.all([
        ids.length
          ? supabase
              .from("regulation_extractions")
              .select("document_id, status, error_message, processed_at, zones")
              .in("document_id", ids)
          : Promise.resolve({ data: [], error: null }),
        ids.length
          ? supabase
              .from("knowledge_entries")
              .select("source_document")
              .in("source_document", ids)
          : Promise.resolve({ data: [], error: null }),
      ]);
      const extrMap = new Map((extr.data ?? []).map((e) => [e.document_id, e]));
      const countMap = new Map<string, number>();
      (ent.data ?? []).forEach((e) => {
        if (!e.source_document) return;
        countMap.set(e.source_document, (countMap.get(e.source_document) ?? 0) + 1);
      });
      return (docs ?? []).map((d) => ({
        ...d,
        extraction: extrMap.get(d.id) ?? null,
        entry_count: countMap.get(d.id) ?? 0,
      })) as DocRow[];
    },
  });

  const entriesQ = useQuery({
    queryKey: ["muni-entries", municipalityId],
    enabled: !!municipalityId,
    queryFn: async () => {
      const [{ data: entries, error: e1 }, { data: rules, error: e2 }] = await Promise.all([
        supabase
          .from("knowledge_entries")
          .select("id, category, key, value, source_article, source_document, verified, verified_at")
          .eq("municipality_id", municipalityId!)
          .order("category"),
        supabase
          .from("regulation_rules")
          .select("id, zone, rule_type, title, description, article_reference, source_document, verified, verified_at")
          .eq("municipality_id", municipalityId!)
          .order("zone"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return {
        entries: (entries ?? []) as EntryRowData[],
        rules: (rules ?? []) as RuleRowData[],
      };
    },
  });

  const handleDownload = async (path: string, name: string | null) => {
    const { data, error } = await supabase.storage
      .from("regulation-documents")
      .createSignedUrl(path, 60);
    if (error) return toast.error(error.message);
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = name ?? "document";
    a.click();
  };

  const handleDelete = async (d: DocRow) => {
    if (!confirm(`Version "${d.title}" wirklich löschen?`)) return;
    await supabase.storage.from("regulation-documents").remove([d.file_path]);
    const { error } = await supabase.from("regulation_documents").delete().eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success("Gelöscht");
    qc.invalidateQueries({ queryKey: ["muni-docs", municipalityId] });
    qc.invalidateQueries({ queryKey: ["muni-entries", municipalityId] });
    qc.invalidateQueries({ queryKey: ["all-regdocs"] });
    qc.invalidateQueries({ queryKey: ["kb-stats"] });
  };

  const handleReExtract = async (d: DocRow) => {
    const tid = toast.loading("KI-Analyse läuft…");
    try {
      await extractFn({ data: { documentId: d.id } });
      toast.success("KI-Analyse abgeschlossen", { id: tid });
      qc.invalidateQueries({ queryKey: ["muni-docs", municipalityId] });
      qc.invalidateQueries({ queryKey: ["muni-entries", municipalityId] });
      qc.invalidateQueries({ queryKey: ["all-regdocs"] });
      qc.invalidateQueries({ queryKey: ["kb-stats"] });
    } catch (e) {
      toast.error((e as Error).message, { id: tid });
    }
  };

  const invalidateEntries = () => {
    qc.invalidateQueries({ queryKey: ["muni-entries", municipalityId] });
    qc.invalidateQueries({ queryKey: ["kb-stats"] });
  };

  async function updateEntry(id: string, value: string) {
    const { error } = await supabase.from("knowledge_entries").update({ value }).eq("id", id);
    if (error) { toast.error("Speichern fehlgeschlagen", { description: error.message }); return; }
    toast.success("Gespeichert");
    invalidateEntries();
  }

  async function toggleEntryVerified(id: string, verified: boolean) {
    const { error } = await supabase
      .from("knowledge_entries")
      .update({
        verified,
        verified_by: verified ? user?.id ?? null : null,
        verified_at: verified ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (error) { toast.error("Aktualisierung fehlgeschlagen", { description: error.message }); return; }
    invalidateEntries();
  }

  async function updateRule(id: string, fields: { title?: string; description?: string }) {
    const { error } = await supabase.from("regulation_rules").update(fields).eq("id", id);
    if (error) { toast.error("Speichern fehlgeschlagen", { description: error.message }); return; }
    toast.success("Gespeichert");
    invalidateEntries();
  }

  async function toggleRuleVerified(id: string, verified: boolean) {
    const { error } = await supabase
      .from("regulation_rules")
      .update({
        verified,
        verified_by: verified ? user?.id ?? null : null,
        verified_at: verified ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (error) { toast.error("Aktualisierung fehlgeschlagen", { description: error.message }); return; }
    invalidateEntries();
  }

  const open = !!municipalityId;
  const m = muniQ.data;

  const allItems = entriesQ.data
    ? [...entriesQ.data.entries, ...entriesQ.data.rules]
    : [];
  const verifiedCount = allItems.filter((e) => e.verified).length;
  const totalCount = allItems.length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setShowUpload(false); } }}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" /> {m?.name ?? "…"}
                {m?.canton && (
                  <Badge variant="secondary" className="font-mono">{m.canton.code}</Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                Alle Reglemente und Versionen dieser Gemeinde. Neue Versionen werden zusätzlich
                erfasst — alte bleiben als Historie erhalten.
              </DialogDescription>
            </div>
            <Button onClick={() => setShowUpload((v) => !v)} className="gap-2 shrink-0">
              {showUpload ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showUpload ? "Schliessen" : "Neue Version"}
            </Button>
          </div>
        </DialogHeader>

        {showUpload && municipalityId && (
          <NewVersionForm
            municipalityId={municipalityId}
            onDone={() => {
              setShowUpload(false);
              qc.invalidateQueries({ queryKey: ["muni-docs", municipalityId] });
              qc.invalidateQueries({ queryKey: ["muni-entries", municipalityId] });
              qc.invalidateQueries({ queryKey: ["all-regdocs"] });
              qc.invalidateQueries({ queryKey: ["kb-stats"] });
            }}
          />
        )}

        <Tabs defaultValue="documents" className="w-full">
          <TabsList>
            <TabsTrigger value="documents">Dokumente</TabsTrigger>
            <TabsTrigger value="verified" className="gap-2">
              Geprüfte Daten
              {entriesQ.data && totalCount > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] tabular-nums">
                  {verifiedCount}/{totalCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Versionen ({docsQ.data?.length ?? 0})
            </h3>
            {docsQ.isLoading ? (
              <p className="text-sm text-muted-foreground">Lade…</p>
            ) : (docsQ.data?.length ?? 0) === 0 ? (
              <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                Noch keine Dokumente erfasst.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Typ</TableHead>
                    <TableHead>Titel</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Gültig ab</TableHead>
                    <TableHead>Erfasst</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Wissen</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docsQ.data?.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell><Badge variant="outline">{d.doc_type}</Badge></TableCell>
                      <TableCell className="max-w-[220px]">
                        <div className="truncate font-medium">{d.title}</div>
                        {d.notes && (
                          <div className="truncate text-xs text-muted-foreground">{d.notes}</div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{d.version ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        {d.valid_from ? new Date(d.valid_from).toLocaleDateString("de-CH") : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(d.created_at).toLocaleDateString("de-CH")}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={d.extraction?.status ?? undefined}
                          error={d.extraction?.error_message ?? undefined}
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className="inline-flex items-center gap-1 text-sm">
                          <BookOpen className="h-3 w-3 text-muted-foreground" />
                          {d.entry_count}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" title="Erneut analysieren" onClick={() => handleReExtract(d)}>
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" title="Herunterladen" onClick={() => handleDownload(d.file_path, d.file_name)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" title="Löschen" onClick={() => handleDelete(d)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="verified" className="space-y-4">
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100">
              Diese Werte wurden automatisch aus den hochgeladenen Reglementen extrahiert. Bitte vor
              produktivem Einsatz stichprobenartig gegen das Original-PDF prüfen und mit dem Schalter
              als „geprüft" markieren. Werte können direkt korrigiert werden.
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">
                Wissens-Einträge ({entriesQ.data?.entries.length ?? 0})
              </h3>
              {(entriesQ.data?.entries.length ?? 0) === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                  Noch keine Wissens-Einträge — zuerst KI-Analyse für ein Dokument anstossen.
                </p>
              ) : (
                <div className="divide-y rounded-md border">
                  {entriesQ.data!.entries.map((e) => (
                    <EntryRow
                      key={e.id}
                      entry={e}
                      onSave={(v) => updateEntry(e.id, v)}
                      onToggle={(v) => toggleEntryVerified(e.id, v)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">
                Regeln ({entriesQ.data?.rules.length ?? 0})
              </h3>
              {(entriesQ.data?.rules.length ?? 0) === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                  Noch keine Regeln erfasst.
                </p>
              ) : (
                <div className="divide-y rounded-md border">
                  {entriesQ.data!.rules.map((r) => (
                    <RuleRow
                      key={r.id}
                      rule={r}
                      onSave={(fields) => updateRule(r.id, fields)}
                      onToggle={(v) => toggleRuleVerified(r.id, v)}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status, error }: { status?: string; error?: string }) {
  if (!status) return <Badge variant="outline" className="gap-1"><Sparkles className="h-3 w-3" /> Bereit</Badge>;
  if (status === "processing" || status === "pending")
    return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Analyse</Badge>;
  if (status === "completed")
    return <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700"><CheckCircle2 className="h-3 w-3" /> OK</Badge>;
  return <Badge variant="destructive" className="gap-1" title={error}><AlertCircle className="h-3 w-3" /> Fehler</Badge>;
}

function EntryRow({
  entry, onSave, onToggle,
}: {
  entry: EntryRowData;
  onSave: (value: string) => void;
  onToggle: (verified: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.value ?? "");

  return (
    <div className="flex items-start justify-between gap-3 p-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {entry.category} · {entry.key}
        </p>
        {editing ? (
          <div className="mt-1 flex items-center gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-8 text-sm"
              autoFocus
            />
            <Button size="sm" className="h-8" onClick={() => { onSave(draft); setEditing(false); }}>
              Speichern
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={() => { setDraft(entry.value ?? ""); setEditing(false); }}
            >
              Abbrechen
            </Button>
          </div>
        ) : (
          <button
            type="button"
            className="mt-0.5 block w-full text-left text-sm hover:underline"
            onClick={() => setEditing(true)}
          >
            {entry.value || <span className="italic text-muted-foreground">leer — klicken zum Bearbeiten</span>}
          </button>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-0.5">
        {entry.verified ? (
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
        ) : (
          <ShieldAlert className="h-4 w-4 text-amber-500" />
        )}
        <Switch checked={entry.verified} onCheckedChange={onToggle} aria-label="Als geprüft markieren" />
      </div>
    </div>
  );
}

function RuleRow({
  rule, onSave, onToggle,
}: {
  rule: RuleRowData;
  onSave: (fields: { title?: string; description?: string }) => void;
  onToggle: (verified: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(rule.title);
  const [description, setDescription] = useState(rule.description ?? "");

  return (
    <div className="flex items-start justify-between gap-3 p-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {rule.rule_type}{rule.zone ? ` · ${rule.zone}` : ""}
        </p>
        {editing ? (
          <div className="mt-1 space-y-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-8 text-sm"
              autoFocus
            />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-sm"
              rows={2}
            />
            <div className="flex gap-2">
              <Button size="sm" className="h-8" onClick={() => { onSave({ title, description }); setEditing(false); }}>
                Speichern
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8"
                onClick={() => { setTitle(rule.title); setDescription(rule.description ?? ""); setEditing(false); }}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="mt-0.5 block w-full text-left hover:underline"
            onClick={() => setEditing(true)}
          >
            <p className="text-sm font-medium">{rule.title}</p>
            {rule.description && (
              <p className="text-xs text-muted-foreground">{rule.description}</p>
            )}
          </button>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-0.5">
        {rule.verified ? (
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
        ) : (
          <ShieldAlert className="h-4 w-4 text-amber-500" />
        )}
        <Switch checked={rule.verified} onCheckedChange={onToggle} aria-label="Als geprüft markieren" />
      </div>
    </div>
  );
}

function NewVersionForm({
  municipalityId, onDone,
}: { municipalityId: string; onDone: () => void }) {
  const extractFn = useServerFn(extractRegulationDocument);
  const inputRef = useRef<HTMLInputElement>(null);

  const [docType, setDocType] = useState<DocType>("BZR");
  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleFile = (f: File | null) => {
    setFile(f);
    if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    if (!file || !title.trim()) {
      toast.error("Titel und Datei sind Pflicht.");
      return;
    }
    if (!validFrom) {
      toast.error("Bitte 'Gültig ab'-Datum angeben — neue Version wird zur aktuellen.");
      return;
    }
    setBusy(true);
    const tid = toast.loading("Lade hoch und analysiere…");
    try {
      const path = `${municipalityId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("regulation-documents").upload(path, file);
      if (upErr) throw upErr;

      const { data: u } = await supabase.auth.getUser();
      const { data: inserted, error: insErr } = await supabase
        .from("regulation_documents")
        .insert({
          municipality_id: municipalityId,
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
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      // Ältere Versionen für diese Gemeinde archivieren (active = false),
      // damit die KI-Analyse nur das neueste BZR verwendet.
      await supabase
        .from("regulation_documents")
        .update({ active: false })
        .eq("municipality_id", municipalityId)
        .neq("id", inserted.id)
        .eq("active", true);

      try {
        await extractFn({ data: { documentId: inserted.id } });
        toast.success("Neue Version erfasst und analysiert", { id: tid });
      } catch (e) {
        toast.warning(`Hochgeladen, Analyse fehlgeschlagen: ${(e as Error).message}`, { id: tid });
      }
      onDone();
    } catch (e) {
      toast.error((e as Error).message, { id: tid });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
      <div className="grid grid-cols-2 gap-3">
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
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. BZR 2024" />
        </div>
        <div>
          <Label>Version / Erlass</Label>
          <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="z. B. 2024-1" />
        </div>
        <div>
          <Label>Gültig ab *</Label>
          <Input type="date" required value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
        </div>
        <div className="col-span-2">
          <Label>Notizen (optional)</Label>
          <Textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="z. B. Beschluss Stadtrat vom …"
          />
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-6 text-center transition-colors ${
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
              <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setFile(null); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <CloudUpload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Datei hier ablegen oder klicken</p>
            <p className="text-xs text-muted-foreground">PDF, DOC, DOCX, PNG, JPG</p>
          </>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={busy || !file || !title.trim()} className="gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
          Version hochladen & analysieren
        </Button>
      </div>
    </div>
  );
}
