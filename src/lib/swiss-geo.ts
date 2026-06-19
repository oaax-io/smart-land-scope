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
};

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
    // swisstopo SearchServer liefert lat/lon direkt als WGS84 – verlässlicher als x/y,
    // weil dort in LV95 die Reihenfolge x=North/y=East vertauscht ist.
    const lat = typeof r.attrs.lat === "number" ? r.attrs.lat : null;
    const lng = typeof r.attrs.lon === "number" ? r.attrs.lon : null;
    return {
      label: r.attrs.label,
      featureId: r.attrs.featureId ?? null,
      lat: lat ?? lv95ToWgs84(r.attrs.y, r.attrs.x).lat,
      lng: lng ?? lv95ToWgs84(r.attrs.y, r.attrs.x).lng,
      zoomLevel: r.attrs.zoomlevel ?? 16,
      origin: r.attrs.origin,
    };
  });
}

export type SwissParcelInfo = {
  parcelNumber: string | null;
  egrid: string | null;
  municipality: string | null;
  canton: string | null;
  areaM2: number | null;
  geometry: unknown | null;
};

let _warnedAttrs = false;

async function identifyAt(layers: string, lng: number, lat: number) {
  const { e, n } = wgs84ToLv95(lng, lat);
  const tolerance = 2;
  const mapExtent = [e - 500, n - 500, e + 500, n + 500].join(",");
  const url = new URL("https://api3.geo.admin.ch/rest/services/api/MapServer/identify");
  url.searchParams.set("geometry", `${e},${n}`);
  url.searchParams.set("geometryType", "esriGeometryPoint");
  url.searchParams.set("layers", layers);
  url.searchParams.set("tolerance", String(tolerance));
  url.searchParams.set("mapExtent", mapExtent);
  url.searchParams.set("imageDisplay", "500,500,96");
  url.searchParams.set("sr", "2056");
  url.searchParams.set("returnGeometry", "false");
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const json = await res.json();
  return json.results ?? [];
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

export async function identifyParcelAt(lng: number, lat: number): Promise<SwissParcelInfo | null> {
  // 1) Parzelle aus Cadastralwebmap
  const parcelResults = await identifyAt("all:ch.kantone.cadastralwebmap", lng, lat);
  const feature = parcelResults?.[0];
  const attrs = feature?.attributes ?? {};
  let parcelNumber: string | null = attrs.number ?? attrs.parcel_number ?? null;
  let egrid: string | null = attrs.egris_egrid ?? attrs.egrid ?? null;
  let municipality: string | null = attrs.municipality_name ?? null;
  let canton: string | null = normalizeCanton(attrs.canton_abbreviation ?? attrs.canton);
  const areaM2: number | null = attrs.area ?? null;

  // 2) Fallback: Gemeinde- und Kantons-Grenzen (immer abfragen, wenn etwas fehlt)
  if (!municipality || !canton) {
    const boundaryResults = await identifyAt(
      "all:ch.swisstopo.swissboundaries3d-gemeinde-flaeche.fill,ch.swisstopo.swissboundaries3d-kanton-flaeche.fill",
      lng,
      lat,
    );
    for (const r of boundaryResults ?? []) {
      const a = r.attributes ?? {};
      if (!municipality) {
        municipality = a.gemname ?? a.bez ?? a.name ?? municipality;
      }
      if (!canton) {
        canton = normalizeCanton(a.kanton ?? a.ktname ?? a.abbreviation ?? a.name);
      }
    }
  }

  if (!parcelNumber && !egrid && !municipality && !canton && !_warnedAttrs) {
    _warnedAttrs = true;
    console.warn("Unbekannte Attribut-Struktur", attrs);
  }

  if (!parcelNumber && !egrid && !municipality && !canton) return null;

  return {
    parcelNumber,
    egrid,
    municipality,
    canton,
    areaM2,
    geometry: feature?.geometry ?? null,
  };
}

