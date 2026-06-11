import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Building2, MapPin, FileText, Upload, Trash2, Download, Plus, ShieldAlert, Sparkles, Loader2, CheckCircle2, AlertCircle, RefreshCw, BookOpen, Layers } from "lucide-react";
import { extractRegulationDocument } from "@/lib/regulation-extract.functions";

const searchSchema = z.object({
  canton: z.string().length(2).optional(),
  gemeinde: z.string().trim().min(1).max(100).optional(),
});

export const Route = createFileRoute("/_authenticated/admin/reglemente")({
  validateSearch: (s) => searchSchema.parse(s),
  component: ReglementePage,
});

const DOC_TYPES = ["BZR", "BZO", "Zonenplan", "Gestaltungsplan", "Sondervorschriften", "Sonstige"] as const;
type DocType = (typeof DOC_TYPES)[number];

type Canton = { id: string; name: string; code: string };
type Municipality = { id: string; name: string; canton_id: string; bfs_number: number | null };
type RegDoc = {
  id: string; municipality_id: string; doc_type: DocType; title: string;
  version: string | null; valid_from: string | null; file_path: string;
  file_name: string | null; file_size: number | null; created_at: string;
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
  const qc = useQueryClient();
  const [selectedCanton, setSelectedCanton] = useState<string | null>(null);
  const [selectedMuni, setSelectedMuni] = useState<string | null>(null);

  const cantonsQ = useQuery({
    queryKey: ["cantons"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cantons").select("*").order("code");
      if (error) throw error;
      return data as Canton[];
    },
  });

  const munisQ = useQuery({
    queryKey: ["munis", selectedCanton],
    enabled: !!selectedCanton,
    queryFn: async () => {
      const { data, error } = await supabase.from("municipalities").select("*")
        .eq("canton_id", selectedCanton!).order("name");
      if (error) throw error;
      return data as Municipality[];
    },
  });

  const docsQ = useQuery({
    queryKey: ["regdocs", selectedMuni],
    enabled: !!selectedMuni,
    queryFn: async () => {
      const { data, error } = await supabase.from("regulation_documents").select("*")
        .eq("municipality_id", selectedMuni!).order("created_at", { ascending: false });
      if (error) throw error;
      return data as RegDoc[];
    },
  });

  useEffect(() => {
    if (cantonsQ.data && !selectedCanton && cantonsQ.data[0]) setSelectedCanton(cantonsQ.data[0].id);
  }, [cantonsQ.data, selectedCanton]);
  useEffect(() => { setSelectedMuni(null); }, [selectedCanton]);
  useEffect(() => {
    if (munisQ.data && !selectedMuni && munisQ.data[0]) setSelectedMuni(munisQ.data[0].id);
  }, [munisQ.data, selectedMuni]);

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
            <CardDescription>
              Dieses Modul ist nur für Plattform-Administratoren zugänglich.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Reglemente</h1>
          <p className="text-muted-foreground">
            Schweizer Bau- und Zonenreglemente — zentrale Wissensdatenbank.
          </p>
        </div>
        <Badge variant="outline">Admin</Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_320px_1fr]">
        {/* Cantons */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4" /> Kantone
              </CardTitle>
              <CantonDialog onCreated={() => qc.invalidateQueries({ queryKey: ["cantons"] })} />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {cantonsQ.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">Noch keine Kantone erfasst.</p>
            )}
            {cantonsQ.data?.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCanton(c.id)}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  selectedCanton === c.id ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                }`}
              >
                <span className="font-medium">{c.name}</span>
                <Badge variant="secondary" className="font-mono">{c.code}</Badge>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Municipalities */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4" /> Gemeinden
              </CardTitle>
              <MunicipalityDialog
                cantonId={selectedCanton}
                onCreated={() => qc.invalidateQueries({ queryKey: ["munis", selectedCanton] })}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {!selectedCanton && (
              <p className="text-sm text-muted-foreground">Kanton auswählen.</p>
            )}
            {selectedCanton && munisQ.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">Keine Gemeinden in diesem Kanton.</p>
            )}
            {munisQ.data?.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMuni(m.id)}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  selectedMuni === m.id ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                }`}
              >
                <span className="font-medium">{m.name}</span>
                {m.bfs_number && (
                  <span className="text-xs text-muted-foreground">BFS {m.bfs_number}</span>
                )}
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Documents */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" /> Dokumente
              </CardTitle>
              <DocumentDialog
                municipalityId={selectedMuni}
                onCreated={() => qc.invalidateQueries({ queryKey: ["regdocs", selectedMuni] })}
              />
            </div>
          </CardHeader>
          <CardContent>
            {!selectedMuni && (
              <p className="text-sm text-muted-foreground">Gemeinde auswählen.</p>
            )}
            {selectedMuni && (
              <DocumentsTable
                docs={docsQ.data ?? []}
                onDeleted={() => qc.invalidateQueries({ queryKey: ["regdocs", selectedMuni] })}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CantonDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("cantons").insert({ name, code: code.toUpperCase() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kanton erfasst"); setName(""); setCode(""); setOpen(false); onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Plus className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kanton erfassen</DialogTitle>
          <DialogDescription>Name und Kürzel (z. B. ZH, BE, VD).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Zürich" /></div>
          <div><Label>Kürzel</Label><Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={3} placeholder="ZH" /></div>
        </div>
        <DialogFooter>
          <Button onClick={() => mut.mutate()} disabled={!name || !code || mut.isPending}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MunicipalityDialog({ cantonId, onCreated }: { cantonId: string | null; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [bfs, setBfs] = useState("");
  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("municipalities").insert({
        canton_id: cantonId!, name, bfs_number: bfs ? Number(bfs) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Gemeinde erfasst"); setName(""); setBfs(""); setOpen(false); onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={!cantonId}><Plus className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gemeinde erfassen</DialogTitle>
          <DialogDescription>Neue Gemeinde im ausgewählten Kanton.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Winterthur" /></div>
          <div><Label>BFS-Nummer (optional)</Label><Input value={bfs} onChange={(e) => setBfs(e.target.value)} type="number" placeholder="230" /></div>
        </div>
        <DialogFooter>
          <Button onClick={() => mut.mutate()} disabled={!name || mut.isPending}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DocumentDialog({ municipalityId, onCreated }: { municipalityId: string | null; onCreated: () => void }) {
  const extractFn = useServerFn(extractRegulationDocument);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState<DocType>("BZR");
  const [version, setVersion] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async () => {
    if (!file || !municipalityId) return;
    setUploading(true);
    try {
      const path = `${municipalityId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("regulation-documents").upload(path, file);
      if (upErr) throw upErr;
      const { data: u } = await supabase.auth.getUser();
      const { data: inserted, error: insErr } = await supabase.from("regulation_documents").insert({
        municipality_id: municipalityId,
        doc_type: docType,
        title,
        version: version || null,
        valid_from: validFrom || null,
        file_path: path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        notes: notes || null,
        uploaded_by: u.user?.id ?? null,
      }).select("id").single();
      if (insErr) throw insErr;
      toast.success("Dokument hochgeladen — KI-Analyse läuft im Hintergrund");
      setTitle(""); setVersion(""); setValidFrom(""); setNotes(""); setFile(null);
      setOpen(false); onCreated();

      // Fire-and-forget AI extraction
      extractFn({ data: { documentId: inserted.id } })
        .then(() => { toast.success("KI-Analyse abgeschlossen"); onCreated(); })
        .catch((e: Error) => toast.error(`KI-Analyse fehlgeschlagen: ${e.message}`));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={!municipalityId}><Upload className="h-4 w-4" /> Hochladen</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Dokument hochladen</DialogTitle>
          <DialogDescription>BZR, BZO, Zonenplan, Gestaltungsplan oder weitere Reglemente.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Titel</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bau- und Zonenordnung 2024" />
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
          <div><Label>Version</Label><Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="v2024.1" /></div>
          <div className="col-span-2"><Label>Gültig ab</Label><Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} /></div>
          <div className="col-span-2"><Label>Datei</Label>
            <Input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="col-span-2"><Label>Notizen</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={!title || !file || uploading}>
            {uploading ? "Lade hoch…" : "Hochladen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DocumentsTable({ docs, onDeleted }: { docs: RegDoc[]; onDeleted: () => void }) {
  const extractFn = useServerFn(extractRegulationDocument);
  const qc = useQueryClient();
  const ids = useMemo(() => docs.map((d) => d.id), [docs]);

  const extractionsQ = useQuery({
    queryKey: ["regextractions", ids],
    enabled: ids.length > 0,
    refetchInterval: 4000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("regulation_extractions")
        .select("document_id, status, error_message, processed_at")
        .in("document_id", ids);
      if (error) throw error;
      return data as { document_id: string; status: string; error_message: string | null; processed_at: string | null }[];
    },
  });

  const statusByDoc = useMemo(() => {
    const m = new Map<string, { status: string; error: string | null }>();
    extractionsQ.data?.forEach((e) =>
      m.set(e.document_id, { status: e.status, error: e.error_message }),
    );
    return m;
  }, [extractionsQ.data]);

  const handleDownload = async (path: string, name: string | null) => {
    const { data, error } = await supabase.storage.from("regulation-documents").createSignedUrl(path, 60);
    if (error) return toast.error(error.message);
    const a = document.createElement("a");
    a.href = data.signedUrl; a.download = name ?? "document"; a.click();
  };

  const handleDelete = async (doc: RegDoc) => {
    if (!confirm(`"${doc.title}" wirklich löschen?`)) return;
    await supabase.storage.from("regulation-documents").remove([doc.file_path]);
    const { error } = await supabase.from("regulation_documents").delete().eq("id", doc.id);
    if (error) return toast.error(error.message);
    toast.success("Gelöscht"); onDeleted();
  };

  const handleReExtract = async (doc: RegDoc) => {
    toast.info("KI-Analyse gestartet…");
    try {
      await extractFn({ data: { documentId: doc.id } });
      toast.success("KI-Analyse abgeschlossen");
      qc.invalidateQueries({ queryKey: ["regextractions"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (docs.length === 0) {
    return <p className="text-sm text-muted-foreground">Noch keine Dokumente hochgeladen.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Typ</TableHead>
          <TableHead>Titel</TableHead>
          <TableHead>KI-Status</TableHead>
          <TableHead>Version</TableHead>
          <TableHead className="text-right">Aktionen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {docs.map((d) => {
          const st = statusByDoc.get(d.id);
          return (
            <TableRow key={d.id}>
              <TableCell><Badge variant="outline">{d.doc_type}</Badge></TableCell>
              <TableCell className="font-medium">{d.title}</TableCell>
              <TableCell>
                <ExtractionStatusBadge status={st?.status} error={st?.error} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{d.version ?? "—"}</TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="ghost" title="KI-Analyse erneut starten" onClick={() => handleReExtract(d)}>
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
          );
        })}
      </TableBody>
    </Table>
  );
}

function ExtractionStatusBadge({ status, error }: { status?: string; error?: string | null }) {
  if (!status) return <Badge variant="outline" className="gap-1"><Sparkles className="h-3 w-3" /> Bereit</Badge>;
  if (status === "processing" || status === "pending")
    return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Analyse läuft</Badge>;
  if (status === "completed")
    return <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700"><CheckCircle2 className="h-3 w-3" /> Analysiert</Badge>;
  return <Badge variant="destructive" className="gap-1" title={error ?? undefined}><AlertCircle className="h-3 w-3" /> Fehler</Badge>;
}

