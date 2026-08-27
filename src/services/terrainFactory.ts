/**
 * terrainFactory.ts - Construcción de la geometría 3D a partir del DEM real.
 *
 * Separa "geometría" (se calcula una vez, es cara) de "color por vértice"
 * (se recalcula al cambiar de capa temática, es barato). Así cambiar entre
 * Topografía / ICA / NDWI / Inundación no reconstruye la malla de 135 000 vértices.
 */

import * as THREE from 'three';
import {
  BasinProjection,
  hypsometricColor,
  rampColor,
} from './geoProjection';
import type { MonitoringStation } from '../types';
import type { RiverFeature } from '../hooks/useBasinGeodata';

export type TerrainLayer =
  | 'elevation'
  | 'wqi'
  | 'ndwi'
  | 'discharge'
  | 'flood'
  | 'heavy_metals';

// ----------------------------------------------------------------------------
// Geometría del terreno
// ----------------------------------------------------------------------------


/**
 * Submuestreo de la malla de render.
 *
 * El DEM se descarga a máxima resolución porque el muestreo de cotas (cauces,
 * estaciones, pendiente) debe ser preciso. Pero mallar los 135 000 vértices
 * completos genera ~268 000 triángulos que, con sombras, ahogan a GPUs modestas.
 * Aquí se decima SOLO la malla visible; el DEM sigue intacto para el muestreo.
 */
export interface MeshSampling {
  stride: number;
  meshWidth: number;
  meshHeight: number;
  /** Índice dentro del DEM completo para un vértice de la malla. */
  demIndex: (mx: number, my: number) => number;
}

/**
 * Tope de vértices de la malla visible.
 *
 * Con 96 000 el DEM de 480x283 caía a stride 2, o sea celdas de 390 m: al acercarse a la
 * costa, la intersección entre el agua y la malla seguía las aristas de esos triángulos y
 * la orilla se veía como una escalera. Con 150 000 entra stride 1 (270 000 triángulos), la
 * celda baja a 195 m y el escalonado se reduce a la mitad. Es la resolución nativa del DEM
 * descargado: afinar más exige pedir zoom 13 al servidor, no re-mallar.
 */
const MAX_MESH_VERTICES = 150000;

export function planMeshSampling(
  demWidth: number,
  demHeight: number,
  maxVertices = MAX_MESH_VERTICES
): MeshSampling {
  let stride = 1;
  while (
    Math.ceil(demWidth / stride) * Math.ceil(demHeight / stride) > maxVertices &&
    stride < 8
  ) {
    stride++;
  }

  const meshWidth = Math.ceil(demWidth / stride);
  const meshHeight = Math.ceil(demHeight / stride);

  return {
    stride,
    meshWidth,
    meshHeight,
    demIndex: (mx: number, my: number) => {
      const x = Math.min(demWidth - 1, mx * stride);
      const y = Math.min(demHeight - 1, my * stride);
      return y * demWidth + x;
    },
  };
}

/**
 * Malla del relieve real. Los vértices se colocan en coordenadas de escena
 * y las normales se calculan a partir del gradiente del DEM, no del plano base,
 * lo que da un sombreado de laderas fiel a la topografía.
 */
