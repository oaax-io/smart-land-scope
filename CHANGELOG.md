# Changelog

Alle nennenswerten Änderungen an SmarTerra werden hier dokumentiert.
Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## [Unreleased]

### Hinzugefügt
- **Interaktive Schweizer Karte** (`/analysen/karte`) mit MapLibre + swisstopo-Layern.
- **Kanton-Filter** (unten links auf der Karte): Auswahl eines der 26 Kantone zoomt und hebt den Kanton hervor; alle Kantone bleiben farbig dargestellt.
- **Parzellen-Hover** (ab Zoom 16.5): Über den swisstopo Identify-Endpoint wird der Polygonumriss der Parzelle unter dem Cursor geladen und gelb hervorgehoben (debounced 110 ms, abbrechbar).
- **Parzellen-Tooltip** beim Hover mit: Parzellennummer, Kanton, Fläche (m²), Gemeinde, Bauzone (z. B. W2) und E-GRID. Quelle: `ch.kantone.cadastralwebmap-farbe` + `ch.are.bauzonen`.
- **Quick-Analysis-Modal** im Dashboard: Klick auf eine Adresse öffnet die Analyse-Schritte direkt im Modal; Weiterleitung zur Analyse-Seite erst nach Abschluss aller Schritte.
- **Kantons-Daten** (`src/lib/swiss-cantons.ts`) mit Name, Kürzel, Bounding-Box und Farbe für alle 26 Kantone.

### Geändert
- Kanton-Filter von unten rechts nach **unten links** verschoben; Dropdown öffnet nach oben (`side="top"`).
- Parzellen-Info-Karte auf der Karte von `top-4` auf `top-20` verschoben, damit sie die Zoom-Buttons nicht mehr überlappt.
- `ParcelOutline`-Typ in `src/lib/swiss-geo.ts` um `zone` und `areaM2` erweitert.

### Technisch
- Neue Helfer: `getParcelOutlineAt(lng, lat)` (ESRI LV95 → GeoJSON WGS84).
- Hover-State mit `AbortController` + Standort-Cache (`lastHoverKey`) zur Vermeidung doppelter Requests.

## [0.1.0] — Grundstruktur

Initiale Plattform-Grundlage gemäss `.lovable/plan.md`:
- Multi-Tenant-Datenmodell (organizations, profiles, members, teams, projects, parcels, analyses, reports, subscriptions, invitations, audit_log) mit RLS und `has_role()` SECURITY DEFINER.
- Auth (E-Mail/Passwort + Google vorbereitet), geschützter `_authenticated`-Bereich.
- Sidebar-Shell + Modul-Routen: Dashboard, Analysen, Projekte, Berichte, Team, Einstellungen.
- Design-System (Deep Forest / Sage) auf Tailwind v4 + shadcn/ui.
