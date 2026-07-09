import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowRight,
  Building2,
  MapPin,
  Sparkles,
  ShieldCheck,
  BarChart3,
  Layers,
  Menu,
  FileText,
  Calculator,
  Map,
  Landmark,
  Database,
  Users,
  Zap,
  CheckCircle2,
  Download,
  Brain,
  ScrollText,
  TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SmarTerra — Schweizer Grundstücke in Sekunden analysieren" },
      { name: "description", content: "KI-gestützte Machbarkeitsstudien für Schweizer Grundstücke: Zonenplan, BZR, ÖREB, Grundbuch, Wirtschaftlichkeit und PDF-Bericht — vollautomatisch." },
      { property: "og:title", content: "SmarTerra — Schweizer Grundstücke in Sekunden analysieren" },
      { property: "og:description", content: "KI-gestützte Machbarkeitsstudien: Zonenplan, BZR, ÖREB, Grundbuch, Wirtschaftlichkeit und PDF-Bericht — vollautomatisch." },
      { property: "og:url", content: "https://smarterra.ch/" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c988ea04-6f6a-4922-8faa-626e5a4fe7e2/id-preview-be4fcc6f--8a88ec10-f9a8-4365-bc56-8862a07ada3d.lovable.app-1781551352846.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c988ea04-6f6a-4922-8faa-626e5a4fe7e2/id-preview-be4fcc6f--8a88ec10-f9a8-4365-bc56-8862a07ada3d.lovable.app-1781551352846.png" },
    ],
    links: [{ rel: "canonical", href: "https://smarterra.ch/" }],
  }),
  component: Landing,
});

const NAV_LINKS = [
  { label: "Funktionen", href: "#features" },
  { label: "So funktioniert's", href: "#how" },
  { label: "Datenquellen", href: "#data" },
  { label: "FAQ", href: "#faq" },
];

const FEATURES = [
  { icon: MapPin, title: "Adresse oder Parzelle", text: "Eingabe genügt — Swisstopo, kantonale GIS-Layer und Grundbuchdaten werden automatisch konsolidiert." },
  { icon: BarChart3, title: "Ausnützung & Geschossigkeit", text: "AZ, ÜZ, Fassadenhöhe, Gebäudelänge und -breite direkt aus dem Zonenplan." },
  { icon: Brain, title: "KI-BZR-Vorschlag", text: "Wenn amtliche Werte fehlen, matcht die KI (Gemini & Claude) die richtige BZR-Zone anhand von Adresslage und Bauweise." },
  { icon: Landmark, title: "ÖREB & Grundbuch", text: "Eigentumsbeschränkungen, Dienstbarkeiten und Belastungen automatisch ausgelesen und aufbereitet." },
  { icon: Calculator, title: "Volumen- & BGF-Rechner", text: "Geschosse werden automatisch vorgeschlagen. BGF pro Geschoss und Gesamtvolumen live berechnet." },
  { icon: TrendingUp, title: "Wirtschaftlichkeit & Residualwert", text: "Kosten, Erlöse und Residualwert der Parzelle inklusive Bandbreiten-Grafik — direkt vergleichbar mit dem Angebotspreis." },
  { icon: FileText, title: "Vollwertiger PDF-Bericht", text: "Sauber paginierter Machbarkeitsbericht mit Grafiken, Kapiteln und Seitennummerierung — direkt zum Download." },
  { icon: ShieldCheck, title: "Multi-Tenant & DSGVO-konform", text: "Organisationen, Teams, Rollen. Daten bleiben in Ihrer Hand — Hosting in der Schweiz-nahen EU-Region." },
  { icon: Users, title: "Team-Collaboration", text: "Projekte bündeln Analysen, Berichte lassen sich mit dem Team teilen und kommentieren." },
];

const STEPS = [
  { icon: MapPin, title: "1. Adresse eingeben", text: "Adresse, Parzellennummer oder Kartenpunkt. SmarTerra lokalisiert die Parzelle auf swisstopo." },
  { icon: Database, title: "2. Daten konsolidieren", text: "Zonenplan, BZR, ÖREB und Grundbuch werden parallel abgefragt und mit KI ergänzt, wo Werte fehlen." },
  { icon: Calculator, title: "3. Volumen & Wirtschaftlichkeit", text: "BGF, Volumen, Kosten und Residualwert werden automatisch vorgeschlagen und lassen sich anpassen." },
  { icon: Download, title: "4. Bericht generieren", text: "Ein Klick auf 'PDF herunterladen' — fertig ist die Machbarkeitsstudie inkl. Grafiken." },
];

const DATA_SOURCES = [
  { name: "Swisstopo", desc: "Amtliche Vermessung, Adressen, Höhen" },
  { name: "Kantonale WFS/WMS", desc: "Zonenpläne, Nutzungsplanung, Gefahrenkarten" },
  { name: "ÖREB-Kataster", desc: "Eigentumsbeschränkungen aller Themen" },
  { name: "Grundbuch", desc: "Dienstbarkeiten, Belastungen, Eigentümer" },
  { name: "BZR-Reglemente", desc: "Gemeindespezifische Bau- und Zonenreglemente" },
  { name: "KI-Modelle (Gemini & Claude)", desc: "Regelextraktion und Zonenzuordnung" },
];

