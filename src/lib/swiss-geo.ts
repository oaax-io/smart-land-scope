/** Konvertiert LV95-Koordinaten (E/N) zu WGS84 (lng/lat). Offizielle swisstopo-Näherungsformel. */
export function lv95ToWgs84(e: number, n: number): { lng: number; lat: number } {
  const y = (e - 2600000) / 1000000;
  const x = (n - 1200000) / 1000000;

  const lat =
    16.9023892 +
    3.238272 * x -
    0.270978 * y ** 2 -
    0.002528 * x ** 2 -
    0.0447 * y ** 2 * x -
    0.0140 * x ** 3;

  const lng =
    2.6779094 +
    4.728982 * y +
    0.791484 * y * x +
    0.1306 * y * x ** 2 -
    0.0436 * y ** 3;

  return {
    lat: (lat * 100) / 36,
    lng: (lng * 100) / 36,
  };
}

/** Konvertiert WGS84 (lng/lat) zu LV95 (E/N). Offizielle swisstopo-Näherungsformel (Umkehrung). */
export function wgs84ToLv95(lng: number, lat: number): { e: number; n: number } {
  const latSec = (lat * 3600 - 169028.66) / 10000;
  const lngSec = (lng * 3600 - 26782.5) / 10000;

  const e =
    2600072.37 +
    211455.93 * lngSec -
    10938.51 * lngSec * latSec -
    0.36 * lngSec * latSec ** 2 -
    44.54 * lngSec ** 3;

  const n =
    1200147.07 +
    308807.95 * latSec +
    3745.25 * lngSec ** 2 +
    76.63 * latSec ** 2 -
    194.56 * lngSec ** 2 * latSec +
    119.79 * latSec ** 3;

  return { e, n };
}

export type SwissGeoSearchResult = {
  label: string;
  featureId: string | null;
  lat: number;
  lng: number;
  zoomLevel: number;
  origin: string;
  /** Aus dem Suchergebnis geparste Adresse (falls verfügbar) — verlässlicher als die spätere GWR-Rückwärtssuche. */
  address: string | null;
  postalCode: string | null;
  municipality: string | null;
};

/** Zerlegt swisstopo-Label wie "Rothenburgstrasse 33 <b>6020 Emmenbrücke</b>" in Adresse / PLZ / Ort. */
function parseSwisstopoAddressLabel(rawLabel: string, origin: string): {
  address: string | null;
  postalCode: string | null;
  municipality: string | null;
} {
  const plain = rawLabel.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  if (origin !== "address") {
    return { address: null, postalCode: null, municipality: null };
  }
  const m = plain.match(/^(.*?)\s+(\d{4})\s+(.+?)$/);
  if (!m) return { address: plain || null, postalCode: null, municipality: null };
  return {
    address: m[1].trim() || null,
    postalCode: m[2],
    municipality: m[3].trim() || null,
  };
}

export async function searchSwissLocation(query: string): Promise<SwissGeoSearchResult[]> {
  if (query.trim().length < 2) return [];
  const url = new URL("https://api3.geo.admin.ch/rest/services/api/SearchServer");
  url.searchParams.set("searchText", query);
  url.searchParams.set("type", "locations");
  url.searchParams.set("origins", "address,gg25,parcel");
  url.searchParams.set("limit", "8");
  url.searchParams.set("sr", "2056");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Adresssuche fehlgeschlagen");
  const json = await res.json();

  return (json.results ?? []).map((r: any) => {
    const lat = typeof r.attrs.lat === "number" ? r.attrs.lat : null;
    const lng = typeof r.attrs.lon === "number" ? r.attrs.lon : null;
    const origin = r.attrs.origin ?? "";
    const parsed = parseSwisstopoAddressLabel(r.attrs.label ?? "", origin);
    return {
      label: r.attrs.label,
      featureId: r.attrs.featureId ?? null,
      lat: lat ?? lv95ToWgs84(r.attrs.y, r.attrs.x).lat,
      lng: lng ?? lv95ToWgs84(r.attrs.y, r.attrs.x).lng,
      zoomLevel: r.attrs.zoomlevel ?? 16,
      origin,
      address: parsed.address,
      postalCode: parsed.postalCode,
      municipality: parsed.municipality,
    };
  });
}

export type SwissParcelInfo = {
  address: string | null;
  postalCode: string | null;
  parcelNumber: string | null;
  egrid: string | null;
  municipality: string | null;
  canton: string | null;
  areaM2: number | null;
  zone: string | null;
  geometry: { type: "Polygon"; coordinates: number[][][] } | null;
};