export function buildTerrainGeometry(
  projection: BasinProjection,
  sampling: MeshSampling
): THREE.BufferGeometry {
  const { dem } = projection;
  const { width, height, elevations, bbox } = dem;
  const { meshWidth, meshHeight, demIndex } = sampling;

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(meshWidth * meshHeight * 3);
  const uvs = new Float32Array(meshWidth * meshHeight * 2);

  for (let my = 0; my < meshHeight; my++) {
    const demY = Math.min(height - 1, my * sampling.stride);
    const lat = bbox.north - (demY / (height - 1)) * (bbox.north - bbox.south);
    const z = projection.latToZ(lat);

    for (let mx = 0; mx < meshWidth; mx++) {
      const demX = Math.min(width - 1, mx * sampling.stride);
      const lon = bbox.west + (demX / (width - 1)) * (bbox.east - bbox.west);
      const i = my * meshWidth + mx;

      positions[i * 3] = projection.lonToX(lon);
      positions[i * 3 + 1] = projection.elevationToY(elevations[demIndex(mx, my)]);
      positions[i * 3 + 2] = z;
      uvs[i * 2] = mx / (meshWidth - 1);
      uvs[i * 2 + 1] = 1 - my / (meshHeight - 1);
    }
  }

  const indices = new Uint32Array((meshWidth - 1) * (meshHeight - 1) * 6);
  let p = 0;
  for (let y = 0; y < meshHeight - 1; y++) {
    for (let x = 0; x < meshWidth - 1; x++) {
      const a = y * meshWidth + x;
      const b = a + 1;
      const c = a + meshWidth;
      const d = c + 1;
      indices[p++] = a; indices[p++] = c; indices[p++] = b;
      indices[p++] = b; indices[p++] = c; indices[p++] = d;
    }
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
}

/** Pendiente en grados por vértice, derivada del DEM (para mezclar roca en laderas). */
export function computeSlopeMap(projection: BasinProjection): Float32Array {
  const { dem } = projection;
  const { width, height, elevations, spanMetersX, spanMetersY } = dem;
  const dx = spanMetersX / (width - 1);
  const dy = spanMetersY / (height - 1);
  const slope = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const xl = Math.max(0, x - 1);
      const xr = Math.min(width - 1, x + 1);
      const yu = Math.max(0, y - 1);
      const yd = Math.min(height - 1, y + 1);

      const gx = (elevations[y * width + xr] - elevations[y * width + xl]) / ((xr - xl) * dx);
      const gy = (elevations[yd * width + x] - elevations[yu * width + x]) / ((yd - yu) * dy);

      slope[y * width + x] = (Math.atan(Math.hypot(gx, gy)) * 180) / Math.PI;
    }
  }
  return slope;
}

/**
 * Distancia aproximada de cada celda al cauce más cercano, en metros.
 * Se usa para la capa de inundación y para humedecer la vegetación ribereña.
 * Se calcula con un barrido de distancia por chamfer (dos pasadas), mucho más
 * rápido que evaluar todos los puntos del río contra todos los vértices.
 */
export function computeRiverDistance(
  projection: BasinProjection,
  rivers: RiverFeature[]
): Float32Array {
  const { dem } = projection;
  const { width, height, bbox } = dem;
  const INF = 1e9;
  const dist = new Float32Array(width * height).fill(INF);

  const toCell = (lon: number, lat: number) => {
    const x = Math.round(((lon - bbox.west) / (bbox.east - bbox.west)) * (width - 1));
    const y = Math.round(((bbox.north - lat) / (bbox.north - bbox.south)) * (height - 1));
    return { x, y };
  };

  // Semillas: todos los puntos de todos los cauces, densificados
  for (const river of rivers) {
    for (let i = 0; i < river.points.length; i++) {
      const [lon, lat] = river.points[i];
      const { x, y } = toCell(lon, lat);
      if (x >= 0 && x < width && y >= 0 && y < height) dist[y * width + x] = 0;

      // Densificamos el segmento para no dejar huecos entre vértices lejanos
      if (i + 1 < river.points.length) {
        const [lon2, lat2] = river.points[i + 1];
        const steps = Math.min(24, Math.ceil(Math.hypot(lon2 - lon, lat2 - lat) / 0.002));
        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          const c = toCell(lon + (lon2 - lon) * t, lat + (lat2 - lat) * t);
          if (c.x >= 0 && c.x < width && c.y >= 0 && c.y < height) dist[c.y * width + c.x] = 0;
        }
      }
    }
  }

  const cellX = dem.spanMetersX / (width - 1);
  const cellY = dem.spanMetersY / (height - 1);
  const dOrtho = Math.min(cellX, cellY);
  const dDiag = Math.hypot(cellX, cellY);

  // Pasada directa
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      let best = dist[i];
      if (y > 0) {
        best = Math.min(best, dist[(y - 1) * width + x] + dOrtho);
        if (x > 0) best = Math.min(best, dist[(y - 1) * width + x - 1] + dDiag);
        if (x < width - 1) best = Math.min(best, dist[(y - 1) * width + x + 1] + dDiag);
      }
      if (x > 0) best = Math.min(best, dist[i - 1] + dOrtho);
      dist[i] = best;
    }
  }
  // Pasada inversa
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      let best = dist[i];
      if (y < height - 1) {
        best = Math.min(best, dist[(y + 1) * width + x] + dOrtho);
        if (x > 0) best = Math.min(best, dist[(y + 1) * width + x - 1] + dDiag);
        if (x < width - 1) best = Math.min(best, dist[(y + 1) * width + x + 1] + dDiag);
      }
      if (x < width - 1) best = Math.min(best, dist[i + 1] + dOrtho);
      dist[i] = best;
    }
  }

  return dist;
}