const STATS = [
  { value: "Schweizweit", label: "Basisdaten für alle Gemeinden" },
  { value: "2 000+", label: "Wissenseinträge zu Zonen & Kennwerten" },
  { value: "< 60s", label: "Von Adresse zur Erstanalyse" },
  { value: "100%", label: "Bericht als PDF exportierbar" },
];

const FAQ = [
  { q: "Für welche Kantone funktioniert SmarTerra bereits?", a: "Basisdaten (Zonen, Adressen, Parzellen) sind schweizweit verfügbar. Tiefe BZR-Extraktion mit KI-Zuordnung ist für den Kanton Luzern flächendeckend integriert; weitere Kantone folgen laufend." },
  { q: "Was passiert, wenn amtliche Werte fehlen?", a: "SmarTerra erkennt fehlende Kennwerte (z.B. AZ/ÜZ) und schlägt mittels KI (Gemini & Claude) die passendste BZR-Zone anhand von Adresslage und WFS-Attributen vor — transparent mit Konfidenz-Angabe." },
  { q: "Kann ich Berichte als PDF exportieren?", a: "Ja. Der Bericht wird sektionsweise in A4 aufbereitet, inklusive Grafiken (Residualwert-Bandbreite, KPIs), Kopfzeilen und Seitennummerierung — direkt zum Download." },
  { q: "Wie ist der Datenschutz geregelt?", a: "Multi-Tenant-Architektur mit strikter Row-Level Security. Jede Organisation sieht nur eigene Analysen und Projekte." },
  { q: "Kann ich Werte manuell überschreiben?", a: "Ja. Alle Vorschläge (BGF pro Geschoss, Angebotspreis, Baukosten) sind editierbar. Der Bericht rechnet live mit den eingegebenen Werten." },
];