/** Wandelt Esri-JSON-Polygon-Rings (LV95) in GeoJSON-Polygon-Koordinaten (WGS84) um. */
export function esriRingsToGeoJsonCoordinates(rings: number[][][]): number[][][] {
  return rings.map((ring) =>
    ring.map(([x, y]) => {
      const { lng, lat } = lv95ToWgs84(x, y);
      return [lng, lat];
    }),
  );
}

let _warnedAttrs = false;

/**
 * Liest aus den Attributen des swisstopo-Layers `ch.are.bauzonen` eine
 * lesbare Zonen-Bezeichnung. Die harmonisierte Bundes-Karte verwendet
 * `ch_bez_d` (DE-Label, z. B. "Wohnzonen") und `ch_code_hn` (numerischer
 * Hauptklassen-Code). Die früheren Feldnamen (`ch_bezeichnung`, `kt_klasse`)
 * existieren in der API nicht.
 */
const BAUZONE_HN_LABEL: Record<string, string> = {
  "11": "Wohnzonen",
  "12": "Arbeitszonen",
  "13": "Mischzonen",
  "14": "Zonen für öffentliche Nutzungen",
  "15": "eingeschränkte Bauzonen",
  "16": "Tourismus- und Freizeitzonen",
  "17": "Verkehrszonen innerhalb der Bauzonen",
  "19": "weitere Bauzonen",
};

function extractBauzone(attrs: any): string | null {
  if (!attrs) return null;
  const label =
    cleanString(attrs.ch_bez_d) ??
    cleanString(attrs.ch_bez_f) ??
    cleanString(attrs.ch_bez_i) ??
    null;
  if (label) return label;
  const code = cleanString(attrs.ch_code_hn);
  if (code && BAUZONE_HN_LABEL[code]) return BAUZONE_HN_LABEL[code];
  return null;
}

async function identifyAt(
  layers: string,
  lng: number,
  lat: number,
  tolerance = 2,
  opts: { returnGeometry?: boolean; signal?: AbortSignal } = {},
) {
  const { e, n } = wgs84ToLv95(lng, lat);
  const mapExtent = [e - 500, n - 500, e + 500, n + 500].join(",");
  const url = new URL("https://api3.geo.admin.ch/rest/services/api/MapServer/identify");
  url.searchParams.set("geometry", `${e},${n}`);
  url.searchParams.set("geometryType", "esriGeometryPoint");
  url.searchParams.set("layers", layers);
  url.searchParams.set("tolerance", String(tolerance));
  url.searchParams.set("mapExtent", mapExtent);
  url.searchParams.set("imageDisplay", "500,500,96");
  url.searchParams.set("sr", "2056");
  url.searchParams.set("returnGeometry", opts.returnGeometry ? "true" : "false");
  const res = await fetch(url.toString(), { signal: opts.signal });
  if (!res.ok) return null;
  const json = await res.json();
  return json.results ?? [];
}

export type ParcelOutline = {
  egrid: string | null;
  parcelNumber: string | null;
  areaM2: number | null;
  municipality: string | null;
  canton: string | null;
  zone: string | null;
  geometry: { type: "Polygon"; coordinates: number[][][] };
};

/** Holt Umriss + Kernattribute einer Parzelle für Hover-Highlighting (schnell, eine Anfrage). */
export async function getParcelOutlineAt(
  lng: number,
  lat: number,
  signal?: AbortSignal,
): Promise<ParcelOutline | null> {
  const results = await identifyAt(
    "all:ch.kantone.cadastralwebmap-farbe,ch.are.bauzonen",
    lng,
    lat,
    2,
    { returnGeometry: true, signal },
  );
  if (!results?.length) return null;

  const parcelFeature =
    results.find((r: any) => r.layerBodId === "ch.kantone.cadastralwebmap-farbe") ??
    results[0];
  if (!parcelFeature?.geometry?.rings) return null;

  const rings: number[][][] = parcelFeature.geometry.rings;
  const coords = esriRingsToGeoJsonCoordinates(rings);

  const pa = parcelFeature.attributes ?? {};

  const zoneFeature = results.find((r: any) => r.layerBodId === "ch.are.bauzonen");
  const zone = extractBauzone(zoneFeature?.attributes);

  return {
    egrid: cleanString(pa.egris_egrid ?? pa.egrid) ?? null,
    parcelNumber: cleanString(pa.number ?? pa.parcel_number) ?? null,
    areaM2: typeof pa.area === "number" ? pa.area : null,
    municipality: cleanString(pa.municipality_name) ?? null,
    canton: normalizeCanton(pa.ak ?? pa.canton_abbreviation ?? pa.canton),
    zone,
    geometry: { type: "Polygon", coordinates: coords },
  };
}



