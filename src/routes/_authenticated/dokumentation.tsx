import { createFileRoute } from "@tanstack/react-router";
import {
  BookOpen,
  Sparkles,
  History,
  Layers,
  Database,
  Map as MapIcon,
  Brain,
  ShieldCheck,
  FileText,
  MessageSquare,
  Users,
  Rocket,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/_authenticated/dokumentation")({
  head: () => ({ meta: [{ title: "Dokumentation — SmarTerra" }] }),
  component: DocsPage,
});

const APP_VERSION = "1.4.0";
const APP_STAGE = "Beta";

type Change = {
  type: "Neu" | "Verbessert" | "Behoben";
  text: string;
};
type Release = {
  version: string;
  date: string;
  title: string;
  changes: Change[];
};

const RELEASES: Release[] = [
  {
    version: "1.4.0",
    date: "2026-07-03",
    title: "Luzerner Zonenplan & Community-Wissen",
    changes: [
      { type: "Neu", text: "Integration des offiziellen Luzerner Zonenplan-Dienstes (ESRI MapServer): Zone, AZ, ÜZ, Gebäude- und Gesamthöhe sowie Geschosszahl direkt aus der Parzellengeometrie" },
      { type: "Neu", text: "Dashboard-Schnellsuche zeigt bei LU-Parzellen sofort eine Live-Zonenvorschau im Analyse-Wizard" },
      { type: "Neu", text: "Analyse-Detail: Button 'Zonenplan aktualisieren' lädt LU-Geodaten neu und triggert Re-Analyse" },
      { type: "Neu", text: "BZR-Versionsvergleich: altes vs. neues Reglement wird in Analyse-Detail und Bericht als Vergleichskarte dargestellt" },
      { type: "Neu", text: "Community-Grenzabstände: Nutzer erfassen Grenzabstände und Parkplatzwerte pro Zone; verifizierte Werte fliessen in die KI-Analyse" },
      { type: "Neu", text: "Platform-Admin: Coverage-Kachel 'LU Zonenplan' und Moderations-Tabelle für Community-Beiträge" },
      { type: "Verbessert", text: "Karte blendet den WMS-Zonenplan-Overlay kanton-abhängig ein (aktuell Luzern)" },
      { type: "Verbessert", text: "KI-Prompt (analyze-knowledge) nutzt LU-Geodaten und verifizierte Community-Werte als zusätzliche Quelle" },
    ],
  },
  {
    version: "1.3.0",
    date: "2026-06-26",
    title: "Dienstbarkeiten & Grundbuchauszug",
    changes: [
      { type: "Neu", text: "Dienstbarkeiten-Modul: manuelle Erfassung von Dienstbarkeiten, Grundlasten und Pfandrechten pro Analyse" },
      { type: "Neu", text: "KI-Extraktion aus hochgeladenem Grundbuchauszug (PDF/Scan) mit Vertrauenswert pro Eintrag" },
      { type: "Neu", text: "Neues Kapitel 3 'Dienstbarkeiten & Lasten' im Bericht; folgende Kapitel umnummeriert" },
    ],
  },
  {
    version: "1.2.0",
    date: "2026-06-25",
    title: "Professioneller Bericht im Conea-Format",
    changes: [
      { type: "Neu", text: "Druckbare Machbarkeitsstudie mit Titelseite, Inhaltsverzeichnis und Kapiteln 1–9" },
      { type: "Neu", text: "Word-Export inkl. Projektnummer im Dateinamen, A4-Pagination und Seitenumbrüche" },
      { type: "Neu", text: "ÖREB-Kataster-Integration: alle Themen automatisch per EGRID, eigener Tab und Bericht-Kapitel" },
      { type: "Neu", text: "Rechtliche-Grundlagen-Tabelle gruppiert nach Lage, Dichte, Masse, Abstände, Freiräume, Verkehr" },
      { type: "Verbessert", text: "BZR-Extraktion um 11 Kennzahlen erweitert (BMZ, Parkplatzpflicht, Attika-Regeln, Lärmempfindlichkeit, Gewässerabstand u. a.)" },
    ],
  },
  {
    version: "1.1.0",
    date: "2026-06-23",
    title: "Projekt-Workflow & Varianten",
    changes: [
      { type: "Neu", text: "Projektdaten pro Analyse: Projektnummer, Auftraggeber, Projektleiter" },
      { type: "Neu", text: "Parametrischer Geschoss- und Volumenrechner mit automatischer Gesamtfläche und Volumen" },
      { type: "Neu", text: "Wohnungs-Mix-Tabelle und Upload-Slots für Architekten-Zeichnungen (Situation, Grundriss, Schnitt, Fassade)" },
      { type: "Neu", text: "Szenario-Vergleich (Tab 'Varianten') für mehrere Bebauungsoptionen nebeneinander" },
      { type: "Neu", text: "Indikatives Baufeld auf der Analyse-Karte aus amtlicher Parzellengeometrie und Grenzabständen" },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-06-21",
    title: "Wissensbasis-Skalierung & Regionen",
    changes: [
      { type: "Neu", text: "Hintergrund-Jobsystem für BZR-Extraktion (3 Dokumente/Minute) mit Live-Progress" },
      { type: "Neu", text: "Regionen-Admin: Kantone und Gemeinden aktiv/inaktiv schalten" },
      { type: "Neu", text: "Inline-Korrektur KI-extrahierter Reglemente-Werte mit Verifizierungs-Tracking" },
      { type: "Verbessert", text: "Zonenermittlung DB-first: kommunale Zonen schlagen Bundes-Layer; Map-Tooltip 'Bauzone (Bund)'" },
      { type: "Verbessert", text: "BZR-Uploads erfordern 'Gültig ab' und archivieren ältere Versionen automatisch" },
      { type: "Verbessert", text: "Bauzonen-Override pro Analyse mit anschliessender Re-Analyse" },
    ],
  },
  {
    version: "0.9.0",
    date: "2026-06-19",
    title: "Feedback-System, Profil & Dokumentation",
    changes: [
      { type: "Neu", text: "Plattformweites Feedback mit Status, Kommentaren und Screenshot-Upload (Drag & Drop, Strg+V)" },
      { type: "Neu", text: "Profilbild-Upload und Passwort-Änderung in den Einstellungen" },
      { type: "Neu", text: "Topbar zeigt Benutzernamen statt E-Mail-Adresse" },
      { type: "Neu", text: "Dokumentationsseite mit Changelog und Versionshistorie" },
      { type: "Verbessert", text: "Fehler in Dialogen werden direkt im Modal angezeigt" },
    ],
  },

  {
    version: "0.8.0",
    date: "2026-06-18",
    title: "Interaktive Karte & Analyse-Workflow",
    changes: [
      { type: "Neu", text: "Vollbild-Karte der Schweiz mit Suche, Zoom und schwebenden Werkzeugen" },
      { type: "Neu", text: "Klick auf Parzelle öffnet Info-Karte mit Adresse, E-GRID, Gemeinde und Kanton" },
      { type: "Neu", text: "Direktstart einer KI-Analyse aus der Karte heraus" },
      { type: "Verbessert", text: "Adressübernahme bei Klick auf Karte zuverlässiger" },
      { type: "Verbessert", text: "Layer-Umschalter überlappt Zoom-Steuerung nicht mehr" },
    ],
  },
  {
    version: "0.7.0",
    date: "2026-06-15",
    title: "Wohnungspotenzial & Reglement-Auswertung",
    changes: [
      { type: "Neu", text: "Automatische Ermittlung von Zone, Ausnützungsziffer, max. Geschossen aus Reglementen" },
      { type: "Neu", text: "Wohnungspotenzial-Berechnung direkt im Analyse-Ergebnis" },
      { type: "Verbessert", text: "Wohnungsrechner in das Wohnungspotenzial integriert" },
    ],
  },
  {
    version: "0.6.0",
    date: "2026-06-10",
    title: "Wissensdatenbank & Reglemente",
    changes: [
      { type: "Neu", text: "Upload und Extraktion kommunaler Bau- und Zonenreglemente (PDF)" },
      { type: "Neu", text: "Strukturierte Regel-Extraktion pro Zone" },
      { type: "Neu", text: "Wissensdatenbank für Analyse-Kontext" },
    ],
  },
  {
    version: "0.5.0",
    date: "2026-06-01",
    title: "Erste öffentliche Beta",
    changes: [
      { type: "Neu", text: "Benutzer-Authentifizierung mit E-Mail/Passwort und Google" },
      { type: "Neu", text: "Organisationen, Rollen und 14-Tage-Trial" },
      { type: "Neu", text: "Dashboard, Projekte, Berichte" },
    ],
  },
];

const FEATURES = [
  { icon: MapIcon, title: "Schweizweite Karte", desc: "Swisstopo-Layer, Parzellen-Suche und interaktive Auswahl." },
  { icon: Brain, title: "KI-gestützte Analysen", desc: "Automatische Auswertung von Zone, Ausnützung und Wohnungspotenzial." },
  { icon: BookOpen, title: "Reglement-Wissensbasis", desc: "Bau- und Zonenreglemente werden strukturiert extrahiert und durchsuchbar." },
  { icon: FileText, title: "Berichte & Projekte", desc: "Ergebnisse bündeln, dokumentieren und teilen." },
  { icon: MessageSquare, title: "Feedback-Loop", desc: "Anwender können Fehler und Wünsche direkt aus der App melden." },
  { icon: ShieldCheck, title: "Sicherheit", desc: "Row-Level-Security, isolierte Mandanten, sichere Datei-Uploads." },
];

const TECH = [
  { label: "Frontend", value: "React 19, TypeScript, TanStack Router & Query" },
  { label: "UI", value: "Tailwind CSS, shadcn/ui, Radix UI" },
  { label: "Karten", value: "MapLibre GL, swisstopo WMTS, GeoAdmin API" },
  { label: "Backend", value: "Serverless Edge-Funktionen, Postgres mit Row-Level-Security" },
  { label: "Speicher", value: "Objekt-Speicher für Dokumente, Screenshots und Profilbilder" },
  { label: "KI", value: "LLM-basierte Reglement- und Parzellen-Analyse" },
  { label: "Auth", value: "E-Mail/Passwort und Google OAuth" },
];

function changeBadge(t: Change["type"]) {
  if (t === "Neu") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (t === "Verbessert") return "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300";
  return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
}

function DocsPage() {
  const totalChanges = RELEASES.reduce((sum, r) => sum + r.changes.length, 0);
  const newCount = RELEASES.reduce((s, r) => s + r.changes.filter((c) => c.type === "Neu").length, 0);
  const improvedCount = RELEASES.reduce((s, r) => s + r.changes.filter((c) => c.type === "Verbessert").length, 0);
  const fixedCount = RELEASES.reduce((s, r) => s + r.changes.filter((c) => c.type === "Behoben").length, 0);
  const latest = RELEASES[0];
  const firstRelease = RELEASES[RELEASES.length - 1];

  const stats = [
    { label: "Funktionen", value: FEATURES.length, icon: Sparkles },
    { label: "Releases", value: RELEASES.length, icon: Rocket },
    { label: "Updates gesamt", value: totalChanges, icon: History },
    { label: "Technologien", value: TECH.length, icon: Layers },
    { label: "Neue Features", value: newCount, icon: Sparkles },
    { label: "Verbesserungen", value: improvedCount, icon: Brain },
    { label: "Bugfixes", value: fixedCount, icon: ShieldCheck },
    {
      label: "Letztes Update",
      value: new Date(latest.date).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }),
      icon: History,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5" /> Dokumentation
        </div>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">SmarTerra Handbuch</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Funktionen, Technologie und vollständige Versionshistorie der Plattform.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Rocket className="h-3 w-3" /> Version {APP_VERSION}
            </Badge>
            <Badge variant="outline">{APP_STAGE}</Badge>
            <Badge variant="outline" className="text-[10px]">
              seit {new Date(firstRelease.date).toLocaleDateString("de-CH", { month: "short", year: "numeric" })}
            </Badge>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="overflow-hidden">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-secondary/10 text-secondary">
                <s.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="font-display text-xl font-bold leading-none">{s.value}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>


      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <Sparkles className="h-4 w-4 text-secondary" /> Funktionen
          </CardTitle>
          <CardDescription>Was SmarTerra heute kann</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-background">
                <f.icon className="h-4 w-4 text-secondary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium">{f.title}</p>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Technologie */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <Layers className="h-4 w-4 text-secondary" /> Technologie-Stack
          </CardTitle>
          <CardDescription>Womit die Plattform gebaut ist</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="divide-y divide-border">
            {TECH.map((t) => (
              <div key={t.label} className="grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-[160px_1fr] sm:items-center sm:gap-4">
                <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Database className="h-3 w-3" /> {t.label}
                </dt>
                <dd className="text-sm">{t.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* Changelog */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <History className="h-4 w-4 text-secondary" /> Changelog
          </CardTitle>
          <CardDescription>Alle Aktualisierungen mit Datum und Version</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="relative space-y-6 border-l border-border pl-6">
            {RELEASES.map((r, i) => (
              <li key={r.version} className="relative">
                <span className="absolute -left-[31px] top-1 grid h-5 w-5 place-items-center rounded-full border-2 border-background bg-secondary text-secondary-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                </span>
                <div className="flex flex-wrap items-baseline gap-2">
                  <h3 className="font-display text-base font-semibold">v{r.version}</h3>
                  <Badge variant="outline" className="text-[10px]">
                    {new Date(r.date).toLocaleDateString("de-CH", { year: "numeric", month: "long", day: "numeric" })}
                  </Badge>
                  {i === 0 && <Badge className="text-[10px]">Aktuell</Badge>}
                </div>
                <p className="mt-0.5 text-sm font-medium">{r.title}</p>
                <ul className="mt-2 space-y-1.5">
                  {r.changes.map((c, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span className={`mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${changeBadge(c.type)}`}>
                        {c.type}
                      </span>
                      <span className="text-muted-foreground">{c.text}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
          <Separator className="my-6" />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            Vorschläge oder Fehler? Über die Feedback-Seite melden — wir bauen SmarTerra mit unseren Anwendern weiter.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