function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto grid h-16 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Layers className="h-5 w-5" />
            </div>
            <span className="truncate font-display text-lg font-bold tracking-tight sm:text-xl">
              SmarTerra
            </span>
          </Link>

          <div className="hidden items-center gap-4 md:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
            <Link
              to="/auth"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Anmelden
            </Link>
            <Button asChild>
              <Link to="/auth">Kostenlos starten</Link>
            </Button>
          </div>

          <div className="md:hidden">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Menü öffnen">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[85vw] max-w-sm">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                      <Layers className="h-4 w-4" />
                    </div>
                    SmarTerra
                  </SheetTitle>
                </SheetHeader>
                <nav className="mt-8 flex flex-col gap-1">
                  {NAV_LINKS.map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      onClick={() => setMenuOpen(false)}
                      className="rounded-md px-3 py-3 text-base font-medium text-foreground hover:bg-muted"
                    >
                      {l.label}
                    </a>
                  ))}
                  <Link
                    to="/auth"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-md px-3 py-3 text-base font-medium text-foreground hover:bg-muted"
                  >
                    Anmelden
                  </Link>
                </nav>
                <div className="mt-6 border-t border-border pt-6">
                  <Button asChild size="lg" className="w-full">
                    <Link to="/auth" onClick={() => setMenuOpen(false)}>
                      Kostenlos starten
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-7xl px-4 pt-12 pb-16 sm:px-6 sm:pt-20 sm:pb-24 lg:pt-28 lg:pb-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium text-muted-foreground sm:text-xs">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-secondary" />
              <span className="truncate">KI-gestützte Machbarkeitsstudien für die Schweiz</span>
            </div>
            <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Vom Grundstück zur Machbarkeitsstudie — in Sekunden.
            </h1>
            <p className="mt-5 text-base text-muted-foreground sm:mt-6 sm:text-lg">
              Adresse eingeben. SmarTerra kombiniert Zonenplan, BZR, ÖREB und Grundbuch,
              rechnet Volumen und Wirtschaftlichkeit — und liefert einen PDF-Bericht auf Knopfdruck.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:justify-center">
              <Button asChild size="lg" className="h-12 w-full px-7 sm:w-auto">
                <Link to="/auth">
                  14 Tage gratis testen
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 w-full px-7 sm:w-auto">
                <a href="#features">Funktionen entdecken</a>
              </Button>
            </div>

            {/* Trust bar */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground sm:text-sm">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-secondary" />Swisstopo-Integration</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-secondary" />ÖREB-konform</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-secondary" />DSGVO-konform</span>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="border-y border-border/60 bg-card/40">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 lg:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div className="font-display text-2xl font-bold text-foreground sm:text-3xl lg:text-4xl">
                  {s.value}
                </div>
                <div className="mt-1 text-xs text-muted-foreground sm:text-sm">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-secondary">Funktionen</span>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              Alles, was eine Machbarkeitsstudie braucht
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Von der ersten Adressabfrage bis zum finalen PDF-Bericht — vollständig automatisiert
              und trotzdem editierbar.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md sm:p-6">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary/15 text-secondary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-base font-semibold sm:text-lg">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-t border-border/60 bg-card/40">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-secondary">Ablauf</span>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                In vier Schritten zum Bericht
              </h2>
            </div>
            <div className="mt-10 grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s) => (
                <div key={s.title} className="relative rounded-xl border border-border bg-background p-5 sm:p-6">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-display text-base font-semibold sm:text-lg">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Data sources */}
        <section id="data" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-secondary">Datenquellen</span>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              Amtliche Daten, KI-veredelt
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              SmarTerra verbindet offizielle Schweizer Geo- und Rechtsdaten mit KI-gestützter
              Extraktion und Zuordnung.
            </p>
          </div>
          <div className="mt-10 grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
            {DATA_SOURCES.map((d) => (
              <div key={d.name} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                  <Database className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-display text-sm font-semibold sm:text-base">{d.name}</div>
                  <div className="text-xs text-muted-foreground sm:text-sm">{d.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Für wen */}
        <section className="border-t border-border/60 bg-card/40">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-secondary">Zielgruppen</span>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                Für Profis, die schnell entscheiden müssen
              </h2>
            </div>
            <div className="mt-10 grid gap-4 sm:gap-6 md:grid-cols-3">
              {[
                { icon: Building2, title: "Immobilienentwickler", text: "Grundstücke rasch bewerten, Angebote fundiert kalkulieren und Portfolio-Chancen erkennen." },
                { icon: Map, title: "Architektinnen & Planer", text: "Baurechtliche Kennwerte, ÖREB und Zonenreglement zentral — ohne stundenlange Recherche." },
                { icon: Landmark, title: "Investoren & Family Offices", text: "Residualwert und Wirtschaftlichkeit auf Knopfdruck — als teilbarer PDF-Bericht." },
              ].map((u) => (
                <div key={u.title} className="rounded-xl border border-border bg-background p-6">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary/15 text-secondary">
                    <u.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold">{u.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{u.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Report highlight */}
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="grid gap-8 rounded-2xl border border-border bg-card p-6 sm:p-10 lg:grid-cols-2 lg:gap-12">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-secondary">Bericht</span>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Ein vollwertiger PDF-Bericht — nicht nur ein Ausdruck
              </h2>
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                Sauber paginiert, mit Kopf- und Fusszeile, Grafiken und Seitennummerierung.
                Direkt teilbar mit Bank, Kunde oder Team.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Alle Kapitel: Lage, Rechtliches, Baurecht, Volumen, Wirtschaftlichkeit",
                  "Residualwert-Grafik mit Bandbreite und Angebotspreis-Marker",
                  "Amtliche Quellenangaben pro Kennwert",
                  "Live-Werte aus Ihrer Eingabe — keine Hardcodes",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative flex items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 via-secondary/10 to-transparent p-8">
              <div className="w-full max-w-sm rounded-lg border border-border bg-background p-6 shadow-lg">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                  <ScrollText className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Machbarkeitsstudie</span>
                  <span className="ml-auto text-xs text-muted-foreground">PDF · A4</span>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-2 w-3/4 rounded bg-muted" />
                  <div className="h-2 w-full rounded bg-muted" />
                  <div className="h-2 w-5/6 rounded bg-muted" />
                </div>
                <div className="mt-5 rounded-md border border-border p-3">
                  <div className="text-[10px] font-medium uppercase text-muted-foreground">Residualwert</div>
                  <div className="mt-2 h-2 w-full rounded-full bg-gradient-to-r from-destructive via-amber-400 to-emerald-500" />
                  <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                    <span>Attraktiv</span><span>Marktpreis</span><span>Teuer</span>
                  </div>
                </div>
                <Button size="sm" className="mt-4 w-full">
                  <Download className="mr-2 h-3.5 w-3.5" />PDF herunterladen
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-border/60 bg-card/40">
          <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
            <div className="text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-secondary">FAQ</span>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                Häufig gestellte Fragen
              </h2>
            </div>
            <Accordion type="single" collapsible className="mt-8">
              {FAQ.map((f, i) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger className="text-left text-sm sm:text-base">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="rounded-2xl bg-primary px-6 py-12 text-center text-primary-foreground sm:px-16 sm:py-14">
            <Zap className="mx-auto h-8 w-8 text-primary-foreground/80" />
            <h2 className="mt-4 font-display text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              Bereit für Ihre erste Analyse?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-primary-foreground/80 sm:text-base">
              Kostenlos starten, erstes Grundstück in unter zwei Minuten analysieren —
              inklusive PDF-Bericht.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button asChild size="lg" variant="secondary" className="h-12 w-full px-7 sm:w-auto">
                <Link to="/auth">Jetzt loslegen<ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-6 sm:py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 text-xs text-muted-foreground sm:flex-row sm:px-6 sm:text-sm">
          <span>© {new Date().getFullYear()} SmarTerra</span>
          <span>Made in Switzerland</span>
        </div>
      </footer>
    </div>
  );
}