// ----------------------------------------------------------------------------
// Interpolación de variables medidas en estaciones (IDW)
// ----------------------------------------------------------------------------

/**
 * Ponderación por distancia inversa desde las estaciones IoT reales.
 * Es la forma honesta de "pintar" una variable puntual sobre toda la cuenca:
 * cerca de una estación domina su valor medido, lejos se difumina hacia la media.
 */
function interpolateFromStations(
  projection: BasinProjection,
  stations: MonitoringStation[],
  valueOf: (s: MonitoringStation) => number,
  power = 2.2
): Float32Array {
  const { dem } = projection;
  const { width, height, bbox } = dem;
  const field = new Float32Array(width * height);

  const pts = stations.map(s => ({
    lon: s.coordinates.lng,
    lat: s.coordinates.lat,
    v: valueOf(s),
  }));
  if (pts.length === 0) return field;

  const mean = pts.reduce((a, p) => a + p.v, 0) / pts.length;

  for (let y = 0; y < height; y++) {
    const lat = bbox.north - (y / (height - 1)) * (bbox.north - bbox.south);
    for (let x = 0; x < width; x++) {
      const lon = bbox.west + (x / (width - 1)) * (bbox.east - bbox.west);

      let num = 0;
      let den = 0;
      let exact = NaN;
      for (const p of pts) {
        const d2 = (lon - p.lon) ** 2 + (lat - p.lat) ** 2;
        if (d2 < 1e-8) { exact = p.v; break; }
        const w = 1 / Math.pow(d2, power / 2);
        num += w * p.v;
        den += w;
      }
      // Regularización: lejos de toda estación el campo tiende a la media de la cuenca.
      // Con valores altos todo se aplasta hacia la media y el mapa sale de un solo
      // color; este peso deja ver el gradiente real entre estaciones sin inventar
      // estructura donde no hay mediciones.
      const REGULARIZE = 18;
      field[y * width + x] = Number.isNaN(exact)
        ? (num + mean * REGULARIZE) / (den + REGULARIZE)
        : exact;
    }
  }
  return field;
}

// ----------------------------------------------------------------------------
// Color por vértice según la capa temática activa
// ----------------------------------------------------------------------------

export interface LayerContext {
  projection: BasinProjection;
  stations: MonitoringStation[];
  slope: Float32Array;
  riverDistance: Float32Array | null;
  /** Debe ser el MISMO submuestreo con el que se malló la geometría. */
  sampling: MeshSampling;
  /** Cota de inundación en metros sobre el cauce (capa 'flood'). */
  floodDepth?: number;
}

/**
 * La leyenda viaja como CLAVES, no como texto: este módulo es una fábrica de geometría
 * y no debe saber en qué idioma está la interfaz. El componente las resuelve con `t()`.
 */
export interface LayerLegend {
  titleKey: string;
  entries: Array<{ color: string; labelKey: string }>;
  noteKey?: string;
}

const RAMP_WQI: Array<{ at: number; color: [number, number, number] }> = [
  { at: 0.0, color: [0.70, 0.11, 0.11] },
  { at: 0.35, color: [0.85, 0.47, 0.12] },
  { at: 0.55, color: [0.90, 0.76, 0.20] },
  { at: 0.75, color: [0.40, 0.73, 0.29] },
  { at: 1.0, color: [0.13, 0.55, 0.42] },
];