const CANTON_NAME_TO_CODE: Record<string, string> = {
  aargau: "AG", "appenzell innerrhoden": "AI", "appenzell ausserrhoden": "AR",
  bern: "BE", "basel-landschaft": "BL", "basel-stadt": "BS",
  freiburg: "FR", fribourg: "FR", genf: "GE", geneve: "GE", "genève": "GE",
  glarus: "GL", graubünden: "GR", graubunden: "GR", grisons: "GR",
  jura: "JU", luzern: "LU", lucerne: "LU",
  neuenburg: "NE", "neuchâtel": "NE", neuchatel: "NE",
  nidwalden: "NW", obwalden: "OW", "st. gallen": "SG", "sankt gallen": "SG",
  schaffhausen: "SH", solothurn: "SO", schwyz: "SZ",
  thurgau: "TG", tessin: "TI", ticino: "TI",
  uri: "UR", waadt: "VD", vaud: "VD",
  wallis: "VS", valais: "VS", zug: "ZG", zürich: "ZH", zurich: "ZH",
};

function normalizeCanton(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (v.length === 2 && /^[A-Za-z]{2}$/.test(v)) return v.toUpperCase();
  return CANTON_NAME_TO_CODE[v.toLowerCase()] ?? null;
}

function cleanString(value: unknown): string | null {
  if (value == null) return null;
  const str = Array.isArray(value) ? value[0] : value;
  const cleaned = String(str).trim();
  return cleaned || null;
}

function normalizePostalCode(value: unknown): string | null {
  const raw = cleanString(value);
  return raw?.match(/\b\d{4}\b/)?.[0] ?? null;
}

export async function identifyParcelAt(
  lng: number,
  lat: number,
  overrides?: { address?: string | null; postalCode?: string | null; municipality?: string | null },
): Promise<SwissParcelInfo | null> {
  // 1) Parzelle aus Cadastralwebmap — Geometrie gleich mitholen, damit wir die
  //    Fläche auch dann ableiten können, wenn das Attribut `area` nicht geliefert wird.
  const parcelResults = await identifyAt("all:ch.kantone.cadastralwebmap-farbe", lng, lat, 2, {
    returnGeometry: true,
  });
  const feature = parcelResults?.[0];
  const attrs = feature?.attributes ?? {};
  let parcelNumber: string | null = cleanString(attrs.number ?? attrs.parcel_number);
  let egrid: string | null = cleanString(attrs.egris_egrid ?? attrs.egrid);
  let municipality: string | null = cleanString(attrs.municipality_name);
  let canton: string | null = normalizeCanton(attrs.ak ?? attrs.canton_abbreviation ?? attrs.canton);

  const rings: number[][][] | undefined = feature?.geometry?.rings;
  let areaM2: number | null =
    typeof attrs.area === "number"
      ? attrs.area
      : typeof attrs.flaeche === "number"
        ? attrs.flaeche
        : null;
  if (areaM2 == null && rings) {
    const computed = lv95RingsAreaM2(rings);
    if (computed > 0) areaM2 = Math.round(computed);
  }

  // 2) Adresse — Overrides aus der Suche haben Vorrang (verlässlicher als GWR-Nachbar-Lookup),
  //    sonst nächstgelegene Gebäudeadresse mit enger Toleranz.
  const overrideAddress = cleanString(overrides?.address);
  const overridePostal = normalizePostalCode(overrides?.postalCode);
  const overrideMunicipality = cleanString(overrides?.municipality);

  let address: string | null = overrideAddress;
  let postalCode: string | null = overridePostal;

  if (!address || !postalCode || !municipality || !canton || !parcelNumber || !egrid) {
    const addressResults = await identifyAt("all:ch.bfs.gebaeude_wohnungs_register", lng, lat, 5);
    const addressAttrs = addressResults?.[0]?.attributes ?? {};
    const streetName = cleanString(addressAttrs.strname);
    const houseNumber = cleanString(addressAttrs.deinr);
    const composedAddress = [streetName, houseNumber].filter(Boolean).join(" ").trim();
    address = address ?? cleanString(addressAttrs.strname_deinr) ?? (composedAddress || null);
    postalCode = postalCode ?? normalizePostalCode(addressAttrs.dplz4 ?? addressAttrs.plz_plz6);
    municipality = municipality ?? cleanString(addressAttrs.ggdename ?? addressAttrs.dplzname);
    canton = canton ?? normalizeCanton(addressAttrs.gdekt ?? addressAttrs.kanton);
    parcelNumber = parcelNumber ?? cleanString(addressAttrs.lparz);
    egrid = egrid ?? cleanString(addressAttrs.egrid);
  }

  municipality = municipality ?? overrideMunicipality;

  // 3) Fallback: Gemeinde- und Kantons-Grenzen (immer abfragen, wenn etwas fehlt)
  if (!municipality || !canton) {
    const boundaryResults = await identifyAt(
      "all:ch.swisstopo.swissboundaries3d-gemeinde-flaeche.fill,ch.swisstopo.swissboundaries3d-kanton-flaeche.fill",
      lng,
      lat,
    );
    const orderedBoundaryResults = [
      ...(boundaryResults ?? []).filter((r: any) => r.attributes?.is_current_jahr === true),
      ...(boundaryResults ?? []).filter((r: any) => r.attributes?.is_current_jahr !== true),
    ];
    for (const r of orderedBoundaryResults) {
      const a = r.attributes ?? {};
      if (!municipality) {
        municipality = a.gemname ?? a.bez ?? a.name ?? municipality;
      }
      if (!canton) {
        canton = normalizeCanton(a.kanton ?? a.ktname ?? a.abbreviation ?? a.name);
      }
    }
  }

  // 4) Amtliche Bauzone (ch.are.bauzonen) — harmonisierte Bundes-Karte, liefert
  //    nur die Hauptkategorie ("Wohnzonen", "Arbeitszonen", …), nicht den
  //    lokalen Code (W2/W3). Reicht als Hinweis für die KI-Auswertung.
  let zone: string | null = null;
  try {
    const zoneResults = await identifyAt("all:ch.are.bauzonen", lng, lat, 2);
    zone = extractBauzone(zoneResults?.[0]?.attributes);
  } catch {
    zone = null;
  }

  if (!parcelNumber && !egrid && !municipality && !canton && !address && !postalCode && !_warnedAttrs) {
    _warnedAttrs = true;
    console.warn("Unbekannte Attribut-Struktur", attrs);
  }

  if (!parcelNumber && !egrid && !municipality && !canton && !address && !postalCode) return null;

  const geometry = rings
    ? { type: "Polygon" as const, coordinates: esriRingsToGeoJsonCoordinates(rings) }
    : null;

  return {
    address,
    postalCode,
    parcelNumber,
    egrid,
    municipality,
    canton,
    areaM2,
    zone,
    geometry,
  };
}

