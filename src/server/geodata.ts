/**
 * geodata.ts - Adquisición de datos geoespaciales REALES para la cuenca del Río Moche.
 *
 * Fuentes (verificadas, sin API key):
 *   - DEM        : AWS Terrain Tiles "Terrarium" (derivado de SRTM / Copernicus GLO-30 / NED)
 *                  https://registry.opendata.aws/terrain-tiles/
 *   - Hidrografía: OpenStreetMap vía Overpass API (ODbL)
 *   - Clima      : Open-Meteo (modelos operativos + reanálisis)
 *   - Google Maps: se activa automáticamente si existe GOOGLE_MAPS_API_KEY
 *
 * Todo se cachea en disco: el relieve de una cuenca es estático, no tiene sentido
 * volver a descargar decenas de tiles en cada arranque del servidor.
 */

import fs from 'node:fs';
import path from 'node:path';
import { decodePNG } from './pngDecode';

// ----------------------------------------------------------------------------
// Extensión de la cuenca del Río Moche (La Libertad, Perú)
// Cabecera en Quiruvilca (~4000 m s.n.m.) hasta la desembocadura en el Pacífico.
// ----------------------------------------------------------------------------
export const MOCHE_BASIN_BBOX = {
  west: -79.10,
  south: -8.28,
  east: -78.25,
  north: -7.78,
} as const;

export interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

/**
 * Overpass rechaza con HTTP 406 las peticiones sin User-Agent identificable,
 * y su política de uso pide identificar la aplicación. Node fetch no envía uno.
 */
const USER_AGENT =
  'HydroTwin3D/1.0 (Gemelo Digital Cuenca Rio Moche; investigacion academica UNT)';

const CACHE_DIR = path.resolve(process.cwd(), '.cache', 'geodata');

function readCache<T>(key: string, maxAgeMs: number): T | null {
  try {
    const file = path.join(CACHE_DIR, `${key}.json`);
    const stat = fs.statSync(file);
    if (Date.now() - stat.mtimeMs > maxAgeMs) return null;
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: unknown) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(path.join(CACHE_DIR, `${key}.json`), JSON.stringify(value));
  } catch (err) {
    console.warn('[GEODATA] No se pudo escribir caché:', (err as Error).message);
  }
}

// ----------------------------------------------------------------------------
// Proyección Web Mercator
// ----------------------------------------------------------------------------
export function lonToTileX(lon: number, z: number): number {
  return ((lon + 180) / 360) * Math.pow(2, z);
}

export function latToTileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z);
}

/** Metros por grado a una latitud dada (aproximación WGS84). */
export function metersPerDegree(lat: number) {
  const rad = (lat * Math.PI) / 180;
  return { lon: 111320 * Math.cos(rad), lat: 110574 };
}

/** Ejecuta tareas con límite de concurrencia, para no saturar el endpoint remoto. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

// ----------------------------------------------------------------------------
// DEM: descarga de tiles, mosaico y remuestreo
// ----------------------------------------------------------------------------
const TILE_SIZE = 256;

async function fetchTile(z: number, x: number, y: number): Promise<Float32Array | null> {
  const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const png = decodePNG(Buffer.from(await res.arrayBuffer()));
    const { data, channels, width, height } = png;
    const elev = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const r = data[i * channels];
      const g = data[i * channels + 1];
      const b = data[i * channels + 2];
      // Codificación Terrarium: (R * 256 + G + B / 256) - 32768
      elev[i] = r * 256 + g + b / 256 - 32768;
    }
    return elev;
  } catch (err) {
    console.warn(`[GEODATA] Tile ${z}/${x}/${y} falló:`, (err as Error).message);
    return null;
  }
}

export interface DEMGrid {
  width: number;
  height: number;
  bbox: BBox;
  /** Elevaciones en metros. Fila 0 = borde norte. Longitud = width * height. */
  elevations: number[];
  minElevation: number;
  maxElevation: number;
  /** Dimensiones reales del terreno, en metros. */
  spanMetersX: number;
  spanMetersY: number;
  zoom: number;
  source: string;
  attribution: string;
  tilesRequested: number;
  tilesResolved: number;
}

