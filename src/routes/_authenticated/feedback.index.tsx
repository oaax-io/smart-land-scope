import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Plus, Upload, Loader2, X, ImageIcon, ShieldCheck, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useOrg } from "@/hooks/use-org";
import { usePlatformAdmin } from "@/hooks/use-platform-admin";
import {
  CATEGORY_LABEL,
  PRIORITY_LABEL,
  STATUS_META,
  STATUS_ORDER,
  type FeedbackCategory,
  type FeedbackPriority,
  type FeedbackStatus,
} from "@/lib/feedback-meta";

export const Route = createFileRoute("/_authenticated/feedback/")({
  head: () => ({ meta: [{ title: "Feedback — SmarTerra" }] }),
  component: FeedbackListPage,
});

type FeedbackRow = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: FeedbackCategory;
  priority: FeedbackPriority;
  status: FeedbackStatus;
  screenshot_path: string | null;
  created_at: string;
  updated_at: string;
  author_name?: string | null;
};

function FeedbackListPage() {
  const { user } = useAuth();
  const { isAdmin } = usePlatformAdmin();
  const [filter, setFilter] = useState<"all" | FeedbackStatus>("all");
  const [open, setOpen] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["feedback-list", isAdmin],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedback")
        .select("id,user_id,title,description,category,priority,status,screenshot_path,created_at,updated_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as FeedbackRow[];
      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
      const profileMap = new Map<string, { first_name: string | null; last_name: string | null; email: string | null }>();
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,first_name,last_name,email")
          .in("id", userIds);
        (profs ?? []).forEach((p) => profileMap.set(p.id, p));
      }
      return rows.map((r) => {
        const p = profileMap.get(r.user_id);
        const name = p ? [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || p.email || null : null;
        return { ...r, author_name: name };
      });
    },
  });

  const filtered = filter === "all" ? items : items.filter((i) => i.status === filter);

  const counts = STATUS_ORDER.reduce<Record<string, number>>((acc, s) => {
    acc[s] = items.filter((i) => i.status === s).length;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" /> Feedback
            {isAdmin && (
              <Badge variant="outline" className="ml-1 gap-1 text-[10px]">
                <ShieldCheck className="h-3 w-3" /> Admin-Ansicht
              </Badge>
            )}
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {isAdmin ? "Alle Rückmeldungen" : "Mein Feedback"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin
              ? "Plattformweite Übersicht aller Rückmeldungen. Status setzen und antworten."
              : "Melden Sie Fehler, schlagen Sie Verbesserungen vor oder stellen Sie Fragen."}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Neues Feedback
            </Button>
          </DialogTrigger>
          <NewFeedbackDialog onSuccess={() => setOpen(false)} />
        </Dialog>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList className="flex h-auto flex-wrap gap-1 bg-muted/50 p-1">
          <TabsTrigger value="all" className="gap-1.5">
            Alle <span className="text-xs opacity-60">{items.length}</span>
          </TabsTrigger>
          {STATUS_ORDER.map((s) => (
            <TabsTrigger key={s} value={s} className="gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[s].dot}`} />
              {STATUS_META[s].label}
              <span className="text-xs opacity-60">{counts[s] ?? 0}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Lade Feedback …</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-muted">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="font-medium">Noch kein Feedback vorhanden</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Klicken Sie auf „Neues Feedback", um eine Rückmeldung zu hinterlassen.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((item) => (
            <FeedbackCard key={item.id} item={item} showOwner={isAdmin} />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedbackCard({ item, showOwner }: { item: FeedbackRow; showOwner: boolean }) {
  const meta = STATUS_META[item.status];
  return (
    <Link
      to="/feedback/$id"
      params={{ id: item.id }}
      className="block"
    >
      <Card className="transition hover:border-primary/40 hover:shadow-sm">
        <CardContent className="flex items-start gap-4 p-4">
          {item.screenshot_path ? (
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md border bg-muted/40 text-muted-foreground">
              <ImageIcon className="h-4 w-4" />
            </div>
          ) : (
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md border bg-muted/40 text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${meta.className}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                {meta.label}
              </span>
              <Badge variant="outline" className="text-[10px]">{CATEGORY_LABEL[item.category]}</Badge>
              {item.priority === "urgent" && (
                <Badge variant="destructive" className="text-[10px]">Dringend</Badge>
              )}
              {item.priority === "high" && (
                <Badge variant="secondary" className="text-[10px]">Hoch</Badge>
              )}
            </div>
            <p className="mt-1 truncate font-medium">{item.title}</p>
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {new Date(item.created_at).toLocaleString("de-CH")}
              {showOwner && ` · von ${item.user_id.slice(0, 8)}…`}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function NewFeedbackDialog({ onSuccess }: { onSuccess: () => void }) {
  const { user } = useAuth();
  const { currentOrgId } = useOrg();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [priority, setPriority] = useState<FeedbackPriority>("medium");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const previewUrl = file ? URL.createObjectURL(file) : null;

  function pickFile(f: File | null | undefined) {
    setError(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (!f.type.startsWith("image/")) {
      setError("Nur Bilder erlaubt");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("Bild zu gross (max. 5 MB)");
      return;
    }
    setFile(f);
  }



  const submit = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Nicht angemeldet");
      if (title.trim().length < 3) throw new Error("Titel zu kurz");
      if (description.trim().length < 3) throw new Error("Beschreibung zu kurz");

      let screenshotPath: string | null = null;
      if (file) {
        if (file.size > 5 * 1024 * 1024) throw new Error("Bild zu gross (max. 5 MB)");
        if (!file.type.startsWith("image/")) throw new Error("Nur Bilder erlaubt");
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("feedback-screenshots")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        screenshotPath = path;
      }

      const { data, error } = await supabase
        .from("feedback")
        .insert({
          user_id: user.id,
          organization_id: currentOrgId ?? null,
          title: title.trim(),
          description: description.trim(),
          category,
          priority,
          screenshot_path: screenshotPath,
          page_url: typeof window !== "undefined" ? window.location.href : null,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Feedback gesendet — danke!");
      queryClient.invalidateQueries({ queryKey: ["feedback-list"] });
      onSuccess();
      navigate({ to: "/feedback/$id", params: { id: data.id } });
    },
    onError: (e: Error) => setError(e.message || "Unbekannter Fehler"),
  });

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Neues Feedback</DialogTitle>
        <DialogDescription>
          Beschreiben Sie Ihr Anliegen. Optional kann ein Screenshot beigefügt werden.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Kategorie</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as FeedbackCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(CATEGORY_LABEL) as FeedbackCategory[]).map((k) => (
                  <SelectItem key={k} value={k}>{CATEGORY_LABEL[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Priorität</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as FeedbackPriority)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(PRIORITY_LABEL) as FeedbackPriority[]).map((k) => (
                  <SelectItem key={k} value={k}>{PRIORITY_LABEL[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fb-title">Titel</Label>
          <Input id="fb-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Kurze Zusammenfassung" maxLength={200} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fb-desc">Beschreibung</Label>
          <Textarea
            id="fb-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Was ist passiert? Welche Schritte führten dazu?"
            rows={5}
            maxLength={5000}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fb-file">Screenshot (optional, max. 5 MB)</Label>
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              pickFile(e.dataTransfer.files?.[0]);
            }}
            onPaste={(e) => {
              const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
              if (item) pickFile(item.getAsFile());
            }}
            className={`relative rounded-md border-2 border-dashed p-4 transition ${
              isDragging ? "border-primary bg-primary/5" : "border-border bg-muted/30"
            }`}
          >
            {file && previewUrl ? (
              <div className="flex items-start gap-3">
                <img src={previewUrl} alt="Vorschau" className="h-20 w-20 rounded border object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => { setFile(null); setError(null); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label htmlFor="fb-file" className="flex cursor-pointer flex-col items-center gap-1 py-3 text-center">
                <ImageIcon className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm">
                  <span className="font-medium text-primary">Klicken</span>, Datei hierher ziehen oder einfügen (Strg+V)
                </p>
                <p className="text-xs text-muted-foreground">PNG, JPG bis 5 MB</p>
              </label>
            )}
            <input
              id="fb-file"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
          </div>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onSuccess} disabled={submit.isPending}>Abbrechen</Button>
        <Button onClick={() => { setError(null); submit.mutate(); }} disabled={submit.isPending}>
          {submit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          Senden
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
