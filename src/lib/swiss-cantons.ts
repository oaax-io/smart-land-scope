// Mapping swisstopo KANTONSNUM → ISO 2-letter canton code + German name.
// Used by the canton overlay/filter on the map.

export type CantonInfo = { num: number; code: string; name: string; color: string };

// Distinct, soft palette — designed to remain readable over the swisstopo
// cadastral raster (mostly green/grey). 26 hand-tuned hues.
export const CANTONS: CantonInfo[] = [
  { num: 1,  code: "ZH", name: "Zürich",                  color: "#2563eb" },
  { num: 2,  code: "BE", name: "Bern",                    color: "#dc2626" },
  { num: 3,  code: "LU", name: "Luzern",                  color: "#0ea5e9" },
  { num: 4,  code: "UR", name: "Uri",                     color: "#facc15" },
  { num: 5,  code: "SZ", name: "Schwyz",                  color: "#ef4444" },
  { num: 6,  code: "OW", name: "Obwalden",                color: "#f97316" },
  { num: 7,  code: "NW", name: "Nidwalden",               color: "#fb923c" },
  { num: 8,  code: "GL", name: "Glarus",                  color: "#a16207" },
  { num: 9,  code: "ZG", name: "Zug",                     color: "#0891b2" },
  { num: 10, code: "FR", name: "Freiburg",                color: "#1e3a8a" },
  { num: 11, code: "SO", name: "Solothurn",               color: "#b91c1c" },
  { num: 12, code: "BS", name: "Basel-Stadt",             color: "#7c3aed" },
  { num: 13, code: "BL", name: "Basel-Landschaft",        color: "#a855f7" },
  { num: 14, code: "SH", name: "Schaffhausen",            color: "#facc15" },
  { num: 15, code: "AR", name: "Appenzell Ausserrhoden",  color: "#0d9488" },
  { num: 16, code: "AI", name: "Appenzell Innerrhoden",   color: "#14b8a6" },
  { num: 17, code: "SG", name: "St. Gallen",              color: "#16a34a" },
  { num: 18, code: "GR", name: "Graubünden",              color: "#65a30d" },
  { num: 19, code: "AG", name: "Aargau",                  color: "#0284c7" },
  { num: 20, code: "TG", name: "Thurgau",                 color: "#84cc16" },
  { num: 21, code: "TI", name: "Tessin",                  color: "#e11d48" },
  { num: 22, code: "VD", name: "Waadt",                   color: "#10b981" },
  { num: 23, code: "VS", name: "Wallis",                  color: "#d97706" },
  { num: 24, code: "NE", name: "Neuenburg",               color: "#059669" },
  { num: 25, code: "GE", name: "Genf",                    color: "#db2777" },
  { num: 26, code: "JU", name: "Jura",                    color: "#9333ea" },
];

export const CANTON_BY_NUM = new Map(CANTONS.map((c) => [c.num, c]));
export const CANTON_BY_CODE = new Map(CANTONS.map((c) => [c.code, c]));

// Public GeoJSON of cantonal borders (1:25k, ~51 KB), CORS-enabled CDN.
export const CANTONS_GEOJSON_URL =
  "https://cdn.jsdelivr.net/gh/severinlandolt/map-switzerland@main/02%20GeoJSON/CH_Kantonsgrenzen_025_geo.json";

// Flat [num, color, num, color, ...] for a Maplibre `match` expression.
export const CANTON_COLOR_MATCH = CANTONS.flatMap((c) => [c.num, c.color]);

export type LngLatBounds = [[number, number], [number, number]];

export function unionBbox(a: LngLatBounds, b: LngLatBounds): LngLatBounds {
  return [
    [Math.min(a[0][0], b[0][0]), Math.min(a[0][1], b[0][1])],
    [Math.max(a[1][0], b[1][0]), Math.max(a[1][1], b[1][1])],
  ];
}

function walkCoords(
  coords: unknown,
  cb: (lng: number, lat: number) => void,
): void {
  if (
    Array.isArray(coords) &&
    coords.length >= 2 &&
    typeof coords[0] === "number" &&
    typeof coords[1] === "number"
  ) {
    cb(coords[0] as number, coords[1] as number);
    return;
  }
  if (Array.isArray(coords)) {
    for (const c of coords) walkCoords(c, cb);
  }
}

export function bboxOfGeometry(
  geometry: { coordinates: unknown } | null | undefined,
): LngLatBounds | null {
  if (!geometry) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  walkCoords(geometry.coordinates, (x, y) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  });
  if (!isFinite(minX)) return null;
  return [
    [minX, minY],
    [maxX, maxY],
  ];
}
