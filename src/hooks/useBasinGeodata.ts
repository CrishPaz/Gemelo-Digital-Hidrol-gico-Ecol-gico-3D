/**
 * useBasinGeodata.ts - Carga de los geodatos reales de la cuenca del Río Moche.
 *
 * El DEM y la hidrografía se piden una sola vez y quedan cacheados en el servidor;
 * el clima se refresca con más frecuencia. Cada bloque se expone por separado para
 * que el visor 3D pueda dibujar el terreno en cuanto llega el DEM, sin esperar
 * a que Overpass responda.
 */

import { useCallback, useEffect, useState } from 'react';
import type { DEMGrid } from '../services/geoProjection';

export interface RiverFeature {
  id: number;
  name: string;
  waterway: string;
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

export interface GeoSource {
  id: string;
  name: string;
  detail: string;
  kind: string;
  requiresKey: boolean;
  enabled: boolean;
}

type Phase = 'idle' | 'loading' | 'ready' | 'error';

export interface BasinGeodata {
  dem: DEMGrid | null;
  hydrography: HydrographyData | null;
  weather: WeatherData | null;
  sources: GeoSource[];
  demPhase: Phase;
  hydroPhase: Phase;
  weatherPhase: Phase;
  error: string | null;
  progressLabel: string;
  reload: () => void;
}

async function getJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as any)?.error || `HTTP ${res.status}`);
  return body as T;
}

export function useBasinGeodata(
  stationPoints: Array<{ lat: number; lon: number }>,
  options: { zoom?: number; grid?: number } = {}
): BasinGeodata {
  const { zoom = 12, grid = 480 } = options;

  const [dem, setDem] = useState<DEMGrid | null>(null);
  const [hydrography, setHydrography] = useState<HydrographyData | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [sources, setSources] = useState<GeoSource[]>([]);

  const [demPhase, setDemPhase] = useState<Phase>('idle');
  const [hydroPhase, setHydroPhase] = useState<Phase>('idle');
  const [weatherPhase, setWeatherPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progressLabel, setProgressLabel] = useState('Inicializando gemelo digital…');
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce(n => n + 1), []);

  // Serializamos los puntos para que el efecto no se dispare en cada render.
  const pointsKey = JSON.stringify(stationPoints);

  useEffect(() => {
    let cancelled = false;

    // 1. DEM — es lo que bloquea el dibujado del terreno, va primero.
    setDemPhase('loading');
    setProgressLabel('Descargando modelo digital de elevación (SRTM / Copernicus)…');
    getJSON<DEMGrid>(`/api/geo/dem?zoom=${zoom}&grid=${grid}`)
      .then(data => {
        if (cancelled) return;
        setDem(data);
        setDemPhase('ready');
        setProgressLabel('Relieve reconstruido. Cargando red hidrográfica…');
      })
      .catch(err => {
        if (cancelled) return;
        setDemPhase('error');
        setError(`DEM: ${err.message}`);
      });

    // 2. Hidrografía (OSM) — puede tardar más, no debe bloquear al terreno.
    setHydroPhase('loading');
    getJSON<HydrographyData>('/api/geo/hydrography')
      .then(data => {
        if (cancelled) return;
        setHydrography(data);
        setHydroPhase('ready');
      })
      .catch(err => {
        if (cancelled) return;
        setHydroPhase('error');
        console.warn('[GEO] Hidrografía no disponible:', err.message);
      });

    // 3. Catálogo de fuentes activas
    getJSON<{ sources: GeoSource[] }>('/api/geo/sources')
      .then(data => !cancelled && setSources(data.sources))
      .catch(() => undefined);

    // 4. Clima real por estación
    const points = JSON.parse(pointsKey) as Array<{ lat: number; lon: number }>;
    if (points.length > 0) {
      setWeatherPhase('loading');
      getJSON<WeatherData>('/api/geo/weather', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points, pastDays: 60 }),
      })
        .then(data => {
          if (cancelled) return;
          setWeather(data);
          setWeatherPhase('ready');
        })
        .catch(err => {
          if (cancelled) return;
          setWeatherPhase('error');
          console.warn('[GEO] Clima no disponible:', err.message);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [zoom, grid, pointsKey, nonce]);

  return {
    dem,
    hydrography,
    weather,
    sources,
    demPhase,
    hydroPhase,
    weatherPhase,
    error,
    progressLabel,
    reload,
  };
}
