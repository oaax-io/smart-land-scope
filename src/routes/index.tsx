import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, Building2, MapPin, Sparkles, ShieldCheck, BarChart3, Layers } from "lucide-react";

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

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Layers className="h-5 w-5" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight">SmarTerra</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/auth" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Anmelden
            </Link>
            <Button asChild>
              <Link to="/auth">Kostenlos starten</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-7xl px-6 pt-20 pb-24 lg:pt-28 lg:pb-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-secondary" />
              KI-gestützte Grundstücksanalyse für die Schweiz
            </div>
            <h1 className="mt-6 font-display text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
              Vom Grundstück zum Entwicklungspotenzial — in Sekunden.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              Adresse oder Parzellennummer eingeben. SmarTerra wertet Zonenplan, Ausnützungsziffer,
              Bauvorschriften und Nutzungsmöglichkeiten automatisch aus.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="h-12 px-7">
                <Link to="/auth">
                  14 Tage gratis testen
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-7">
                <a href="#features">Mehr erfahren</a>
              </Button>
            </div>
          </div>
        </section>

        <section id="features" className="border-t border-border/60 bg-card/40">
          <div className="mx-auto max-w-7xl px-6 py-20">
            <div className="grid gap-6 md:grid-cols-3">
              {[
                { icon: MapPin, title: "Adresse oder Parzelle", text: "Eingabe genügt — kantonale GIS-Daten werden automatisch konsolidiert." },
                { icon: BarChart3, title: "Ausnützung & Geschossigkeit", text: "Ausnützungsziffer, Gebäudehöhe und maximales Bauvolumen auf einen Blick." },
                { icon: Building2, title: "Entwicklungspotenzial", text: "Realisierbare Nutzungen, Einschränkungen und Wertsteigerungspfade." },
                { icon: ShieldCheck, title: "Multi-Tenant & DSGVO-konform", text: "Organisationen, Teams, Rollen. Daten bleiben in Ihrer Hand." },
                { icon: Layers, title: "Projekte & Berichte", text: "Analysen in Projekte bündeln, Berichte mit dem Team teilen." },
                { icon: Sparkles, title: "Bereit für KI-Auswertung", text: "Architektur für automatisierte Empfehlungen und Szenarien vorbereitet." },
              ].map((f) => (
                <div key={f.title} className="rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-md">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary/15 text-secondary">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-20">
          <div className="rounded-2xl bg-primary px-8 py-14 text-center text-primary-foreground sm:px-16">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Bereit, Ihr nächstes Projekt zu starten?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
              Erstellen Sie kostenlos einen Account und analysieren Sie Ihr erstes Grundstück in unter zwei Minuten.
            </p>
            <Button asChild size="lg" variant="secondary" className="mt-8 h-12 px-7">
              <Link to="/auth">Jetzt loslegen</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} SmarTerra</span>
          <span>Made in Switzerland</span>
        </div>
      </footer>
    </div>
  );
}
