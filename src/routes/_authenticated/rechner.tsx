import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Calculator, Home, Sparkles, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/rechner")({
  component: WohnungsrechnerPage,
});

const SIZES = [
  { key: "klein", label: "Klein", area: 60, description: "1–2 Zimmer · Studios" },
  { key: "mittel", label: "Mittel", area: 85, description: "3–4 Zimmer · Familien" },
  { key: "gross", label: "Gross", area: 120, description: "4.5–5.5 Zimmer · Premium" },
] as const;

const LIVING_RATIO = 0.8; // Nettowohnfläche / Geschossfläche

function fmt(n: number, digits = 0) {
  return new Intl.NumberFormat("de-CH", { maximumFractionDigits: digits }).format(n);
}

function WohnungsrechnerPage() {
  const [area, setArea] = useState<string>("1200");
  const [ratio, setRatio] = useState<string>("0.6");
  const [floors, setFloors] = useState<string>("3");

  const parcel = Number(area) || 0;
  const az = Number(ratio) || 0;
  const stories = Number(floors) || 0;

  const result = useMemo(() => {
    const maxGfa = parcel * az; // max. Geschossfläche
    const livingArea = maxGfa * LIVING_RATIO; // geschätzte Wohnfläche
    const variants = SIZES.map((s) => ({
      ...s,
      units: livingArea > 0 ? Math.floor(livingArea / s.area) : 0,
    }));

    // Empfehlung: orientiert sich am Gesamtprogramm (Effizienz vs. Marktnachfrage)
    let recommended = variants[1]; // default Mittel
    if (livingArea > 0) {
      if (livingArea < 400) recommended = variants[0];
      else if (livingArea > 2500) recommended = variants[2];
      else recommended = variants[1];
    }

    return { maxGfa, livingArea, variants, recommended };
  }, [parcel, az, stories]);

  const ready = parcel > 0 && az > 0 && stories > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Calculator className="h-3.5 w-3.5" /> Werkzeug
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Wohnungsrechner</h1>
        <p className="text-sm text-muted-foreground">
          Schätzen Sie die mögliche Anzahl Wohnungen basierend auf Grundstücksfläche, Ausnützungsziffer und Geschossigkeit.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Eingaben</CardTitle>
            <CardDescription>Grundstücks- und Nutzungsparameter</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="area">Grundstücksfläche (m²)</Label>
              <Input
                id="area"
                type="number"
                inputMode="decimal"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="z.B. 1200"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ratio">Ausnützungsziffer (AZ)</Label>
              <Input
                id="ratio"
                type="number"
                step="0.05"
                inputMode="decimal"
                value={ratio}
                onChange={(e) => setRatio(e.target.value)}
                placeholder="z.B. 0.6"
              />
              <p className="text-xs text-muted-foreground">
                Verhältnis Geschossfläche / Grundstücksfläche.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="floors">Geschossigkeit (Vollgeschosse)</Label>
              <Input
                id="floors"
                type="number"
                inputMode="numeric"
                value={floors}
                onChange={(e) => setFloors(e.target.value)}
                placeholder="z.B. 3"
              />
            </div>
            <div className="rounded-md border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
              Annahme: Nettowohnfläche entspricht {Math.round(LIVING_RATIO * 100)}% der Geschossfläche
              (Erschliessung, Wände, Technik abgezogen).
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Kpi
              icon={<Home className="h-4 w-4" />}
              label="Max. Geschossfläche"
              value={ready ? `${fmt(result.maxGfa)} m²` : "—"}
              hint={ready ? `${fmt(parcel)} m² × AZ ${az}` : "Werte eingeben"}
            />
            <Kpi
              icon={<TrendingUp className="h-4 w-4" />}
              label="Geschätzte Wohnfläche"
              value={ready ? `${fmt(result.livingArea)} m²` : "—"}
              hint={ready ? `${Math.round(LIVING_RATIO * 100)}% der GF` : "—"}
            />
            <Kpi
              icon={<Sparkles className="h-4 w-4" />}
              label="Empfohlene Grösse"
              value={ready ? result.recommended.label : "—"}
              hint={ready ? `${result.recommended.area} m² / Wohnung` : "—"}
              accent
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Wohnungsvarianten</CardTitle>
              <CardDescription>
                Anzahl möglicher Wohnungen pro Grössenkategorie
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              {result.variants.map((v) => {
                const isRec = ready && v.key === result.recommended.key;
                return (
                  <div
                    key={v.key}
                    className={`relative rounded-lg border p-4 transition ${
                      isRec ? "border-primary bg-primary/5" : "bg-card"
                    }`}
                  >
                    {isRec && (
                      <Badge className="absolute -top-2 right-3" variant="default">
                        Empfehlung
                      </Badge>
                    )}
                    <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Variante {v.label}
                    </div>
                    <div className="mt-1 font-display text-3xl font-bold tabular-nums">
                      {ready ? v.units : "—"}
                    </div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      Wohnungen à {v.area} m²
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">{v.description}</div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {ready && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Empfehlung
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-foreground/90">
                Basierend auf {fmt(result.livingArea)} m² nutzbarer Wohnfläche bei {stories}{" "}
                Vollgeschossen empfehlen wir die <strong>{result.recommended.label}</strong>-Variante
                mit {result.recommended.area} m² pro Wohnung. Dies ergibt rund{" "}
                <strong>{result.recommended.units} Wohnungen</strong> und bietet das beste Verhältnis
                aus Marktnachfrage, Erschliessungseffizienz und Vermietbarkeit für dieses
                Grundstück.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <Card className={accent ? "border-primary/40 bg-primary/5" : undefined}>
      <CardContent className="space-y-1 p-4">
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {icon} {label}
        </div>
        <div className="font-display text-2xl font-bold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  );
}
