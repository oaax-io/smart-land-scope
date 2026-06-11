import { CheckCircle2, Gauge, Lightbulb, ShieldAlert, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { computeDevelopmentScore, SCORE_CATEGORY } from "@/lib/scoring";

type Props = {
  input: Parameters<typeof computeDevelopmentScore>[0];
};

export function DevelopmentScoreCard({ input }: Props) {
  const result = computeDevelopmentScore(input);
  const cat = SCORE_CATEGORY[result.category];

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <Gauge className="h-4 w-4 text-secondary" />
              Entwicklungs-Score
            </CardTitle>
            <CardDescription>
              Automatische Bewertung des Grundstücks auf einer Skala von 0–100.
            </CardDescription>
          </div>
          <Badge className={cat.tone}>
            {cat.label} · {cat.range}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Score Ring */}
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-6">
          <ScoreRing value={result.score} />
          <div className="flex-1">
            <p className="font-display text-2xl font-bold tracking-tight">
              {result.categoryLabel}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {result.reasoning}
            </p>
          </div>
        </div>

        <Separator />

        {/* Breakdown */}
        <div className="space-y-2.5">
          {result.breakdown.map((b) => {
            const pct = (b.points / b.max) * 100;
            return (
              <div key={b.label}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{b.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {b.points}/{b.max}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {b.note && (
                  <p className="mt-1 text-xs text-muted-foreground">{b.note}</p>
                )}
              </div>
            );
          })}
        </div>

        <Separator />

        {/* Chancen / Risiken */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-primary/5 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Lightbulb className="h-4 w-4 text-primary" />
              Chancen
            </div>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {result.opportunities.map((o, i) => (
                <li key={i} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>{o}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border bg-destructive/5 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              Risiken
            </div>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {result.risks.map((r, i) => (
                <li key={i} className="flex gap-2">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Empfehlung */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="mb-1 flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-primary" />
            Empfehlung
          </div>
          <p className="text-sm leading-relaxed text-foreground/90">
            {result.recommendation}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreRing({ value }: { value: number }) {
  const size = 140;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(var(--muted))"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(var(--primary))"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold tabular-nums">{value}</span>
        <span className="text-xs text-muted-foreground">von 100</span>
      </div>
    </div>
  );
}
