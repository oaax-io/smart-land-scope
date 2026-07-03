import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import Map, {
  Marker,
  NavigationControl,
  Source,
  Layer,
  type MapRef,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import * as turf from "@turf/turf";
import { MapPin, Search, Loader2, Maximize2, Locate } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  searchSwissLocation,
  identifyParcelAt,
  getParcelOutlineAt,
  type SwissGeoSearchResult,
  type SwissParcelInfo,
  type ParcelOutline,
} from "@/lib/swiss-geo";
import {
  CANTONS,
  CANTON_BY_CODE,
  CANTON_COLOR_MATCH,
  CANTONS_GEOJSON_URL,
  bboxOfGeometry,
  unionBbox,
  type LngLatBounds,
} from "@/lib/swiss-cantons";

// swisstopo WMTS — Kartenstile
function buildMapStyle(
  base: "cadastral" | "aerial",
  showLuZones = false,
  showLuBaulinien = false,
  showLuGefahren = false,
) {
  const baseTiles =
    base === "aerial"
      ? "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg"
      : "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-grau/default/current/3857/{z}/{x}/{y}.jpeg";

  const sources: Record<string, any> = {
    "swisstopo-base": {
      type: "raster" as const,
      tiles: [baseTiles],
      tileSize: 256,
      attribution: "© swisstopo",
      maxzoom: 18,
    },
    "swisstopo-cadastral": {
      type: "raster" as const,
      tiles: [
        "https://wmts.geo.admin.ch/1.0.0/ch.kantone.cadastralwebmap-farbe/default/current/3857/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© swisstopo / Kantone (Amtliche Vermessung)",
      maxzoom: 19,
    },
  };

  const layers: any[] = [
    { id: "base-layer", type: "raster" as const, source: "swisstopo-base" },
    { id: "cadastral-layer", type: "raster" as const, source: "swisstopo-cadastral" },
  ];

  if (showLuZones) {
    sources["lu-zones"] = {
      type: "raster" as const,
      tiles: [
        "https://public.geo.lu.ch/ogd/services/managed/ZONPLANX_COL_V3_MP/MapServer/WMSServer?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&BBOX={bbox-epsg-3857}&CRS=EPSG:3857&WIDTH=256&HEIGHT=256&LAYERS=ZPGNDNTZ_V1_PY&STYLES=&FORMAT=image/png&TRANSPARENT=TRUE",
      ],
      tileSize: 256,
      attribution: "© Raumdatenpool Kanton Luzern (Open-By)",
    };
    layers.push({
      id: "lu-zones-layer",
      type: "raster" as const,
      source: "lu-zones",
      paint: { "raster-opacity": 0.45 },
    });
  }

  if (showLuBaulinien) {
    sources["lu-baulinien"] = {
      type: "raster" as const,
      tiles: [
        "https://public.geo.lu.ch/ogd/services/managed/ZONPLANX_COL_V3_MP/MapServer/WMSServer?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&BBOX={bbox-epsg-3857}&CRS=EPSG:3857&WIDTH=256&HEIGHT=256&LAYERS=ZPBAULIN_V1_LI&STYLES=&FORMAT=image/png&TRANSPARENT=TRUE",
      ],
      tileSize: 256,
      attribution: "© Raumdatenpool Kanton Luzern",
    };
    layers.push({
      id: "lu-baulinien-layer",
      type: "raster" as const,
      source: "lu-baulinien",
      paint: { "raster-opacity": 0.8 },
    });
  }

  if (showLuGefahren) {
    sources["lu-gefahren"] = {
      type: "raster" as const,
      tiles: [
        "https://public.geo.lu.ch/ogd/services/managed/ZONPLANX_COL_V3_MP/MapServer/WMSServer?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&BBOX={bbox-epsg-3857}&CRS=EPSG:3857&WIDTH=256&HEIGHT=256&LAYERS=ZPNATGEF_V1_PY&STYLES=&FORMAT=image/png&TRANSPARENT=TRUE",
      ],
      tileSize: 256,
      attribution: "© Raumdatenpool Kanton Luzern",
    };
    layers.push({
      id: "lu-gefahren-layer",
      type: "raster" as const,
      source: "lu-gefahren",
      paint: { "raster-opacity": 0.55 },
    });
  }

  return { version: 8 as const, sources, layers };
}



const DEFAULT_VIEW = { longitude: 8.2275, latitude: 46.8182, zoom: 7 };

type SwissMapProps = {
  mode: "interactive" | "readonly";
  lat?: number | null;
  lng?: number | null;
  onParcelSelected?: (data: {
    lat: number;
    lng: number;
    address: string | null;
    postalCode: string | null;
    municipality: string | null;
    canton: string | null;
    parcelNumber: string | null;
    egrid: string | null;
    areaM2: number | null;
    zone: string | null;
    geometry: { type: "Polygon"; coordinates: number[][][] } | null;
  }) => void;
  className?: string;
  heightClassName?: string;
  allowExpand?: boolean;
  floatingSearch?: boolean;
  /** Show coloured cantons overlay and Kanton filter (bottom-right). */
  showCantons?: boolean;
  /** Bereits gespeicherte Parzellen-Geometrie (aus der Datenbank) — für die readonly-Detailansicht. */
  parcelGeometry?: { type: "Polygon"; coordinates: number[][][] } | null;
  /** Grenzabstände in Metern, für die vereinfachte Baufeld-Berechnung. */
  setbacks?: { nord?: number | null; ost?: number | null; sued?: number | null; west?: number | null } | null;
  /** Wenn true, kann ein zusätzlicher LU-Zonenplan-Layer eingeblendet werden. */
  luZonesAvailable?: boolean;
  /** Kantonskürzel der aktuellen Auswahl (aktiviert LU-spezifische Layer). */
  canton?: string;
};



type CantonFeature = {
  type: "Feature";
  geometry: { type: string; coordinates: unknown };
  properties: { KANTONSNUM: number; NAME: string };
};
type CantonFC = { type: "FeatureCollection"; features: CantonFeature[] };

export function SwissMap({
  mode,
  lat,
  lng,
  onParcelSelected,
  className,
  heightClassName = "h-80",
  allowExpand = true,
  floatingSearch = false,
  showCantons = false,
  parcelGeometry = null,
  setbacks = null,
  luZonesAvailable = false,
  canton,
}: SwissMapProps) {
  // LU-Zonenplan-Toggle sichtbar wenn explizit erlaubt, wenn Auswahl im Kanton LU liegt,
  // oder wenn die Karte interaktiv ist und noch kein Kanton bekannt ist.
  const luToggleVisible =
    luZonesAvailable || canton === "LU" || (mode === "interactive" && !canton);

  const [expanded, setExpanded] = useState(false);
  const [baseLayer, setBaseLayer] = useState<"cadastral" | "aerial">("cadastral");
  const [showLuZones, setShowLuZones] = useState(false);

  const mapStyle = useMemo(
    () => buildMapStyle(baseLayer, luToggleVisible && showLuZones),
    [baseLayer, luToggleVisible, showLuZones],
  );

  const mapRef = useRef<MapRef | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SwissGeoSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(
    lat != null && lng != null ? { lat, lng } : null,
  );

  const [viewState, setViewState] = useState(
    lat != null && lng != null
      ? { longitude: lng, latitude: lat, zoom: 16 }
      : DEFAULT_VIEW,
  );

  // Canton overlay state
  const [cantonsData, setCantonsData] = useState<CantonFC | null>(null);
  const [cantonFilter, setCantonFilter] = useState<string>("all"); // "all" or canton code

  useEffect(() => {
    if (!showCantons) return;
    let cancelled = false;
    fetch(CANTONS_GEOJSON_URL)
      .then((r) => r.json())
      .then((d: CantonFC) => {
        if (!cancelled) setCantonsData(d);
      })
      .catch((e) => console.error("Kantone konnten nicht geladen werden", e));
    return () => {
      cancelled = true;
    };
  }, [showCantons]);

  // Bounds of selected canton (union of all its parts)
  const filteredBounds = useMemo<LngLatBounds | null>(() => {
    if (cantonFilter === "all" || !cantonsData) return null;
    const info = CANTON_BY_CODE.get(cantonFilter);
    if (!info) return null;
    let bounds: LngLatBounds | null = null;
    for (const f of cantonsData.features) {
      if (f.properties.KANTONSNUM !== info.num) continue;
      const bb = bboxOfGeometry(f.geometry);
      if (!bb) continue;
      bounds = bounds ? unionBbox(bounds, bb) : bb;
    }
    return bounds;
  }, [cantonFilter, cantonsData]);

  // Auto-fit when filter changes
  useEffect(() => {
    if (!filteredBounds || !mapRef.current) return;
    mapRef.current.fitBounds(filteredBounds, {
      padding: 48,
      duration: 800,
      maxZoom: 11,
    });
  }, [filteredBounds]);

  const runSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await searchSwissLocation(q);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  async function resolveParcelAt(
    lat: number,
    lng: number,
    fallbackAddress: string | null,
  ) {
    setIdentifying(true);
    try {
      const parcel: SwissParcelInfo | null = await identifyParcelAt(lng, lat);
      onParcelSelected?.({
        lat,
        lng,
        address: parcel?.address ?? fallbackAddress,
        postalCode: parcel?.postalCode ?? null,
        municipality: parcel?.municipality ?? null,
        canton: parcel?.canton ?? null,
        parcelNumber: parcel?.parcelNumber ?? null,
        egrid: parcel?.egrid ?? null,
        areaM2: parcel?.areaM2 ?? null,
        zone: parcel?.zone ?? null,
        geometry: parcel?.geometry ?? null,
      });
    } catch {
      onParcelSelected?.({
        lat,
        lng,
        address: fallbackAddress,
        postalCode: null,
        municipality: null,
        canton: null,
        parcelNumber: null,
        egrid: null,
        areaM2: null,
        zone: null,
        geometry: null,
      });
    } finally {
      setIdentifying(false);
    }
  }

  async function selectSearchResult(r: SwissGeoSearchResult) {
    const cleanLabel = r.label.replace(/<[^>]+>/g, "");
    setSearchResults([]);
    setSearchQuery(cleanLabel);
    setMarker({ lat: r.lat, lng: r.lng });
    setViewState({ longitude: r.lng, latitude: r.lat, zoom: 17 });
    await resolveParcelAt(r.lat, r.lng, cleanLabel);
  }

  async function handleMapClick(e: { lngLat: { lng: number; lat: number } }) {
    if (mode !== "interactive") return;
    const { lng, lat } = e.lngLat;
    setMarker({ lat, lng });
    await resolveParcelAt(lat, lng, null);
  }

  // --- Parzellen-Hover (gedrosselt, nur ab Zoom 16.5) ---
  const [hoverParcel, setHoverParcel] = useState<ParcelOutline | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const hoverTimer = useRef<number | null>(null);
  const hoverAbort = useRef<AbortController | null>(null);
  const lastHoverKey = useRef<string | null>(null);

  const handleMapMouseMove = useCallback(
    (e: { lngLat: { lng: number; lat: number }; point: { x: number; y: number } }) => {
      if (mode !== "interactive") return;
      const zoom = mapRef.current?.getMap().getZoom() ?? 0;
      if (zoom < 16.5) {
        if (hoverParcel) setHoverParcel(null);
        setHoverPos(null);
        return;
      }
      setHoverPos({ x: e.point.x, y: e.point.y });
      const { lng, lat } = e.lngLat;
      if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
      hoverTimer.current = window.setTimeout(async () => {
        const key = `${lng.toFixed(4)}|${lat.toFixed(4)}`;
        if (key === lastHoverKey.current) return;
        lastHoverKey.current = key;
        hoverAbort.current?.abort();
        const ctrl = new AbortController();
        hoverAbort.current = ctrl;
        try {
          const outline = await getParcelOutlineAt(lng, lat, ctrl.signal);
          if (ctrl.signal.aborted) return;
          setHoverParcel(outline);
        } catch {
          /* ignored */
        }
      }, 110);
    },
    [mode, hoverParcel],
  );

  const handleMapMouseLeave = useCallback(() => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverAbort.current?.abort();
    lastHoverKey.current = null;
    setHoverParcel(null);
    setHoverPos(null);
  }, []);

  useEffect(
    () => () => {
      if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
      hoverAbort.current?.abort();
    },
    [],
  );

  const hoverFC = useMemo(
    () =>
      hoverParcel
        ? {
            type: "FeatureCollection" as const,
            features: [
              {
                type: "Feature" as const,
                properties: {},
                geometry: hoverParcel.geometry,
              },
            ],
          }
        : null,
    [hoverParcel],
  );

  const selectedParcelFC = useMemo(
    () =>
      parcelGeometry
        ? {
            type: "FeatureCollection" as const,
            features: [{ type: "Feature" as const, properties: {}, geometry: parcelGeometry }],
          }
        : null,
    [parcelGeometry],
  );

  const buildableField = useMemo(() => {
    if (!parcelGeometry || !setbacks) return null;
    const values = [setbacks.nord, setbacks.ost, setbacks.sued, setbacks.west]
      .filter((v): v is number => typeof v === "number" && v > 0);
    if (values.length === 0) return null;
    const minSetback = Math.min(...values);
    try {
      const feature = { type: "Feature" as const, properties: {}, geometry: parcelGeometry };
      const buffered = turf.buffer(feature, -minSetback, { units: "meters" });
      if (!buffered || buffered.geometry.type !== "Polygon") return null;
      return { type: "FeatureCollection" as const, features: [buffered] };
    } catch {
      return null;
    }
  }, [parcelGeometry, setbacks]);


  const searchBox = mode === "interactive" && (
    <div className={cn("relative", floatingSearch && "w-full max-w-md")}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Adresse, Ort oder Parzelle suchen …"
        value={searchQuery}
        onChange={(e) => runSearch(e.target.value)}
        className={cn("pl-9", floatingSearch && "h-11 bg-background/95 shadow-lg backdrop-blur")}
      />
      {searching && (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
      {searchResults.length > 0 && (
        <Card className="absolute z-20 mt-1 max-h-72 w-full overflow-auto p-1 shadow-lg">
          {searchResults.map((r, i) => (
            <button
              key={`${r.featureId ?? i}-${i}`}
              type="button"
              className="block w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent"
              onClick={() => selectSearchResult(r)}
              dangerouslySetInnerHTML={{ __html: r.label }}
            />
          ))}
        </Card>
      )}
    </div>
  );

  // Maplibre expressions for the canton overlay.
  // When a canton is selected, that canton is shown at higher opacity,
  // the rest is dimmed (lower opacity + dark tint).
  const selectedNum = cantonFilter !== "all" ? CANTON_BY_CODE.get(cantonFilter)?.num : null;

  // Beim Hineinzoomen das Kanton-Overlay ausblenden, damit der Fokus auf
  // der Parzelle liegt und keine flächige Einfärbung über der Stadt liegt.
  // Vollständig sichtbar bis Zoom 11, linear ausblenden bis Zoom 14.
  const fadeStops = (full: number) => [
    "interpolate",
    ["linear"],
    ["zoom"],
    11, full,
    14, 0,
  ];

  const cantonFillColor: any = ["match", ["get", "KANTONSNUM"], ...CANTON_COLOR_MATCH, "#999999"];
  const cantonFillOpacity: any =
    selectedNum != null
      ? ["case", ["==", ["get", "KANTONSNUM"], selectedNum], fadeStops(0.45), fadeStops(0.18)]
      : fadeStops(0.28);
  const cantonLineColor: any =
    selectedNum != null
      ? [
          "case",
          ["==", ["get", "KANTONSNUM"], selectedNum],
          "#111111",
          "rgba(60,60,60,0.6)",
        ]
      : "rgba(40,40,40,0.7)";
  const cantonLineWidth: any =
    selectedNum != null
      ? ["case", ["==", ["get", "KANTONSNUM"], selectedNum], 2.5, 0.6]
      : 0.8;
  // Dim overlay for non-selected cantons (auch ausblenden beim Zoomen)
  const dimOpacity: any =
    selectedNum != null
      ? ["case", ["==", ["get", "KANTONSNUM"], selectedNum], 0, fadeStops(0.35)]
      : 0;


  return (
    <div className={cn(floatingSearch ? "relative h-full w-full" : "space-y-2", className)}>
      {!floatingSearch && searchBox}

      <div className={cn("relative overflow-hidden border", !floatingSearch && "rounded-md", heightClassName)}>
        {floatingSearch && searchBox && (
          <div className="absolute left-1/2 top-3 z-20 w-[min(90%,28rem)] -translate-x-1/2">
            {searchBox}
          </div>
        )}
        <Map
          ref={mapRef}
          {...viewState}
          onMove={(evt) => setViewState(evt.viewState)}
          onClick={handleMapClick}
          onMouseMove={handleMapMouseMove}
          onMouseOut={handleMapMouseLeave}
          mapStyle={buildMapStyle(
            baseLayer,
            luToggleVisible && showLuZones,
            canton === "LU" && showLuBaulinien,
            canton === "LU" && showLuGefahren,
          ) as any}
          cursor={mode === "interactive" ? (hoverParcel ? "pointer" : "crosshair") : "default"}
          attributionControl={{ compact: true }}
          style={{ width: "100%", height: "100%" }}
        >
          <NavigationControl position="top-right" showCompass={false} />

          {hoverFC && (
            <Source id="parcel-hover" type="geojson" data={hoverFC as any}>
              <Layer
                id="parcel-hover-fill"
                type="fill"
                paint={{
                  "fill-color": "#fde047",
                  "fill-opacity": 0.28,
                }}
              />
              <Layer
                id="parcel-hover-line"
                type="line"
                paint={{
                  "line-color": "#f59e0b",
                  "line-width": 2.5,
                }}
              />
            </Source>
          )}


          {showCantons && cantonsData && (
            <Source id="cantons" type="geojson" data={cantonsData as any}>
              <Layer
                id="cantons-fill"
                type="fill"
                paint={{
                  "fill-color": cantonFillColor,
                  "fill-opacity": cantonFillOpacity,
                }}
              />
              <Layer
                id="cantons-dim"
                type="fill"
                paint={{
                  "fill-color": "#0b0f17",
                  "fill-opacity": dimOpacity,
                }}
              />
              <Layer
                id="cantons-line"
                type="line"
                paint={{
                  "line-color": cantonLineColor,
                  "line-width": cantonLineWidth,
                }}
              />
            </Source>
          )}

          {selectedParcelFC && (
            <Source id="parcel-selected" type="geojson" data={selectedParcelFC as any}>
              <Layer
                id="parcel-selected-line"
                type="line"
                paint={{ "line-color": "#0ea5e9", "line-width": 2.5 }}
              />
            </Source>
          )}
          {buildableField && (
            <Source id="buildable-field" type="geojson" data={buildableField as any}>
              <Layer
                id="buildable-field-fill"
                type="fill"
                paint={{ "fill-color": "#10b981", "fill-opacity": 0.25 }}
              />
              <Layer
                id="buildable-field-line"
                type="line"
                paint={{ "line-color": "#059669", "line-width": 2, "line-dasharray": [2, 2] }}
              />
            </Source>
          )}


          {marker && (
            <Marker longitude={marker.lng} latitude={marker.lat} anchor="bottom">
              <MapPin className="h-7 w-7 fill-primary text-primary-foreground drop-shadow" />
            </Marker>
          )}
        </Map>

        {/* Hover-Tooltip mit Parzellen-Daten */}
        {hoverParcel && hoverPos && (
          <div
            className="pointer-events-none absolute z-20 min-w-[200px] max-w-[260px] rounded-md border bg-background/95 px-3 py-2 text-xs shadow-lg backdrop-blur"
            style={{
              left: Math.min(hoverPos.x + 14, (mapRef.current?.getMap().getContainer().clientWidth ?? 9999) - 270),
              top: Math.min(hoverPos.y + 14, (mapRef.current?.getMap().getContainer().clientHeight ?? 9999) - 140),
            }}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="font-semibold">
                {hoverParcel.parcelNumber ? `Parzelle ${hoverParcel.parcelNumber}` : "Parzelle"}
              </span>
              {hoverParcel.canton && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                  {hoverParcel.canton}
                </span>
              )}
            </div>
            <dl className="space-y-0.5 text-muted-foreground">
              {hoverParcel.areaM2 != null && (
                <div className="flex justify-between gap-3">
                  <dt>Fläche</dt>
                  <dd className="font-medium text-foreground">
                    {Math.round(hoverParcel.areaM2).toLocaleString("de-CH")} m²
                  </dd>
                </div>
              )}
              {hoverParcel.municipality && (
                <div className="flex justify-between gap-3">
                  <dt>Gemeinde</dt>
                  <dd className="truncate text-foreground" title={hoverParcel.municipality}>
                    {hoverParcel.municipality}
                  </dd>
                </div>
              )}
              {hoverParcel.zone && (
                <div className="flex justify-between gap-3">
                  <dt title="Aus dem harmonisierten Bundes-Bauzonen-Layer (ch.are.bauzonen). Die gemeindespezifische Zone laut BZR kann abweichen.">Bauzone (Bund)</dt>
                  <dd className="truncate text-foreground" title={hoverParcel.zone}>
                    {hoverParcel.zone}
                  </dd>
                </div>
              )}
              {hoverParcel.egrid && (
                <div className="flex justify-between gap-3">
                  <dt>E-GRID</dt>
                  <dd className="truncate font-mono text-[10px] text-foreground" title={hoverParcel.egrid}>
                    {hoverParcel.egrid}
                  </dd>
                </div>
              )}
            </dl>
            <p className="mt-1.5 border-t pt-1 text-[10px] italic text-muted-foreground">
              Geschosse &amp; Ausnützung → in der Vollanalyse aus dem Reglement
            </p>
          </div>
        )}



        {/* Layer-Umschalter */}
        <div className="absolute left-2 top-2 z-10 flex overflow-hidden rounded-md border bg-background/95 shadow-sm backdrop-blur">
          <button
            type="button"
            onClick={() => setBaseLayer("cadastral")}
            className={cn(
              "px-2.5 py-1 text-xs font-medium transition-colors",
              baseLayer === "cadastral" ? "bg-primary text-primary-foreground" : "hover:bg-accent",
            )}
          >
            Parzellen
          </button>
          <button
            type="button"
            onClick={() => setBaseLayer("aerial")}
            className={cn(
              "px-2.5 py-1 text-xs font-medium transition-colors border-l",
              baseLayer === "aerial" ? "bg-primary text-primary-foreground" : "hover:bg-accent",
            )}
          >
            Luftbild
          </button>
          {luToggleVisible && (
            <button
              type="button"
              onClick={() => setShowLuZones((v) => !v)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium transition-colors border-l",
                showLuZones ? "bg-primary text-primary-foreground" : "hover:bg-accent",
              )}
              title="Zonenplan Kanton Luzern"
            >
              Zonen LU
            </button>
          )}
          {canton === "LU" && (
            <>
              <button
                type="button"
                onClick={() => setShowLuBaulinien((v) => !v)}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium transition-colors border-l",
                  showLuBaulinien ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
                title="Baulinien Kanton Luzern"
              >
                Baulinien
              </button>
              <button
                type="button"
                onClick={() => setShowLuGefahren((v) => !v)}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium transition-colors border-l",
                  showLuGefahren ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
                title="Naturgefahren Kanton Luzern"
              >
                Gefahren
              </button>
            </>
          )}
        </div>


        {/* Kanton-Filter unten links */}
        {showCantons && (
          <div className="absolute left-2 bottom-8 z-10 rounded-md border bg-background/95 shadow-sm backdrop-blur">

            <div className="flex items-center gap-2 px-2 py-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Kanton
              </span>
              <Select value={cantonFilter} onValueChange={setCantonFilter}>
                <SelectTrigger className="h-8 w-[180px] border-0 bg-transparent px-2 text-sm focus:ring-0">
                  <SelectValue placeholder="Alle Kantone" />
                </SelectTrigger>
                <SelectContent align="start" side="top" className="max-h-80">
                  <SelectItem value="all">
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm bg-muted-foreground/40" />
                      Alle Kantone
                    </span>
                  </SelectItem>
                  {CANTONS.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-sm"
                          style={{ backgroundColor: c.color }}
                        />
                        {c.code} — {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Aktionen rechts oben (unter NavigationControl) */}
        {allowExpand && (
          <div className="absolute right-2 bottom-8 z-10 flex flex-col gap-1">
            <Dialog open={expanded} onOpenChange={setExpanded}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8 shadow-sm"
                  title="Karte vergrössern"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-6xl p-4">
                <DialogHeader>
                  <DialogTitle>Karte — swisstopo</DialogTitle>
                </DialogHeader>
                <SwissMap
                  mode={mode}
                  lat={marker?.lat ?? lat}
                  lng={marker?.lng ?? lng}
                  onParcelSelected={(d) => {
                    setMarker({ lat: d.lat, lng: d.lng });
                    setViewState((v) => ({ ...v, longitude: d.lng, latitude: d.lat }));
                    onParcelSelected?.(d);
                  }}
                  heightClassName="h-[75vh]"
                  allowExpand={false}
                  showCantons={showCantons}
                  parcelGeometry={parcelGeometry}
                  setbacks={setbacks}
                />
              </DialogContent>
            </Dialog>
            {marker && (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="h-8 w-8 shadow-sm"
                title="Auf Markierung zentrieren"
                onClick={() =>
                  setViewState((v) => ({
                    ...v,
                    longitude: marker.lng,
                    latitude: marker.lat,
                    zoom: Math.max(v.zoom, 17),
                  }))
                }
              >
                <Locate className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {buildableField && (
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-sky-500" />
            Parzellengrenze
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-4 rounded-sm border border-emerald-600 bg-emerald-500/25" />
            Indikatives Baufeld (kleinster bekannter Grenzabstand)
          </span>
        </div>
      )}



      {mode === "interactive" && (
        <p className="text-xs text-muted-foreground">
          {identifying
            ? "Parzelle wird ermittelt …"
            : "Adresse suchen — Parzelle, Gemeinde und Kanton werden automatisch erkannt. Sie können auch direkt in die Karte klicken."}
        </p>
      )}
    </div>
  );
}
