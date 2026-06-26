import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Upload, Trash2, Sparkles, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { extractEasementsFromDocument } from "@/lib/easement-extract.functions";

type Easement = {
  id: string;
  easement_type: string;
  reg_nr: string | null;
  title: string;
  description: string | null;
  beneficiary: string | null;
  burdened_parcel: string | null;
  legal_basis: string | null;
  amount_chf: number | null;
  rank: number | null;
  established_date: string | null;
  source: string;
  ai_confidence: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  dienstbarkeit: "Dienstbarkeit",
  grundlast: "Grundlast",
  pfandrecht: "Pfandrecht",
  anmerkung: "Anmerkung",
  vormerkung: "Vormerkung",
};

const TYPE_COLORS: Record<string, string> = {
  dienstbarkeit:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  grundlast:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  pfandrecht: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  anmerkung:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  vormerkung:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
};

export function EasementsPanel({
  analysisId,
  organizationId,
}: {
  analysisId: string;
  organizationId: string;
}) {
  const qc = useQueryClient();
  const extractFn = useServerFn(extractEasementsFromDocument);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [addingManual, setAddingManual] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [newItem, setNewItem] = useState({
    easement_type: "dienstbarkeit",
    title: "",
    description: "",
    reg_nr: "",
    beneficiary: "",
    legal_basis: "",
  });

  const { data: easements, isLoading } = useQuery({
    queryKey: ["easements", analysisId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analysis_easements")
        .select("*")
        .eq("analysis_id", analysisId)
        .order("easement_type", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Easement[];
    },
  });

  const grouped = (easements ?? []).reduce<Record<string, Easement[]>>(
    (acc, e) => {
      (acc[e.easement_type] ??= []).push(e);
      return acc;
    },
    {},
  );

  async function handleManualAdd() {
    if (!newItem.title.trim()) return;
    const { error } = await supabase.from("analysis_easements").insert({
      analysis_id: analysisId,
      organization_id: organizationId,
      source: "manual",
      easement_type: newItem.easement_type,
      title: newItem.title.trim(),
      description: newItem.description || null,
      reg_nr: newItem.reg_nr || null,
      beneficiary: newItem.beneficiary || null,
      legal_basis: newItem.legal_basis || null,
    });
    if (error) {
      toast.error("Speichern fehlgeschlagen", { description: error.message });
      return;
    }
    toast.success("Dienstbarkeit erfasst");
    setAddingManual(false);
    setNewItem({
      easement_type: "dienstbarkeit",
      title: "",
      description: "",
      reg_nr: "",
      beneficiary: "",
      legal_basis: "",
    });
    qc.invalidateQueries({ queryKey: ["easements", analysisId] });
  }

  async function handleDelete(id: string) {
    await supabase.from("analysis_easements").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["easements", analysisId] });
  }

  async function handleGrundbuchUpload(file: File) {
    if (!file) return;
    setExtracting(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const path = `${organizationId}/${analysisId}/grundbuchauszug/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("analysis-documents")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: docInsert, error: docErr } = await supabase
        .from("analysis_documents")
        .insert({
          analysis_id: analysisId,
          organization_id: organizationId,
          kind: "grundbuchauszug",
          file_name: file.name,
          storage_path: path,
          mime_type: file.type || "application/pdf",
          size_bytes: file.size,
        })
        .select("id")
        .single();
      if (docErr || !docInsert) throw docErr ?? new Error("Upload fehlgeschlagen");

      const result = await extractFn({
        data: { documentId: docInsert.id, analysisId },
      });
      toast.success(`${result.extractedCount} Einträge extrahiert`, {
        description:
          result.skippedCount > 0
            ? `${result.skippedCount} Einträge konnten nicht verarbeitet werden.`
            : undefined,
      });
      qc.invalidateQueries({ queryKey: ["easements", analysisId] });
    } catch (e) {
      toast.error("Extraktion fehlgeschlagen", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dienstbarkeiten & Lasten</CardTitle>
          <CardDescription>
            Eigentumsbeschränkungen manuell erfassen oder per KI aus dem
            Grundbuchauszug extrahieren.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddingManual(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Manuell erfassen
            </Button>
            <Button
              size="sm"
              disabled={extracting}
              onClick={() => fileInputRef.current?.click()}
            >
              {extracting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Grundbuchauszug hochladen & extrahieren
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleGrundbuchUpload(f);
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            PDF oder Scan des Grundbuchauszugs hochladen → KI extrahiert
            Dienstbarkeiten, Grundlasten und Pfandrechte automatisch.
          </p>
        </CardContent>
      </Card>

      {addingManual && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Neue Belastung erfassen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Typ</label>
                <Select
                  value={newItem.easement_type}
                  onValueChange={(v) =>
                    setNewItem((s) => ({ ...s, easement_type: v }))
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Register-Nr.</label>
                <Input
                  className="h-9"
                  placeholder="z. B. 49299H.UEB"
                  value={newItem.reg_nr}
                  onChange={(e) =>
                    setNewItem((s) => ({ ...s, reg_nr: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Titel / Stichwort *</label>
              <Input
                className="h-9"
                placeholder="z. B. Fusswegrecht"
                value={newItem.title}
                onChange={(e) =>
                  setNewItem((s) => ({ ...s, title: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Beschreibung</label>
              <Textarea
                rows={2}
                value={newItem.description}
                onChange={(e) =>
                  setNewItem((s) => ({ ...s, description: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">
                  Begünstigt (z.L. / z.G.)
                </label>
                <Input
                  className="h-9"
                  placeholder="z. B. Nr. 1041"
                  value={newItem.beneficiary}
                  onChange={(e) =>
                    setNewItem((s) => ({ ...s, beneficiary: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Beleg / Datum</label>
                <Input
                  className="h-9"
                  placeholder="z. B. 04.03.1942 Beleg 62HO"
                  value={newItem.legal_basis}
                  onChange={(e) =>
                    setNewItem((s) => ({ ...s, legal_basis: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleManualAdd}
                disabled={!newItem.title.trim()}
              >
                <Check className="mr-2 h-4 w-4" />
                Speichern
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setAddingManual(false)}
              >
                <X className="mr-2 h-4 w-4" />
                Abbrechen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <p className="text-sm text-muted-foreground">Lädt …</p>
      )}
      {!isLoading && (!easements || easements.length === 0) && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Noch keine Einträge. Manuell erfassen oder Grundbuchauszug
            hochladen.
          </CardContent>
        </Card>
      )}

      {Object.entries(TYPE_LABELS).map(([type, label]) => {
        const items = grouped[type] ?? [];
        if (!items.length) return null;
        return (
          <Card key={type}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_COLORS[type] ?? ""}`}
                >
                  {label}
                </span>
                <span className="text-sm font-normal text-muted-foreground">
                  ({items.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="divide-y rounded-lg border">
                {items.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-start justify-between gap-3 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{e.title}</p>
                        {e.reg_nr && (
                          <span className="font-mono text-xs text-muted-foreground">
                            {e.reg_nr}
                          </span>
                        )}
                        {e.source === "ai" && (
                          <Badge
                            variant="secondary"
                            className="h-4 gap-1 text-[10px]"
                          >
                            <Sparkles className="h-2.5 w-2.5" />
                            KI
                            {e.ai_confidence ? ` · ${e.ai_confidence}` : ""}
                          </Badge>
                        )}
                      </div>
                      {e.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {e.description}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {e.beneficiary && <span>Betr.: {e.beneficiary}</span>}
                        {e.legal_basis && <span>{e.legal_basis}</span>}
                        {e.amount_chf != null && (
                          <span className="font-medium text-foreground">
                            CHF {e.amount_chf.toLocaleString("de-CH")} —
                            Pfandstelle {e.rank ?? "?"}
                          </span>
                        )}
                        {e.established_date && (
                          <span>
                            Errichtet:{" "}
                            {new Date(e.established_date).toLocaleDateString(
                              "de-CH",
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      onClick={() => handleDelete(e.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