/**
 * Fläche eines Esri-Rings in LV95 (Meter) via Shoelace-Formel.
 * Erster Ring = äußere Hülle, weitere Ringe = Löcher (werden subtrahiert).
 */
function lv95RingsAreaM2(rings: number[][][]): number {
  if (!rings.length) return 0;
  const ringArea = (ring: number[][]) => {
    let sum = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      sum += xj * yi - xi * yj;
    }
    return Math.abs(sum) / 2;
  };
  const [outer, ...holes] = rings;
  return ringArea(outer) - holes.reduce((acc, h) => acc + ringArea(h), 0);
}


export type OEREBTopic = {
  theme: string;
  type: string | null;
  coverage: string | null;
  area_m2: number | null;
  legal_basis: string | null;
  authority: string | null;
};

/**
 * Liest ÖREB-nahe Themen (Bauzonen, Projektierungszonen Eisenbahn, Sicherheitszonen
 * Luftfahrt, amtliche Vermessung) an einem Punkt vom swisstopo-Identify-Endpoint.
 * Wird aktuell serverseitig aufgerufen (oereb.functions.ts), funktioniert aber
 * isomorph.
 */
export async function fetchOEREBTopics(lat: number, lng: number): Promise<OEREBTopic[]> {
  const layers = [
    "ch.kantone.cadastralwebmap-farbe",
    "ch.are.bauzonen",
    "ch.bav.sachplan-eisenbahn_anlagen-projektierungszonen",
    "ch.bazl.sachplan-infrastruktur-luftfahrt_anlagen",
  ].join(",");

  let results: any[] | null = null;
  try {
    results = await identifyAt(`all:${layers}`, lng, lat, 2, { returnGeometry: false });
  } catch {
    results = null;
  }
  if (!results?.length) return [];

  const topics: OEREBTopic[] = [];

  for (const r of results) {
    const a = r.attributes ?? {};
    const layerId: string = r.layerBodId ?? "";

    if (layerId === "ch.are.bauzonen") {
      topics.push({
        theme: "Zonenplan (Bauzonen Bund)",
        type: extractBauzone(a),
        coverage: null,
        area_m2: null,
        legal_basis: "RPG / kantonales PBG",
        authority: "Bundesamt für Raumentwicklung (ARE)",
      });
    } else if (layerId === "ch.kantone.cadastralwebmap-farbe") {
      topics.push({
        theme: "Amtliche Vermessung",
        type: `Parzelle ${cleanString(a.number ?? a.parcel_number) ?? "—"}`,
        coverage: "100%",
        area_m2: typeof a.area === "number" ? a.area : null,
        legal_basis: null,
        authority: "Kanton / Gemeinde",
      });
    } else if (layerId === "ch.bav.sachplan-eisenbahn_anlagen-projektierungszonen") {
      topics.push({
        theme: "Projektierungszone Eisenbahn",
        type: cleanString(a.name ?? a.beschreibung ?? a.bezeichnung) ?? "Vorhanden",
        coverage: null,
        area_m2: null,
        legal_basis: cleanString(a.link_rechtsvorschrift) ?? null,
        authority: "Bundesamt für Verkehr (BAV)",
      });
    } else if (layerId === "ch.bazl.sachplan-infrastruktur-luftfahrt_anlagen") {
      topics.push({
        theme: "Sicherheitszone Luftfahrt",
        type: cleanString(a.name ?? a.beschreibung ?? a.bezeichnung) ?? "Vorhanden",
        coverage: null,
        area_m2: null,
        legal_basis: null,
        authority: "Bundesamt für Zivilluftfahrt (BAZL)",
      });
    }
  }

  return topics;
}