const RAMP_METALS: Array<{ at: number; color: [number, number, number] }> = [
  { at: 0.0, color: [0.18, 0.36, 0.29] },
  { at: 0.3, color: [0.62, 0.60, 0.28] },
  { at: 0.6, color: [0.78, 0.38, 0.13] },
  { at: 1.0, color: [0.55, 0.08, 0.30] },
];

const RAMP_NDWI: Array<{ at: number; color: [number, number, number] }> = [
  { at: 0.0, color: [0.62, 0.55, 0.40] },
  { at: 0.4, color: [0.55, 0.58, 0.36] },
  { at: 0.7, color: [0.22, 0.52, 0.55] },
  { at: 1.0, color: [0.08, 0.45, 0.72] },
];

export function computeLayerColors(
  layer: TerrainLayer,
  ctx: LayerContext
): { colors: Float32Array; legend: LayerLegend } {
  const { projection, stations, slope, riverDistance, sampling } = ctx;
  const { dem } = projection;
  const { elevations } = dem;
  const { meshWidth, meshHeight, demIndex } = sampling;

  // Un color por vértice de la malla; cada uno lee su celda del DEM completo.
  const n = meshWidth * meshHeight;
  const colors = new Float32Array(n * 3);
  const demAt = new Int32Array(n);
  for (let my = 0; my < meshHeight; my++) {
    for (let mx = 0; mx < meshWidth; mx++) {
      demAt[my * meshWidth + mx] = demIndex(mx, my);
    }
  }

  // Realce sutil de laderas. La iluminación real de la escena ya aporta el volumen,
  // así que aquí solo se matiza: si se oscurece de más, el relieve se ve lavado.
  const shade = (i: number) => 1 - Math.min(0.22, (slope[demAt[i]] / 60) * 0.22);

  const write = (i: number, rgb: [number, number, number], k = 1) => {
    colors[i * 3] = Math.min(1, rgb[0] * k);
    colors[i * 3 + 1] = Math.min(1, rgb[1] * k);
    colors[i * 3 + 2] = Math.min(1, rgb[2] * k);
  };

  let legend: LayerLegend;

  switch (layer) {
    case 'wqi': {
      const field = interpolateFromStations(projection, stations, s => s.currentValues.wqi);
      for (let i = 0; i < n; i++) {
        if (elevations[demAt[i]] <= 0) { write(i, [0.05, 0.16, 0.31]); continue; }
        write(i, rampColor((field[demAt[i]] - 20) / 70, RAMP_WQI), shade(i));
      }
      legend = {
        titleKey: 'legend.wqi.title',
        entries: [
          { color: '#b31c1c', labelKey: 'legend.wqi.a' },
          { color: '#d9781f', labelKey: 'legend.wqi.b' },
          { color: '#e6c233', labelKey: 'legend.wqi.c' },
          { color: '#66ba4a', labelKey: 'legend.wqi.d' },
          { color: '#218c6b', labelKey: 'legend.wqi.e' },
        ],
        noteKey: 'legend.wqi.note',
      };
      break;
    }

    case 'heavy_metals': {
      const field = interpolateFromStations(
        projection,
        stations,
        s => s.currentValues.heavy_metals_lead
      );
      for (let i = 0; i < n; i++) {
        if (elevations[demAt[i]] <= 0) { write(i, [0.05, 0.16, 0.31]); continue; }
        write(i, rampColor(field[demAt[i]] / 0.06, RAMP_METALS), shade(i));
      }
      legend = {
        titleKey: 'legend.metals.title',
        entries: [
          { color: '#2e5c4a', labelKey: 'legend.metals.a' },
          { color: '#9e9947', labelKey: 'legend.metals.b' },
          { color: '#c76122', labelKey: 'legend.metals.c' },
          { color: '#8c144d', labelKey: 'legend.metals.d' },
        ],
        noteKey: 'legend.metals.note',
      };
      break;
    }

    case 'ndwi': {
      for (let i = 0; i < n; i++) {
        if (elevations[demAt[i]] <= 0) { write(i, [0.04, 0.20, 0.40]); continue; }
        // Proxy de NDWI: humedad decae con la distancia al cauce y con la aridez costera
        const d = riverDistance ? riverDistance[demAt[i]] : 8000;
        const proximity = Math.exp(-d / 2600);
        const altitudeMoisture = Math.min(1, Math.max(0, (elevations[demAt[i]] - 150) / 3200)) * 0.55;
        write(i, rampColor(Math.min(1, proximity * 0.85 + altitudeMoisture), RAMP_NDWI), shade(i));
      }
      legend = {
        titleKey: 'legend.ndwi.title',
        entries: [
          { color: '#9e8c66', labelKey: 'legend.ndwi.a' },
          { color: '#8c945c', labelKey: 'legend.ndwi.b' },
          { color: '#38858c', labelKey: 'legend.ndwi.c' },
          { color: '#1473b8', labelKey: 'legend.ndwi.d' },
        ],
        noteKey: 'legend.ndwi.note',
      };
      break;
    }

    case 'discharge': {
      const field = interpolateFromStations(
        projection,
        stations,
        s => s.currentValues.discharge
      );
      for (let i = 0; i < n; i++) {
        if (elevations[demAt[i]] <= 0) { write(i, [0.05, 0.16, 0.31]); continue; }
        const d = riverDistance ? riverDistance[demAt[i]] : 9999;
        const nearRiver = Math.exp(-d / 1800);
        const q = Math.min(1, field[demAt[i]] / 9);
        const base: [number, number, number] = [
          0.20 + 0.10 * (1 - q),
          0.34 + 0.22 * q,
          0.45 + 0.42 * q,
        ];
        const dry = hypsometricColor(elevations[demAt[i]]);
        const k = nearRiver;
        write(i, [
          dry[0] * (1 - k) + base[0] * k,
          dry[1] * (1 - k) + base[1] * k,
          dry[2] * (1 - k) + base[2] * k,
        ], shade(i));
      }
      legend = {
        titleKey: 'legend.discharge.title',
        entries: [
          { color: '#4d6b8f', labelKey: 'legend.discharge.a' },
          { color: '#3f7fb0', labelKey: 'legend.discharge.b' },
          { color: '#3fa0d9', labelKey: 'legend.discharge.c' },
          { color: '#8a7f5c', labelKey: 'legend.discharge.d' },
        ],
        noteKey: 'legend.discharge.note',
      };
      break;
    }

    case 'flood': {
      const depth = ctx.floodDepth ?? 12;
      for (let i = 0; i < n; i++) {
        if (elevations[demAt[i]] <= 0) { write(i, [0.05, 0.16, 0.31]); continue; }
        const d = riverDistance ? riverDistance[demAt[i]] : 9999;
        // La llanura inundable crece donde el terreno es plano y está cerca del cauce
        const flatness = Math.max(0, 1 - slope[demAt[i]] / 6);
        const nearness = Math.max(0, 1 - d / (depth * 190));
        const risk = Math.min(1, flatness * nearness * 1.5);

        const dry = hypsometricColor(elevations[demAt[i]]);
        if (risk > 0.06) {
          const water: [number, number, number] = [
            0.55 - 0.35 * risk,
            0.22 + 0.10 * (1 - risk),
            0.30 + 0.45 * risk,
          ];
          write(i, [
            dry[0] * (1 - risk) + water[0] * risk,
            dry[1] * (1 - risk) + water[1] * risk,
            dry[2] * (1 - risk) + water[2] * risk,
          ], shade(i));
        } else {
          write(i, dry, shade(i) * 0.72);
        }
      }
      legend = {
        titleKey: 'legend.flood.title',
        // el calado concreto se muestra aparte, en la nota
        entries: [
          { color: '#1f4fc4', labelKey: 'legend.flood.a' },
          { color: '#7a3f8c', labelKey: 'legend.flood.b' },
          { color: '#6b6355', labelKey: 'legend.flood.c' },
        ],
        noteKey: 'legend.flood.note',
      };
      break;
    }

    case 'elevation':
    default: {
      for (let i = 0; i < n; i++) {
        const e = elevations[demAt[i]];
        const base = hypsometricColor(e);
        // Los Andes superan los 22° en casi toda su extensión: con ese umbral el
        // modelo entero se agrisaba. La roca aflora solo en escarpes reales (>34°)
        // y nunca llega a cubrir del todo el color del piso altitudinal.
        const rockiness = Math.min(0.62, Math.max(0, (slope[demAt[i]] - 34) / 26));
        const rock: [number, number, number] = [0.40, 0.36, 0.33];
        write(i, [
          base[0] * (1 - rockiness) + rock[0] * rockiness,
          base[1] * (1 - rockiness) + rock[1] * rockiness,
          base[2] * (1 - rockiness) + rock[2] * rockiness,
        ], shade(i));
      }
      legend = {
        titleKey: 'legend.elevation.title',
        entries: [
          { color: '#c2b58f', labelKey: 'legend.elevation.a' },
          { color: '#8c8757', labelKey: 'legend.elevation.b' },
          { color: '#59784f', labelKey: 'legend.elevation.c' },
          { color: '#7a7050', labelKey: 'legend.elevation.d' },
          { color: '#999189', labelKey: 'legend.elevation.e' },
        ],
        noteKey: 'legend.elevation.note',
      };
      break;
    }
  }

  return { colors, legend };
}

