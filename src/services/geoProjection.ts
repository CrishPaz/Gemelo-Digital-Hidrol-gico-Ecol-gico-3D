/**
 * geoProjection.ts - Puente entre coordenadas geográficas reales y la escena 3D.
 *
 * El gemelo digital se construye sobre un DEM real (SRTM/Copernicus vía Terrarium),
 * así que todo lo que se dibuja encima —cauces del OSM, estaciones IoT, localidades—
 * debe proyectarse con la misma transformación y "colgarse" del relieve.
 */

export interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface DEMGrid {
  width: number;
  height: number;
  bbox: BBox;
  elevations: number[];
  minElevation: number;
  maxElevation: number;
  spanMetersX: number;
  spanMetersY: number;
  zoom: number;
  source: string;
  attribution: string;
  tilesRequested: number;
  tilesResolved: number;
}

/** Ancho de la cuenca en unidades de escena. El resto se deriva de la proporción real. */
export const SCENE_WIDTH = 100;

export class BasinProjection {
  readonly dem: DEMGrid;
  readonly horizontalScale: number;
  readonly verticalExaggeration: number;
  readonly sceneWidth: number;
  readonly sceneDepth: number;
  private readonly centerLon: number;
  private readonly centerLat: number;
  private readonly mPerDegLon: number;
  private readonly mPerDegLat: number;

  constructor(dem: DEMGrid, verticalExaggeration = 2.6) {
    this.dem = dem;
    this.verticalExaggeration = verticalExaggeration;
    this.horizontalScale = SCENE_WIDTH / dem.spanMetersX;
    this.sceneWidth = SCENE_WIDTH;
    this.sceneDepth = dem.spanMetersY * this.horizontalScale;
    this.centerLon = (dem.bbox.west + dem.bbox.east) / 2;
    this.centerLat = (dem.bbox.south + dem.bbox.north) / 2;

    const rad = (this.centerLat * Math.PI) / 180;
    this.mPerDegLon = 111320 * Math.cos(rad);
    this.mPerDegLat = 110574;
  }

  /** Longitud → X de escena (este positivo). */
  lonToX(lon: number): number {
    return (lon - this.centerLon) * this.mPerDegLon * this.horizontalScale;
  }

  /** Latitud → Z de escena (norte hacia -Z, convención de Three.js). */
  latToZ(lat: number): number {
    return -(lat - this.centerLat) * this.mPerDegLat * this.horizontalScale;
  }

  /** Inversa de lonToX: X de escena → longitud. */
  xToLon(x: number): number {
    return x / (this.mPerDegLon * this.horizontalScale) + this.centerLon;
  }

  /** Inversa de latToZ: Z de escena → latitud. */
  zToLat(z: number): number {
    return -z / (this.mPerDegLat * this.horizontalScale) + this.centerLat;
  }

  /** Metros sobre el nivel del mar → Y de escena, con exageración vertical. */
  elevationToY(meters: number): number {
    return meters * this.horizontalScale * this.verticalExaggeration;
  }

  /** Factor de escala vertical completo (útil para la barra de escala). */
  get verticalScale(): number {
    return this.horizontalScale * this.verticalExaggeration;
  }

  /**
   * Elevación real interpolada bilinealmente en cualquier lat/lon dentro del DEM.
   * Es lo que permite colgar el cauce del río exactamente sobre el terreno.
   */
  sampleElevation(lon: number, lat: number): number {
    const { bbox, width, height, elevations } = this.dem;

    const fx = ((lon - bbox.west) / (bbox.east - bbox.west)) * (width - 1);
    const fy = ((bbox.north - lat) / (bbox.north - bbox.south)) * (height - 1);

    if (!Number.isFinite(fx) || !Number.isFinite(fy)) return 0;

    const x0 = Math.min(width - 1, Math.max(0, Math.floor(fx)));
    const y0 = Math.min(height - 1, Math.max(0, Math.floor(fy)));
    const x1 = Math.min(width - 1, x0 + 1);
    const y1 = Math.min(height - 1, y0 + 1);
    const wx = Math.min(1, Math.max(0, fx - x0));
    const wy = Math.min(1, Math.max(0, fy - y0));

    return (
      elevations[y0 * width + x0] * (1 - wx) * (1 - wy) +
      elevations[y0 * width + x1] * wx * (1 - wy) +
      elevations[y1 * width + x0] * (1 - wx) * wy +
      elevations[y1 * width + x1] * wx * wy
    );
  }