export async function fetchBasinDEM(
  bbox: BBox = MOCHE_BASIN_BBOX,
  zoom = 12,
  gridWidth = 480
): Promise<DEMGrid> {
  const cacheKey = `dem-z${zoom}-w${gridWidth}-${bbox.west}_${bbox.south}_${bbox.east}_${bbox.north}`;
  const cached = readCache<DEMGrid>(cacheKey, 1000 * 60 * 60 * 24 * 90);
  if (cached) {
    console.log('[GEODATA] DEM servido desde caché en disco');
    return cached;
  }

  const minTx = Math.floor(lonToTileX(bbox.west, zoom));
  const maxTx = Math.floor(lonToTileX(bbox.east, zoom));
  const minTy = Math.floor(latToTileY(bbox.north, zoom)); // el norte es la Y menor
  const maxTy = Math.floor(latToTileY(bbox.south, zoom));

  const coords: Array<{ x: number; y: number }> = [];
  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) coords.push({ x: tx, y: ty });
  }

  console.log(`[GEODATA] Descargando DEM real: ${coords.length} tiles Terrarium z${zoom}...`);
  const started = Date.now();
  const tiles = await mapLimit(coords, 8, c => fetchTile(zoom, c.x, c.y));
  const resolved = tiles.filter(Boolean).length;
  console.log(
    `[GEODATA] DEM: ${resolved}/${coords.length} tiles en ${((Date.now() - started) / 1000).toFixed(1)}s`
  );

  if (resolved === 0) throw new Error('No se pudo descargar ningún tile de elevación');

  // Mosaico alineado a tiles
  const tilesX = maxTx - minTx + 1;
  const tilesY = maxTy - minTy + 1;
  const mosaicW = tilesX * TILE_SIZE;
  const mosaicH = tilesY * TILE_SIZE;
  const mosaic = new Float32Array(mosaicW * mosaicH);

  tiles.forEach((tile, i) => {
    if (!tile) return;
    const ox = (coords[i].x - minTx) * TILE_SIZE;
    const oy = (coords[i].y - minTy) * TILE_SIZE;
    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        mosaic[(oy + y) * mosaicW + ox + x] = tile[y * TILE_SIZE + x];
      }
    }
  });

  // Remuestreo bilineal a la grilla de salida, en espacio de tiles
  const mpd = metersPerDegree((bbox.north + bbox.south) / 2);
  const spanMetersX = (bbox.east - bbox.west) * mpd.lon;
  const spanMetersY = (bbox.north - bbox.south) * mpd.lat;
  const gridHeight = Math.max(2, Math.round(gridWidth * (spanMetersY / spanMetersX)));

  const elevations = new Array<number>(gridWidth * gridHeight);
  let minElevation = Infinity;
  let maxElevation = -Infinity;

  for (let gy = 0; gy < gridHeight; gy++) {
    const lat = bbox.north - (gy / (gridHeight - 1)) * (bbox.north - bbox.south);
    const fy = (latToTileY(lat, zoom) - minTy) * TILE_SIZE;
    const y0 = Math.min(mosaicH - 1, Math.max(0, Math.floor(fy)));
    const y1 = Math.min(mosaicH - 1, y0 + 1);
    const wy = fy - y0;

    for (let gx = 0; gx < gridWidth; gx++) {
      const lon = bbox.west + (gx / (gridWidth - 1)) * (bbox.east - bbox.west);
      const fx = (lonToTileX(lon, zoom) - minTx) * TILE_SIZE;
      const x0 = Math.min(mosaicW - 1, Math.max(0, Math.floor(fx)));
      const x1 = Math.min(mosaicW - 1, x0 + 1);
      const wx = fx - x0;

      const v =
        mosaic[y0 * mosaicW + x0] * (1 - wx) * (1 - wy) +
        mosaic[y0 * mosaicW + x1] * wx * (1 - wy) +
        mosaic[y1 * mosaicW + x0] * (1 - wx) * wy +
        mosaic[y1 * mosaicW + x1] * wx * wy;

      elevations[gy * gridWidth + gx] = Math.round(v * 10) / 10;
      if (v < minElevation) minElevation = v;
      if (v > maxElevation) maxElevation = v;
    }
  }

  const grid: DEMGrid = {
    width: gridWidth,
    height: gridHeight,
    bbox,
    elevations,
    minElevation: Math.round(minElevation * 10) / 10,
    maxElevation: Math.round(maxElevation * 10) / 10,
    spanMetersX,
    spanMetersY,
    zoom,
    source: 'AWS Terrain Tiles (Terrarium) — SRTM / Copernicus GLO-30 / NED',
    attribution: 'DEM: Mapzen / AWS Open Data · SRTM (NASA) · Copernicus (ESA)',
    tilesRequested: coords.length,
    tilesResolved: resolved,
  };

  writeCache(cacheKey, grid);
  return grid;
}

