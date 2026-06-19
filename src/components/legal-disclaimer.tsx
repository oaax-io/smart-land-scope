import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type LegalDisclaimerProps = {
  variant?: "subtle" | "prominent";
  className?: string;
};

const TEXT =
  "Diese Auswertung basiert auf einer KI-gestützten Analyse hinterlegter Reglemente und Wissensdaten. " +
  "Sie ersetzt keine rechtsverbindliche Auskunft der zuständigen Bau- oder Planungsbehörde und keine Vermessung vor Ort. " +
  "Vor jeder Projektierung, Baueingabe oder finanziellen Entscheidung sind Zone, Grenzabstände, Ausnützung und " +
  "Sondervorschriften zwingend bei der Gemeinde oder im amtlichen ÖREB-Kataster zu verifizieren.";

export function LegalDisclaimer({ variant = "subtle", className }: LegalDisclaimerProps) {
  if (variant === "prominent") {
    return (
      <div
        className={cn(
          "flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100",
          className,
        )}
        role="note"
      >
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="mb-1 font-semibold">Rechtlicher Hinweis</p>
          <p className="leading-relaxed">{TEXT}</p>
        </div>
      </div>
    );
  }
  return (
    <p
      className={cn(
        "flex items-start gap-2 text-xs leading-relaxed text-muted-foreground",
        className,
      )}
      role="note"
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
      <span>{TEXT}</span>
    </p>
  );
}