// ----------------------------------------------------------------------------
// Cauces reales colgados del relieve
// ----------------------------------------------------------------------------

/**
 * Convierte los cauces del OSM en cintas 3D que siguen el terreno.
 * El ancho se modula por jerarquía (río principal vs. quebrada) y el trazado
 * se levanta unos metros para evitar z-fighting con la malla del DEM.
 */
export function buildRiverLines(
  projection: BasinProjection,
  rivers: RiverFeature[]
): { main: THREE.BufferGeometry | null; tributaries: THREE.BufferGeometry | null } {
  const mainPositions: number[] = [];
  const tribPositions: number[] = [];

  for (const river of rivers) {
    const isMain =
      river.waterway === 'river' && /moche|grande|san lorenzo|otuzco/i.test(river.name);
    const target = isMain ? mainPositions : tribPositions;
    const lift = isMain ? 26 : 20;

    for (let i = 0; i < river.points.length - 1; i++) {
      const [lon1, lat1] = river.points[i];
      const [lon2, lat2] = river.points[i + 1];
      if (!projection.contains(lon1, lat1) || !projection.contains(lon2, lat2)) continue;

      const a = projection.project(lon1, lat1, lift);
      const b = projection.project(lon2, lat2, lift);
      target.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    }
  }

  const make = (arr: number[]) => {
    if (arr.length === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arr), 3));
    return g;
  };

  return { main: make(mainPositions), tributaries: make(tribPositions) };
}