  /** ¿Está el punto dentro de la extensión del DEM descargado? */
  contains(lon: number, lat: number): boolean {
    const { bbox } = this.dem;
    return lon >= bbox.west && lon <= bbox.east && lat >= bbox.south && lat <= bbox.north;
  }

  /**
   * Proyecta un punto geográfico a la escena, apoyándolo sobre el relieve real.
   * `offsetMeters` levanta el punto sobre el terreno (para que el cauce no
   * quede enterrado por el z-fighting con la malla).
   */
  project(lon: number, lat: number, offsetMeters = 0): [number, number, number] {
    const elevation = this.sampleElevation(lon, lat);
    return [this.lonToX(lon), this.elevationToY(elevation + offsetMeters), this.latToZ(lat)];
  }
}

// ----------------------------------------------------------------------------
// Paleta hipsométrica calibrada a los pisos altitudinales del Perú
// (clasificación de Javier Pulgar Vidal, adaptada a la cuenca del Moche)
// ----------------------------------------------------------------------------
export interface ElevationBand {
  maxElevation: number;
  color: [number, number, number];
  label: string;
}

export const PERUVIAN_ELEVATION_BANDS: ElevationBand[] = [
  { maxElevation: 0, color: [0.04, 0.14, 0.28], label: 'Océano Pacífico' },
  { maxElevation: 120, color: [0.82, 0.74, 0.55], label: 'Chala — desierto costero (0–120 m)' },
  { maxElevation: 500, color: [0.72, 0.62, 0.39], label: 'Valle bajo y campiña (120–500 m)' },
  { maxElevation: 1200, color: [0.58, 0.55, 0.30], label: 'Yunga marítima (500–1200 m)' },
  { maxElevation: 2300, color: [0.38, 0.52, 0.25], label: 'Quechua baja (1200–2300 m)' },
  { maxElevation: 3200, color: [0.28, 0.46, 0.22], label: 'Quechua alta (2300–3200 m)' },
  { maxElevation: 3900, color: [0.50, 0.43, 0.24], label: 'Suni / Jalca (3200–3900 m)' },
  { maxElevation: 4400, color: [0.68, 0.64, 0.58], label: 'Puna — cabecera de cuenca (>3900 m)' },
];

/** Color hipsométrico interpolado suavemente entre pisos altitudinales. */
export function hypsometricColor(elevation: number): [number, number, number] {
  const bands = PERUVIAN_ELEVATION_BANDS;
  if (elevation <= bands[0].maxElevation) return bands[0].color;

  for (let i = 1; i < bands.length; i++) {
    if (elevation <= bands[i].maxElevation) {
      const lower = bands[i - 1];
      const upper = bands[i];
      const span = upper.maxElevation - lower.maxElevation;
      const t = span > 0 ? (elevation - lower.maxElevation) / span : 0;
      // Suavizado para que las transiciones entre pisos no se vean como bandas duras
      const s = t * t * (3 - 2 * t);
      return [
        lower.color[0] + (upper.color[0] - lower.color[0]) * s,
        lower.color[1] + (upper.color[1] - lower.color[1]) * s,
        lower.color[2] + (upper.color[2] - lower.color[2]) * s,
      ];
    }
  }
  return bands[bands.length - 1].color;
}

/** Rampa continua para capas temáticas (WQI, NDWI, metales…). */
export function rampColor(
  t: number,
  stops: Array<{ at: number; color: [number, number, number] }>
): [number, number, number] {
  const v = Math.min(1, Math.max(0, t));
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i].at) {
      const a = stops[i - 1];
      const b = stops[i];
      const span = b.at - a.at;
      const k = span > 0 ? (v - a.at) / span : 0;
      return [
        a.color[0] + (b.color[0] - a.color[0]) * k,
        a.color[1] + (b.color[1] - a.color[1]) * k,
        a.color[2] + (b.color[2] - a.color[2]) * k,
      ];
    }
  }
  return stops[stops.length - 1].color;
}
