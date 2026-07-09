import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ArrowRight,
  Building2,
  MapPin,
  Sparkles,
  ShieldCheck,
  BarChart3,
  Layers,
  Menu,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SmarTerra — Schweizer Grundstücke in Sekunden analysieren" },
      { name: "description", content: "KI-gestützte SaaS-Plattform für Immobilienentwickler, Investoren und Architekten. Nutzungszonen, Ausnützungsziffer, Entwicklungspotenzial — automatisch." },
      { property: "og:title", content: "SmarTerra — Schweizer Grundstücke in Sekunden analysieren" },
      { property: "og:description", content: "KI-gestützte SaaS-Plattform für Immobilienentwickler, Investoren und Architekten." },
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
  { label: "Vorteile", href: "#benefits" },
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

          {/* Desktop nav */}
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

          {/* Mobile hamburger */}
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
        <section className="mx-auto max-w-7xl px-4 pt-12 pb-16 sm:px-6 sm:pt-20 sm:pb-24 lg:pt-28 lg:pb-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium text-muted-foreground sm:text-xs">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-secondary" />
              <span className="truncate">KI-gestützte Grundstücksanalyse für die Schweiz</span>
            </div>
            <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Vom Grundstück zum Entwicklungspotenzial — in Sekunden.
            </h1>
            <p className="mt-5 text-base text-muted-foreground sm:mt-6 sm:text-lg">
              Adresse oder Parzellennummer eingeben. SmarTerra wertet Zonenplan, Ausnützungsziffer,
              Bauvorschriften und Nutzungsmöglichkeiten automatisch aus.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:justify-center">
              <Button asChild size="lg" className="h-12 w-full px-7 sm:w-auto">
                <Link to="/auth">
                  14 Tage gratis testen
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 w-full px-7 sm:w-auto">
                <a href="#features">Mehr erfahren</a>
              </Button>
            </div>
          </div>
        </section>

        <section id="features" className="border-t border-border/60 bg-card/40">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
            <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: MapPin, title: "Adresse oder Parzelle", text: "Eingabe genügt — kantonale GIS-Daten werden automatisch konsolidiert." },
                { icon: BarChart3, title: "Ausnützung & Geschossigkeit", text: "Ausnützungsziffer, Gebäudehöhe und maximales Bauvolumen auf einen Blick." },
                { icon: Building2, title: "Entwicklungspotenzial", text: "Realisierbare Nutzungen, Einschränkungen und Wertsteigerungspfade." },
                { icon: ShieldCheck, title: "Multi-Tenant & DSGVO-konform", text: "Organisationen, Teams, Rollen. Daten bleiben in Ihrer Hand." },
                { icon: Layers, title: "Projekte & Berichte", text: "Analysen in Projekte bündeln, Berichte mit dem Team teilen." },
                { icon: Sparkles, title: "Bereit für KI-Auswertung", text: "Architektur für automatisierte Empfehlungen und Szenarien vorbereitet." },
              ].map((f) => (
                <div key={f.title} className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md sm:p-6">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary/15 text-secondary">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-display text-base font-semibold sm:text-lg">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="benefits" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="rounded-2xl bg-primary px-6 py-12 text-center text-primary-foreground sm:px-16 sm:py-14">
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              Bereit, Ihr nächstes Projekt zu starten?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-primary-foreground/80 sm:text-base">
              Erstellen Sie kostenlos einen Account und analysieren Sie Ihr erstes Grundstück in unter zwei Minuten.
            </p>
            <Button asChild size="lg" variant="secondary" className="mt-8 h-12 w-full px-7 sm:w-auto">
              <Link to="/auth">Jetzt loslegen</Link>
            </Button>
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
