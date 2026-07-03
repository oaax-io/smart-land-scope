import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ruler, Loader2, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  municipalityName: string;
  cantonCode: string;
  zoneCode: string;
};

export function ZoneRegulationsPanel({ municipalityName, cantonCode, zoneCode }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const muniQ = useQuery({
    queryKey: ["muni-id", municipalityName, cantonCode],
    enabled: !!municipalityName && !!cantonCode,
    queryFn: async () => {
      const { data } = await supabase
        .from("municipalities")
        .select("id, cantons!inner(code)")
        .eq("name", municipalityName)
        .eq("cantons.code", cantonCode)
        .maybeSingle();
      return (data?.id as string | undefined) ?? null;
    },
  });
  const municipalityId = muniQ.data ?? null;

  const regsQ = useQuery({
    queryKey: ["zone-regulations", municipalityId, zoneCode],
    enabled: !!municipalityId && !!zoneCode,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("zone_regulations")
        .select("*")
        .eq("municipality_id", municipalityId!)
        .eq("zone_code", zoneCode)
        .order("verified", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const regs = regsQ.data ?? [];
  const primary = regs.find((r) => r.verified) ?? regs[0] ?? null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Ruler className="h-4 w-4 text-secondary" /> Grenzabstände & Parkierung
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Zone {zoneCode || "—"} · {municipalityName} ({cantonCode}) · Community-Beiträge
          </p>
        </div>
        {municipalityId && zoneCode && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> {primary ? "Ergänzen" : "Erfassen"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {regsQ.isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade …
          </div>
        )}
        {!regsQ.isLoading && !primary && (
          <p className="text-sm text-muted-foreground">
            Noch keine Community-Daten zu Grenzabständen für diese Zone. Trage deine Werte aus dem
            BZR bei — sie helfen allen Nutzern.
          </p>
        )}
        {primary && (
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <Field label="Kleiner Grenzabstand" value={fmtM(primary.setback_small_m)} />
            <Field label="Grosser Grenzabstand" value={fmtM(primary.setback_large_m)} />
            <Field label="Gebäudeabstand" value={fmtM(primary.setback_building_m)} />
            <Field label="Strassenabstand (Haupt)" value={fmtM(primary.setback_road_main_m)} />
            <Field label="Strassenabstand (lokal)" value={fmtM(primary.setback_road_local_m)} />
            <Field label="Parkierung" value={primary.parking_rate ?? "—"} />
            <Field
              label="Dachgeschoss anrechenbar"
              value={primary.attic_counted == null ? "—" : primary.attic_counted ? "ja" : "nein"}
            />
            <Field
              label="Untergeschoss anrechenbar"
              value={
                primary.basement_counted == null ? "—" : primary.basement_counted ? "ja" : "nein"
              }
            />
            <div className="col-span-2 sm:col-span-3 flex flex-wrap items-center gap-2 pt-1">
              {primary.verified ? (
                <Badge className="gap-1" variant="secondary">
                  <ShieldCheck className="h-3 w-3" /> Geprüft
                </Badge>
              ) : (
                <Badge variant="outline">Nicht geprüft</Badge>
              )}
              {primary.source_article && (
                <span className="text-xs text-muted-foreground">
                  Quelle: {primary.source_article}
                </span>
              )}
            </div>
          </div>
        )}
        {regs.length > 1 && (
          <p className="text-xs text-muted-foreground">
            {regs.length - 1} weitere Beitrag/Beiträge — von Redaktion zusammengeführt.
          </p>
        )}
      </CardContent>

      {municipalityId && zoneCode && user && (
        <ContributeDialog
          open={open}
          onOpenChange={setOpen}
          municipalityId={municipalityId}
          zoneCode={zoneCode}
          cantonCode={cantonCode}
          userId={user.id}
          onSaved={() => qc.invalidateQueries({ queryKey: ["zone-regulations", municipalityId, zoneCode] })}
        />
      )}
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}

function fmtM(v: number | null | undefined) {
  return v == null ? "—" : `${v} m`;
}

function ContributeDialog({
  open,
  onOpenChange,
  municipalityId,
  zoneCode,
  cantonCode,
  userId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  municipalityId: string;
  zoneCode: string;
  cantonCode: string;
  userId: string;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    setback_small_m: "",
    setback_large_m: "",
    setback_road_main_m: "",
    parking_rate: "",
    attic_counted: false,
    basement_counted: false,
    source_article: "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const num = (s: string) => (s.trim() ? Number(s.replace(",", ".")) : null);
      const { error } = await supabase.from("zone_regulations").insert({
        municipality_id: municipalityId,
        zone_code: zoneCode,
        canton_code: cantonCode,
        setback_small_m: num(form.setback_small_m),
        setback_large_m: num(form.setback_large_m),
        setback_road_main_m: num(form.setback_road_main_m),
        parking_rate: form.parking_rate.trim() || null,
        attic_counted: form.attic_counted,
        basement_counted: form.basement_counted,
        source_article: form.source_article.trim() || null,
        contributed_by: userId,
        source: "community",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Danke für deinen Beitrag!", {
        description: "Wird von der SmarTerra-Redaktion geprüft.",
      });
      onSaved();
      onOpenChange(false);
      setForm({
        setback_small_m: "",
        setback_large_m: "",
        setback_road_main_m: "",
        parking_rate: "",
        attic_counted: false,
        basement_counted: false,
        source_article: "",
      });
    },
    onError: (e: Error) => toast.error("Speichern fehlgeschlagen", { description: e.message }),
  });

  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v as never }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Grenzabstände erfassen — Zone {zoneCode}</DialogTitle>
          <DialogDescription>
            Werte aus dem BZR eintragen. Nach Prüfung durch die Redaktion für alle sichtbar.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Kleiner Grenzabstand (m)</Label>
            <Input inputMode="decimal" value={form.setback_small_m}
              onChange={(e) => set("setback_small_m", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Grosser Grenzabstand (m)</Label>
            <Input inputMode="decimal" value={form.setback_large_m}
              onChange={(e) => set("setback_large_m", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Strassenabstand Hauptstr. (m)</Label>
            <Input inputMode="decimal" value={form.setback_road_main_m}
              onChange={(e) => set("setback_road_main_m", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Parkierung</Label>
            <Input placeholder="z. B. 1 PP / Wohnung" value={form.parking_rate}
              onChange={(e) => set("parking_rate", e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.attic_counted}
              onCheckedChange={(v) => set("attic_counted", v === true)} />
            Dachgeschoss anrechenbar
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.basement_counted}
              onCheckedChange={(v) => set("basement_counted", v === true)} />
            Untergeschoss anrechenbar
          </label>
          <div className="col-span-2 space-y-1.5">
            <Label>Quelle / Artikel (optional)</Label>
            <Input placeholder="z. B. BZR Art. 12 Abs. 2" value={form.source_article}
              onChange={(e) => set("source_article", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Beitrag speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