// ============================================================================
// Kanton Luzern — offizieller Zonenplan (ZPGNDNTZ_V1_PY)
// Quelle: Raumdatenpool Kanton Luzern, Open-By-Lizenz, täglich aktualisiert.
// ============================================================================

const LU_ZONTYP_KT: Record<number, string> = {
  1100: "Wohnzone", 1200: "Wohnzone", 1300: "Wohnzone", 1400: "Wohnzone",
  1500: "Wohnzone", 1600: "Wohnzone", 1900: "Wohnzone",
  2100: "Kern-/Dorfzone", 2150: "Kern-/Dorfzone", 2200: "Kern-/Dorfzone",
  2250: "Kern-/Dorfzone", 2300: "Kern-/Dorfzone", 2350: "Kern-/Dorfzone", 2400: "Kern-/Dorfzone",
  2500: "Zentrumszone", 2550: "Zentrumszone", 2600: "Zentrumszone",
  2650: "Zentrumszone", 2700: "Zentrumszone", 2750: "Zentrumszone", 2800: "Zentrumszone",
  3100: "Mischzone", 3200: "Mischzone", 3300: "Mischzone",
  3400: "Mischzone", 3500: "Mischzone", 3600: "Mischzone", 3900: "Mischzone",
  4100: "Arbeitszone", 4150: "Arbeitszone", 4200: "Arbeitszone",
  4250: "Arbeitszone", 4300: "Arbeitszone", 4350: "Arbeitszone",
  4400: "Arbeitszone", 4500: "Arbeitszone", 4550: "Arbeitszone",
  4600: "Arbeitszone", 4650: "Arbeitszone", 4700: "Arbeitszone", 4750: "Arbeitszone", 4800: "Arbeitszone",
  5100: "Zone für öffentliche Zwecke", 5200: "Sport-/Freizeitzone",
  5300: "Grünzone", 5400: "Sonderbauzone", 6000: "Landwirtschaftszone",
  6100: "Freihaltezone", 6200: "Reservezone", 6850: "Wald",
  6900: "Naturschutzzone",
};

const LU_LAERMEMPF: Record<number, string> = {
  1: "ES I", 2: "ES II", 3: "ES III", 4: "ES IV", 97: "nicht definiert",
};

const LU_BAUWEISE: Record<number, string> = {
  1: "offen", 2: "geschlossen", 3: "keine Bebauung", 99: "unbekannt",
};

export type LuZoneOverlay = {
  label: string;
  legalStatus: string | null;
  bzrArticle: string | null;
  validFrom: string | null;
};