// ----------------------------------------------------------------------------
// Hidrografía real desde OpenStreetMap (Overpass API)
// ----------------------------------------------------------------------------
export interface RiverFeature {
  id: number;
  name: string;
  waterway: string;
  /** Puntos [lon, lat] a lo largo del cauce. */
  points: Array<[number, number]>;
}

export interface WaterBodyFeature {
  id: number;
  name: string;
  kind: string;
  points: Array<[number, number]>;
}

export interface PlaceFeature {
  id: number;
  name: string;
  kind: string;
  population: number | null;
  lon: number;
  lat: number;
}

export interface HydrographyData {
  rivers: RiverFeature[];
  waterBodies: WaterBodyFeature[];
  places: PlaceFeature[];
  source: string;
  attribution: string;
  fetchedAt: string;
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

async function runOverpass(query: string): Promise<any> {
  let lastError: Error | null = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(120000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastError = err as Error;
      console.warn(`[GEODATA] Overpass ${endpoint} falló:`, lastError.message);
    }
  }
  throw lastError ?? new Error('Overpass no disponible');
}

export async function fetchHydrography(bbox: BBox = MOCHE_BASIN_BBOX): Promise<HydrographyData> {
  const cacheKey = `hydro-${bbox.west}_${bbox.south}_${bbox.east}_${bbox.north}`;
  const cached = readCache<HydrographyData>(cacheKey, 1000 * 60 * 60 * 24 * 30);
  if (cached) {
    console.log('[GEODATA] Hidrografía servida desde caché en disco');
    return cached;
  }

  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const query = `[out:json][timeout:110];
(
  way["waterway"="river"](${bboxStr});
  way["waterway"="stream"]["name"](${bboxStr});
  way["natural"="water"](${bboxStr});
  way["landuse"="reservoir"](${bboxStr});
  node["place"~"^(city|town|village)$"](${bboxStr});
);
out geom;`;

  console.log('[GEODATA] Consultando hidrografía real en OpenStreetMap...');
  const started = Date.now();
  const json = await runOverpass(query);
  const elements: any[] = json.elements ?? [];

  const rivers: RiverFeature[] = [];
  const waterBodies: WaterBodyFeature[] = [];
  const places: PlaceFeature[] = [];

  for (const el of elements) {
    if (el.type === 'node' && el.tags?.place) {
      // Un nodo place sin `name` no aporta nada como hito: rotularlo produciría
      // etiquetas "Sin nombre" sobre el terreno.
      if (!el.tags.name) continue;
      places.push({
        id: el.id,
        name: el.tags.name,
        kind: el.tags.place,
        population: el.tags.population ? Number(el.tags.population) : null,
        lon: el.lon,
        lat: el.lat,
      });
      continue;
    }

    if (el.type !== 'way' || !Array.isArray(el.geometry)) continue;
    const points = el.geometry.map((g: any) => [g.lon, g.lat] as [number, number]);
    if (points.length < 2) continue;

    const tags = el.tags ?? {};
    if (tags.waterway) {
      rivers.push({
        id: el.id,
        name: tags.name ?? (tags.waterway === 'river' ? 'Cauce sin nombre' : 'Quebrada'),
        waterway: tags.waterway,
        points,
      });
    } else {
      waterBodies.push({
        id: el.id,
        name: tags.name ?? 'Cuerpo de agua',
        kind: tags.natural === 'water' ? (tags.water ?? 'water') : 'reservoir',
        points,
      });
    }
  }

  console.log(
    `[GEODATA] OSM: ${rivers.length} cauces, ${waterBodies.length} cuerpos de agua, ` +
      `${places.length} localidades en ${((Date.now() - started) / 1000).toFixed(1)}s`
  );

  const data: HydrographyData = {
    rivers,
    waterBodies,
    places,
    source: 'OpenStreetMap / Overpass API',
    attribution: '© Colaboradores de OpenStreetMap (ODbL)',
    fetchedAt: new Date().toISOString(),
  };

  writeCache(cacheKey, data);
  return data;
}

