import type { Database } from "@/integrations/supabase/types";

export type FeedbackStatus = Database["public"]["Enums"]["feedback_status"];
export type FeedbackCategory = Database["public"]["Enums"]["feedback_category"];
export type FeedbackPriority = Database["public"]["Enums"]["feedback_priority"];

export const STATUS_META: Record<
  FeedbackStatus,
  { label: string; className: string; dot: string }
> = {
  open: {
    label: "Offen",
    className: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  in_review: {
    label: "Wird geprüft",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  in_progress: {
    label: "In Bearbeitung",
    className: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  resolved: {
    label: "Gelöst",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  closed: {
    label: "Geschlossen",
    className: "border-muted-foreground/30 bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
  wont_fix: {
    label: "Abgelehnt",
    className: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300",
    dot: "bg-rose-500",
  },
};

export const STATUS_ORDER: FeedbackStatus[] = [
  "open",
  "in_review",
  "in_progress",
  "resolved",
  "closed",
  "wont_fix",
];

export const CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  bug: "Fehler",
  feature: "Feature-Wunsch",
  question: "Frage",
  other: "Sonstiges",
};

export const PRIORITY_LABEL: Record<FeedbackPriority, string> = {
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
  urgent: "Dringend",
};
