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
    const { lat, lng } = lv95ToWgs84(r.attrs.x, r.attrs.y);
    return {
      label: r.attrs.label,
      featureId: r.attrs.featureId ?? null,
      lat,
      lng,
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
  geometry: GeoJSON.Geometry | null;
};

let _warnedAttrs = false;

export async function identifyParcelAt(lng: number, lat: number): Promise<SwissParcelInfo | null> {
  const { e, n } = wgs84ToLv95(lng, lat);
  const tolerance = 2;
  const mapExtent = [e - 500, n - 500, e + 500, n + 500].join(",");
  const imageDisplay = "500,500,96";

  const url = new URL("https://api3.geo.admin.ch/rest/services/api/MapServer/identify");
  url.searchParams.set("geometry", `${e},${n}`);
  url.searchParams.set("geometryType", "esriGeometryPoint");
  url.searchParams.set("layers", "all:ch.kantone.cadastralwebmap");
  url.searchParams.set("tolerance", String(tolerance));
  url.searchParams.set("mapExtent", mapExtent);
  url.searchParams.set("imageDisplay", imageDisplay);
  url.searchParams.set("sr", "2056");
  url.searchParams.set("returnGeometry", "true");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Parzellen-Identifikation fehlgeschlagen");
  const json = await res.json();

  const feature = json.results?.[0];
  if (!feature) return null;

  const attrs = feature.attributes ?? {};
  const parcelNumber = attrs.number ?? attrs.parcel_number ?? null;
  const egrid = attrs.egris_egrid ?? attrs.egrid ?? null;
  const municipality = attrs.municipality_name ?? null;
  const canton = attrs.canton_abbreviation ?? null;
  const areaM2 = attrs.area ?? null;

  if (!parcelNumber && !egrid && !municipality && !_warnedAttrs) {
    _warnedAttrs = true;
    console.warn("Unbekannte Attribut-Struktur", attrs);
  }

  return {
    parcelNumber,
    egrid,
    municipality,
    canton,
    areaM2,
    geometry: feature.geometry ?? null,
  };
}
