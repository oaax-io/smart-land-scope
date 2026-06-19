import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Send, ShieldCheck, Trash2, ImageIcon, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
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

export const Route = createFileRoute("/_authenticated/feedback/$id")({
  head: () => ({ meta: [{ title: "Feedback — SmarTerra" }] }),
  component: FeedbackDetailPage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl p-6"><p className="text-sm text-destructive">Fehler: {error.message}</p></div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl p-6"><p className="text-sm text-muted-foreground">Feedback nicht gefunden.</p></div>
  ),
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
  page_url: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
};

type CommentRow = {
  id: string;
  feedback_id: string;
  user_id: string;
  body: string;
  is_admin: boolean;
  created_at: string;
};

function FeedbackDetailPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { isAdmin } = usePlatformAdmin();
  const queryClient = useQueryClient();

  const { data: item, isLoading } = useQuery({
    queryKey: ["feedback", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("feedback").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data as FeedbackRow;
    },
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["feedback-comments", id],
    enabled: !!item,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedback_comments")
        .select("*")
        .eq("feedback_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CommentRow[];
    },
  });

  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!item?.screenshot_path) {
      setScreenshotUrl(null);
      return;
    }
    supabase.storage
      .from("feedback-screenshots")
      .createSignedUrl(item.screenshot_path, 3600)
      .then(({ data }) => {
        if (active) setScreenshotUrl(data?.signedUrl ?? null);
      });
    return () => {
      active = false;
    };
  }, [item?.screenshot_path]);

  const updateStatus = useMutation({
    mutationFn: async (status: FeedbackStatus) => {
      const { error } = await supabase.from("feedback").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status aktualisiert");
      queryClient.invalidateQueries({ queryKey: ["feedback", id] });
      queryClient.invalidateQueries({ queryKey: ["feedback-list"] });
    },
    onError: (e: Error) => toast.error("Fehler", { description: e.message }),
  });

  const deleteFeedback = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("feedback").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Gelöscht");
      queryClient.invalidateQueries({ queryKey: ["feedback-list"] });
      window.history.back();
    },
    onError: (e: Error) => toast.error("Fehler", { description: e.message }),
  });

  const [draft, setDraft] = useState("");
  const sendComment = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Nicht angemeldet");
      if (draft.trim().length < 1) throw new Error("Kommentar leer");
      const { error } = await supabase.from("feedback_comments").insert({
        feedback_id: id,
        user_id: user.id,
        body: draft.trim(),
        is_admin: isAdmin,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["feedback-comments", id] });
    },
    onError: (e: Error) => toast.error("Fehler", { description: e.message }),
  });

  if (isLoading) {
    return <div className="mx-auto max-w-4xl p-6 text-sm text-muted-foreground">Lade …</div>;
  }
  if (!item) return null;

  const meta = STATUS_META[item.status];
  const canDelete = isAdmin || item.user_id === user?.id;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link to="/feedback"><ArrowLeft className="mr-1 h-4 w-4" />Zurück zu Feedback</Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${meta.className}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                {meta.label}
              </span>
              <Badge variant="outline" className="text-[10px]">{CATEGORY_LABEL[item.category]}</Badge>
              <Badge variant="outline" className="text-[10px]">Priorität: {PRIORITY_LABEL[item.priority]}</Badge>
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">{item.title}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Erstellt {new Date(item.created_at).toLocaleString("de-CH")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Select value={item.status} onValueChange={(v) => updateStatus.mutate(v as FeedbackStatus)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      <span className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[s].dot}`} />
                        {STATUS_META[s].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {canDelete && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (confirm("Feedback wirklich löschen?")) deleteFeedback.mutate();
                }}
                disabled={deleteFeedback.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />Löschen
              </Button>
            )}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Beschreibung</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{item.description}</p>

          {screenshotUrl && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <ImageIcon className="h-3.5 w-3.5" /> Screenshot
              </div>
              <a href={screenshotUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border">
                <img src={screenshotUrl} alt="Screenshot" className="max-h-[500px] w-full object-contain bg-muted/30" />
              </a>
            </div>
          )}

          {(item.page_url || (isAdmin && item.user_agent)) && (
            <>
              <Separator />
              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                {item.page_url && (
                  <div className="min-w-0">
                    <div className="font-medium uppercase tracking-wider">Seite</div>
                    <a href={item.page_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 truncate text-foreground hover:underline">
                      {item.page_url}<ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>
                )}
                {isAdmin && item.user_agent && (
                  <div className="min-w-0">
                    <div className="font-medium uppercase tracking-wider">Browser</div>
                    <p className="truncate text-foreground">{item.user_agent}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Konversation</CardTitle>
          <CardDescription>
            {isAdmin ? "Antworten Sie dem Nutzer." : "Antworten des Plattform-Teams erscheinen hier."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {comments.length === 0 ? (
            <p className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
              Noch keine Kommentare.
            </p>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => (
                <div
                  key={c.id}
                  className={`rounded-md border p-3 ${
                    c.is_admin ? "border-primary/40 bg-primary/5" : "bg-card"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2 text-xs">
                    {c.is_admin ? (
                      <span className="inline-flex items-center gap-1 font-medium text-primary">
                        <ShieldCheck className="h-3.5 w-3.5" /> Plattform-Team
                      </span>
                    ) : (
                      <span className="font-medium">Nutzer</span>
                    )}
                    <span className="text-muted-foreground">
                      {new Date(c.created_at).toLocaleString("de-CH")}
                    </span>
                  </div>
                  <p className="whitespace-pre-line text-sm leading-relaxed">{c.body}</p>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={isAdmin ? "Als Plattform-Team antworten …" : "Antwort schreiben …"}
              rows={3}
              maxLength={5000}
            />
            <div className="flex justify-end">
              <Button onClick={() => sendComment.mutate()} disabled={sendComment.isPending || draft.trim().length === 0}>
                {sendComment.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Senden
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