/**
 * Faldón y base del bloque de terreno.
 *
 * El DEM se recorta en un rectángulo, así que sin esto la malla flota como una
 * hoja con un acantilado en el borde. Cerrar los laterales y el fondo lo convierte
 * en un bloque sólido extraído de la cuenca, que es como se presenta un modelo
 * geológico y evita ver el reverso de los triángulos desde ángulos bajos.
 */
export function buildTerrainSkirt(
  projection: BasinProjection,
  baseElevationMeters: number,
  sampling: MeshSampling
): THREE.BufferGeometry {
  const { dem } = projection;
  const { elevations, bbox } = dem;
  // Recorremos el borde con el mismo paso que la malla para que ambos encajen.
  const step = sampling.stride;
  const width = dem.width;
  const height = dem.height;

  const positions: number[] = [];
  const baseY = projection.elevationToY(baseElevationMeters);

  const lonAt = (x: number) => bbox.west + (x / (width - 1)) * (bbox.east - bbox.west);
  const latAt = (y: number) => bbox.north - (y / (height - 1)) * (bbox.north - bbox.south);

  const pushQuad = (
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number
  ) => {
    // Dos triángulos: cara superior (terreno) hacia la base
    positions.push(ax, ay, az, bx, by, bz, ax, baseY, az);
    positions.push(bx, by, bz, bx, baseY, bz, ax, baseY, az);
  };

  // Borde norte (y = 0) y borde sur (y = height-1)
  for (const [rowIndex, flip] of [[0, false], [height - 1, true]] as Array<[number, boolean]>) {
    for (let x = 0; x + step < width; x += step) {
      const i1 = rowIndex * width + x;
      const i2 = rowIndex * width + Math.min(width - 1, x + step);
      const lat = latAt(rowIndex);
      const a = [projection.lonToX(lonAt(x)), projection.elevationToY(elevations[i1]), projection.latToZ(lat)];
      const b = [projection.lonToX(lonAt(Math.min(width - 1, x + step))), projection.elevationToY(elevations[i2]), projection.latToZ(lat)];
      if (flip) pushQuad(b[0], b[1], b[2], a[0], a[1], a[2]);
      else pushQuad(a[0], a[1], a[2], b[0], b[1], b[2]);
    }
  }

  // Borde oeste (x = 0) y borde este (x = width-1)
  for (const [colIndex, flip] of [[0, true], [width - 1, false]] as Array<[number, boolean]>) {
    for (let y = 0; y + step < height; y += step) {
      const i1 = y * width + colIndex;
      const i2 = Math.min(height - 1, y + step) * width + colIndex;
      const lon = lonAt(colIndex);
      const a = [projection.lonToX(lon), projection.elevationToY(elevations[i1]), projection.latToZ(latAt(y))];
      const b = [projection.lonToX(lon), projection.elevationToY(elevations[i2]), projection.latToZ(latAt(Math.min(height - 1, y + step)))];
      if (flip) pushQuad(b[0], b[1], b[2], a[0], a[1], a[2]);
      else pushQuad(a[0], a[1], a[2], b[0], b[1], b[2]);
    }
  }

  // Fondo del bloque
  const x0 = projection.lonToX(bbox.west);
  const x1 = projection.lonToX(bbox.east);
  const z0 = projection.latToZ(bbox.north);
  const z1 = projection.latToZ(bbox.south);
  positions.push(x0, baseY, z0, x0, baseY, z1, x1, baseY, z0);
  positions.push(x1, baseY, z0, x0, baseY, z1, x1, baseY, z1);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  g.computeVertexNormals();
  return g;
}