// ----------------------------------------------------------------------------
// Clima e hidrometeorología real (Open-Meteo)
// ----------------------------------------------------------------------------
export interface StationWeather {
  lat: number;
  lon: number;
  elevationApi: number;
  currentTemp: number | null;
  precipitationNow: number | null;
  daily: Array<{
    date: string;
    precipitationMm: number;
    tempMax: number;
    tempMin: number;
    et0: number | null;
  }>;
}

export interface WeatherData {
  stations: StationWeather[];
  source: string;
  attribution: string;
  fetchedAt: string;
}

export async function fetchWeatherForPoints(
  points: Array<{ lat: number; lon: number }>,
  pastDays = 60
): Promise<WeatherData> {
  const key = `weather-${pastDays}-${points.map(p => `${p.lat},${p.lon}`).join('|')}`;
  const cacheKey = `wx-${Buffer.from(key).toString('base64url').slice(0, 60)}`;
  const cached = readCache<WeatherData>(cacheKey, 1000 * 60 * 60 * 3); // 3 h
  if (cached) return cached;

  const lats = points.map(p => p.lat).join(',');
  const lons = points.map(p => p.lon).join(',');
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
    `&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,et0_fao_evapotranspiration` +
    `&current=temperature_2m,precipitation&past_days=${pastDays}&forecast_days=7` +
    `&timezone=America%2FLima`;

  console.log(`[GEODATA] Consultando clima real para ${points.length} estaciones (Open-Meteo)...`);
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);

  const json = await res.json();
  // Con varias coordenadas Open-Meteo devuelve un array; con una sola, un objeto.
  const list: any[] = Array.isArray(json) ? json : [json];

  const stations: StationWeather[] = list.map((entry, i) => ({
    lat: entry.latitude ?? points[i].lat,
    lon: entry.longitude ?? points[i].lon,
    elevationApi: entry.elevation ?? 0,
    currentTemp: entry.current?.temperature_2m ?? null,
    precipitationNow: entry.current?.precipitation ?? null,
    daily: (entry.daily?.time ?? []).map((date: string, d: number) => ({
      date,
      precipitationMm: entry.daily.precipitation_sum?.[d] ?? 0,
      tempMax: entry.daily.temperature_2m_max?.[d] ?? 0,
      tempMin: entry.daily.temperature_2m_min?.[d] ?? 0,
      et0: entry.daily.et0_fao_evapotranspiration?.[d] ?? null,
    })),
  }));

  const data: WeatherData = {
    stations,
    source: 'Open-Meteo (ECMWF IFS / GFS + reanálisis ERA5)',
    attribution: 'Datos meteorológicos: Open-Meteo.com (CC BY 4.0)',
    fetchedAt: new Date().toISOString(),
  };

  writeCache(cacheKey, data);
  return data;
}

// ----------------------------------------------------------------------------
// Google Maps Platform (opcional — requiere GOOGLE_MAPS_API_KEY)
// ----------------------------------------------------------------------------
export function isGoogleMapsConfigured(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY);
}

/**
 * Elevaciones vía Google Maps Elevation API. Se usa como fuente de contraste
 * frente al DEM Terrarium cuando el usuario configura su propia API key.
 */
export async function fetchGoogleElevations(
  points: Array<{ lat: number; lon: number }>
): Promise<Array<{ lat: number; lon: number; elevation: number; resolution: number }>> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY no configurada');

  const locations = points.map(p => `${p.lat},${p.lon}`).join('|');
  const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=${encodeURIComponent(
    locations
  )}&key=${apiKey}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  const json = await res.json();
  if (json.status !== 'OK') {
    throw new Error(`Google Elevation API: ${json.status} — ${json.error_message ?? 'sin detalle'}`);
  }

  return json.results.map((r: any) => ({
    lat: r.location.lat,
    lon: r.location.lng,
    elevation: r.elevation,
    resolution: r.resolution,
  }));
}