export type LuZonePlanResult = {
  /** Kurzcode der Gemeinde (z.B. "W3") — falls hinterlegt. */
  zoneCode: string | null;
  /** Kantonale Bezeichnung (z.B. "Wohnzone bis 14m"). */
  zoneLabel: string | null;
  /** Bezeichnung der Gemeinde (z.B. "3-geschossige Wohnzone"). */
  zoneMunicipalityLabel: string | null;
  /** Kategorie nach kantonalem PBG (z.B. "Wohnzone"). */
  zoneCategory: string | null;
  /** Rechtsstatus (z.B. "in Kraft"). */
  legalStatus: string | null;

  // --- PBG NEU (Überbauungsziffer / Gebäudehöhen) ---
  uezMax: number | null;
  uezMin: number | null;
  heightMax: number | null;
  heightMin: number | null;
  facadeHeightMax: number | null;
  facadeHeightMin: number | null;
  eavesHeight: number | null;
  buildingLength: number | null;
  buildingWidth: number | null;
  greenAreaRatio: number | null;

  // --- PBG ALT (Ausnützungsziffer / Geschosszahl) ---
  az: number | null;
  floors: number | null;

  // --- Nutzungsanteile ---
  residentialShareMax: number | null;
  residentialShareMin: number | null;
  commercialShareMax: number | null;
  commercialShareMin: number | null;

  // --- Allgemein ---
  noiseClass: string | null;
  buildingType: string | null;
  bzrArticle: string | null;
  bzrFurther: string | null;
  validFrom: string | null;

  /** Überlagernde Festsetzungen (Lärm-Aufstufung, Ortsbildschutz, Gestaltungspläne, …). */
  overlays: LuZoneOverlay[];

  geometry: { type: "Polygon"; coordinates: number[][][] } | null;
  source: "lu_wfs";
};

export function luZonePlanToRegulationRecord(zone: LuZonePlanResult): Record<string, unknown> {
  return {
    source: zone.source,
    source_label: "Amtlicher Zonenplan Kanton Luzern (ZONPLANX_COL_V3_MP)",
    code: zone.zoneCode,
    name: zone.zoneMunicipalityLabel ?? zone.zoneLabel,
    zone_label: zone.zoneLabel,
    zone_municipality_label: zone.zoneMunicipalityLabel,
    zone_category: zone.zoneCategory,
    legal_status: zone.legalStatus,
    utilization_ratio: zone.az,
    building_coverage_ratio: zone.uezMax,
    building_coverage_ratio_min: zone.uezMin,
    max_floors: zone.floors,
    max_height_m: zone.heightMax,
    min_height_m: zone.heightMin,
    max_facade_height_m: zone.facadeHeightMax,
    min_facade_height_m: zone.facadeHeightMin,
    eaves_height_m: zone.eavesHeight,
    max_building_length_m: zone.buildingLength,
    max_building_width_m: zone.buildingWidth,
    open_space_ratio: zone.greenAreaRatio,
    residential_share_max: zone.residentialShareMax,
    residential_share_min: zone.residentialShareMin,
    commercial_share_max: zone.commercialShareMax,
    commercial_share_min: zone.commercialShareMin,
    noise_sensitivity: zone.noiseClass,
    building_type: zone.buildingType,
    article_reference: zone.bzrArticle ? `BZR Art. ${zone.bzrArticle}` : null,
    bzr_further: zone.bzrFurther,
    valid_from: zone.validFrom,
    overlays: zone.overlays,
  };
}

/** Liest ein Attribut aus der LU-Antwort — akzeptiert deutsche Langnamen (aktuell) und alte Kurzcodes (fallback). */
function luAttr(attrs: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (k in attrs) return attrs[k];
  }
  return undefined;
}

function luNum(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).trim().replace(",", ".");
  if (!s || s.toLowerCase() === "null") return null;
  const n = Number(s);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

function luStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s.toLowerCase() === "null" || s === "0") return null;
  return s;
}

/** "04.07.1997" → "1997-07-04". */
function luDate(v: unknown): string | null {
  const s = luStr(v);
  if (!s) return null;
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return s;
}

function isLuGrundnutzungResult(result: { layerName?: unknown }): boolean {
  const name = typeof result.layerName === "string" ? result.layerName.toLowerCase() : "";
  return name.includes("grundnutzung") || name.includes("zpgndntz");
}

function isLuInForce(attrs: Record<string, unknown>): boolean {
  const legalStatus = luStr(luAttr(attrs, "Rechtsstatus", "RECHTSTAT"));
  const legalCode = Number(luAttr(attrs, "RECHTSTAT"));
  if (legalStatus) return /kraft/i.test(legalStatus);
  if (Number.isFinite(legalCode)) return legalCode === 4;
  return true;
}