/**
 * Cauce principal como tubo 3D.
 *
 * LineBasicMaterial ignora `linewidth` en casi todos los navegadores, así que un río
 * dibujado con líneas queda como un hilo de 1 px, invisible a escala de cuenca. En un
 * gemelo hidrológico el cauce es el elemento central: se malla como tubo siguiendo el
 * relieve real, con radio proporcional a la jerarquía del tramo.
 */
export function buildRiverTubes(
  projection: BasinProjection,
  rivers: RiverFeature[],
  opts: { radius?: number; liftMeters?: number; minPoints?: number } = {}
): THREE.BufferGeometry[] {
  const { radius = 0.28, liftMeters = 30, minPoints = 8 } = opts;
  const geometries: THREE.BufferGeometry[] = [];

  for (const river of rivers) {
    const pts = river.points.filter(([lon, lat]) => projection.contains(lon, lat));
    if (pts.length < minPoints) continue;

    const vectors = pts.map(([lon, lat]) => {
      const [x, y, z] = projection.project(lon, lat, liftMeters);
      return new THREE.Vector3(x, y, z);
    });

    // Descarta puntos coincidentes: una curva con duplicados genera normales NaN
    const cleaned: THREE.Vector3[] = [vectors[0]];
    for (let i = 1; i < vectors.length; i++) {
      if (vectors[i].distanceToSquared(cleaned[cleaned.length - 1]) > 1e-6) {
        cleaned.push(vectors[i]);
      }
    }
    if (cleaned.length < 4) continue;

    const curve = new THREE.CatmullRomCurve3(cleaned, false, 'centripetal', 0.4);
    const segments = Math.min(600, Math.max(24, cleaned.length * 2));
    geometries.push(new THREE.TubeGeometry(curve, segments, radius, 6, false));
  }

  return geometries;
}