function luRegulationValueScore(attrs: Record<string, unknown>): number {
  const metricKeys = [
    ["Überbauungsziffer 1 (maximal)", "UEZ1_MAX"],
    ["Überbauungsziffer 1 (minimal)", "UEZ1_MIN"],
    ["Ausnützungsziffer (nach altem PBG)", "AZ"],
    ["Geschosszahl (nach altem PBG)", "GESCHOSSZAHL"],
    ["Gesamthöhe (maximal) [m]", "GESHOE_MAX"],
    ["Fassadenhöhe (maximal) [m]", "FAHOE_MAX"],
    ["Gebäudelänge [m]", "GEBLAENGE"],
    ["Gebäudebreite [m]", "GEBBREITE"],
    ["Grünflächenziffer", "GRUENFLZI"],
  ];
  const metricScore = metricKeys.reduce((score, keys) => score + (luNum(luAttr(attrs, ...keys)) != null ? 10 : 0), 0);
  const label = [
    luStr(luAttr(attrs, "Zonentyp Kanton", "ZONTYP_KT_BEZ")),
    luStr(luAttr(attrs, "Bezeichnung Zonentyp Gemeinde", "ZONTYP_BEZ")),
    luStr(luAttr(attrs, "Zonentyp Planungs- und Baugesetz")),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const genericPenalty = /übriges gebiet|uebriges gebiet|reserve|freihalte|wald|gewässer|gewaesser/.test(label) ? -5 : 0;
  return metricScore + genericPenalty;
}

/**
 * Fragt den offiziellen Luzerner Zonenplan (ZONPLANX_COL_V3_MP) per WGS84-Koordinate ab.
 * Liefert Grundnutzung + Überlagerungen. Nur für Kanton LU sinnvoll.
 */
export async function queryLuZonePlan(lat: number, lng: number): Promise<LuZonePlanResult | null> {
  const url = new URL(
    "https://public.geo.lu.ch/ogd/rest/services/managed/ZONPLANX_COL_V3_MP/MapServer/identify",
  );
  url.searchParams.set("f", "json");
  url.searchParams.set("geometry", `${lng},${lat}`);
  url.searchParams.set("geometryType", "esriGeometryPoint");
  url.searchParams.set("sr", "4326");
  url.searchParams.set("layers", "all");
  url.searchParams.set("tolerance", "1");
  url.searchParams.set("mapExtent", `${lng - 0.005},${lat - 0.005},${lng + 0.005},${lat + 0.005}`);
  url.searchParams.set("imageDisplay", "500,500,96");
  url.searchParams.set("returnGeometry", "true");

  let res: Response;
  try {
    res = await fetch(url.toString());
    if (!res.ok) return null;
  } catch {
    return null;
  }

  const json = await res.json().catch(() => null);
  if (!json?.results?.length) return null;

  // Grundnutzung = Basisfeature. Die LU-Identify-Antwort kann mehrere
  // Grundnutzungen liefern; wir bevorzugen die rechtskräftige Zone mit den
  // tatsächlich ausgefüllten Bauparametern statt generischer "Übriges Gebiet"-Treffer.
  const results = json.results as any[];
  const baseCandidates = results
    .filter(isLuGrundnutzungResult)
    .filter((r) => isLuInForce(r.attributes ?? {}));
  const base =
    [...baseCandidates].sort(
      (left, right) => luRegulationValueScore(right.attributes ?? {}) - luRegulationValueScore(left.attributes ?? {}),
    )[0] ?? results[0];
  if (!base) return null;

  const a: Record<string, unknown> = base.attributes ?? {};

  // Nur "in Kraft" berücksichtigen — akzeptiert deutschen Text und alten Zahlencode 4.
  const legalStatus = luStr(luAttr(a, "Rechtsstatus", "RECHTSTAT"));
  const legalCode = Number(luAttr(a, "RECHTSTAT"));
  if (legalStatus && !/kraft/i.test(legalStatus)) return null;
  if (!legalStatus && Number.isFinite(legalCode) && legalCode !== 4) return null;

  let geometry: LuZonePlanResult["geometry"] = null;
  if (base.geometry?.rings) {
    const rings: number[][][] = base.geometry.rings;
    const firstCoord = rings[0]?.[0];
    if (firstCoord) {
      geometry =
        Math.abs(firstCoord[0]) < 180
          ? { type: "Polygon", coordinates: rings }
          : { type: "Polygon", coordinates: esriRingsToGeoJsonCoordinates(rings) };
    }
  }

  const overlays: LuZoneOverlay[] = results
    .filter((r) => r !== base && !isLuGrundnutzungResult(r))
    .map((r) => {
      const oa: Record<string, unknown> = r.attributes ?? {};
      const label =
        luStr(luAttr(oa, "Zonentyp Kanton", "ZONTYP_KT_BEZ")) ??
        luStr(luAttr(oa, "Bezeichnung Zonentyp Gemeinde", "ZONTYP_BEZ")) ??
        luStr(r.value) ??
        luStr(r.layerName) ??
        "Überlagerung";
      return {
        label,
        legalStatus: luStr(luAttr(oa, "Rechtsstatus", "RECHTSTAT")),
        bzrArticle: luStr(luAttr(oa, "Artikel im BZR", "BZR_ARTIKEL")),
        validFrom: luDate(luAttr(oa, "Inkraftsetzungsdatum", "DATEOFVALID")),
      };
    })
    .filter((o) => {
      if (!o.legalStatus) return true;
      return /kraft/i.test(o.legalStatus);
    });

  return {
    zoneCode:
      luStr(luAttr(a, "Abkürzung Zonentyp Gemeinde", "ZONTYP_ABK")) ??
      luStr(luAttr(a, "Zonentyp Gemeinde")),
    zoneLabel:
      luStr(luAttr(a, "Zonentyp Kanton", "ZONTYP_KT_BEZ")) ??
      luStr(luAttr(a, "Zonentyp Planungs- und Baugesetz")),
    zoneMunicipalityLabel: luStr(luAttr(a, "Bezeichnung Zonentyp Gemeinde", "ZONTYP_BEZ")),
    zoneCategory:
      luStr(luAttr(a, "Zonentyp Planungs- und Baugesetz")) ??
      LU_ZONTYP_KT[Number(luAttr(a, "ZONTYP_KT"))] ??
      null,
    legalStatus,

    uezMax: luNum(luAttr(a, "Überbauungsziffer 1 (maximal)", "UEZ1_MAX")),
    uezMin: luNum(luAttr(a, "Überbauungsziffer 1 (minimal)", "UEZ1_MIN")),
    heightMax: luNum(luAttr(a, "Gesamthöhe (maximal) [m]", "GESHOE_MAX")),
    heightMin: luNum(luAttr(a, "Gesamthöhe (minimal) [m]", "GESHOE_MIN")),
    facadeHeightMax: luNum(luAttr(a, "Fassadenhöhe (maximal) [m]", "FAHOE_MAX")),
    facadeHeightMin: luNum(luAttr(a, "Fassadenhöhe (minimal) [m]")),
    eavesHeight: luNum(luAttr(a, "Traufhöhe [m]")),
    buildingLength: luNum(luAttr(a, "Gebäudelänge [m]", "GEBLAENGE")),
    buildingWidth: luNum(luAttr(a, "Gebäudebreite [m]", "GEBBREITE")),
    greenAreaRatio: luNum(luAttr(a, "Grünflächenziffer", "GRUENFLZI")),

    az: luNum(luAttr(a, "Ausnützungsziffer (nach altem PBG)", "AZ")),
    floors: luNum(luAttr(a, "Geschosszahl (nach altem PBG)", "GESCHOSSZAHL")),

    residentialShareMax: luNum(luAttr(a, "Wohnanteil (maximal)", "WOHANT_MAX")),
    residentialShareMin: luNum(luAttr(a, "Wohnanteil (minimal)")),
    commercialShareMax: luNum(luAttr(a, "Arbeitsanteil (maximal)", "ARBANT_MAX")),
    commercialShareMin: luNum(luAttr(a, "Arbeitsanteil (minimal)")),

    noiseClass:
      luStr(luAttr(a, "Lärmempfindlichkeitsstufe (ES)")) ??
      LU_LAERMEMPF[Number(luAttr(a, "LAERMEMPF"))] ??
      null,
    buildingType: (() => {
      const s = luStr(luAttr(a, "Bauweise"));
      if (s && s.toLowerCase() !== "unbekannt") return s;
      return LU_BAUWEISE[Number(luAttr(a, "BAUWEISE"))] ?? null;
    })(),
    bzrArticle: luStr(luAttr(a, "Artikel im BZR", "BZR_ARTIKEL")),
    bzrFurther: luStr(luAttr(a, "Weitere Bestimmungen im BZR", "BZR_WEITERE")),
    validFrom: luDate(luAttr(a, "Inkraftsetzungsdatum", "DATEOFVALID")),

    overlays,
    geometry,
    source: "lu_wfs",
  };
}



