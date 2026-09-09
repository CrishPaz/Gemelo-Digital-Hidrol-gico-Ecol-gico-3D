/**
 * server.ts - Servidor Express Full-Stack para el Gemelo Digital del Río Moche
 * Soporte de API Gemini para el Copiloto Inteligente de Cuenca y middleware Vite.
 */

// Carga las variables de .env antes que cualquier otro módulo.
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import {
  MOCHE_BASIN_BBOX,
  fetchBasinDEM,
  fetchHydrography,
  fetchWeatherForPoints,
  fetchGoogleElevations,
  isGoogleMapsConfigured,
} from './src/server/geodata';

import {
  runWithGemini,
  runDeterministic,
  describeTools,
  type CopilotRequest,
} from './src/server/copilotAgent';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Cliente Gemini Server-Side (Lazy initialization con telemetry header)
  let genAIClient: GoogleGenAI | null = null;
  const getGenAI = (): GoogleGenAI | null => {
    if (!genAIClient && process.env.GEMINI_API_KEY) {
      genAIClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return genAIClient;
  };

  // ----------------------------------------------------
  // RUTAS DE API
  // ----------------------------------------------------

  // Verificación de estado del servidor
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Moche River Digital Twin API',
      timestamp: new Date().toISOString(),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      copilotMode: process.env.GEMINI_API_KEY ? 'gemini_tools' : 'deterministic_engine',
      basinTools: describeTools(),
    });
  });

  // Endpoint del Copiloto Inteligente de Cuenca (AI Decision Support)
  //
  // El copiloto ejecuta los motores deterministas del gemelo a traves del
  // registro de herramientas de src/server/basinTools.ts. Con GEMINI_API_KEY el
  // modelo decide que motores llamar y redacta sobre lo calculado; sin ella, el
  // enrutador determinista ejecuta esos mismos motores y compone el informe.
  // En ambos casos las citas y las acciones salen de lo que se ejecuto.
  app.post('/api/gemini/assist', async (req, res) => {
    try {
      const { prompt, context, specialistMode = 'general', history } = req.body ?? {};

      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({ error: 'Prompt es requerido' });
      }

      const request: CopilotRequest = {
        prompt: prompt.trim(),
        specialistMode,
        context,
        history: Array.isArray(history) ? history : [],
      };

      const ai = getGenAI();
      const result = ai ? await runWithGemini(ai, request) : runDeterministic(request);
      return res.json(result);
    } catch (error: any) {
      console.error('Error en /api/gemini/assist:', error);
      // Si el modelo falla, los motores del gemelo todavia pueden responder con
      // cifras reales. Se degrada la respuesta en lugar de perder el turno.
      try {
        const fallback = runDeterministic({
          prompt: String(req.body?.prompt ?? '').trim() || 'Estado general de la cuenca',
          specialistMode: req.body?.specialistMode ?? 'general',
          context: req.body?.context,
        });
        return res.json({
          ...fallback,
          degraded: true,
          degradedReason: error?.message || String(error),
        });
      } catch {
        return res.status(500).json({
          error: 'Error procesando la consulta con el modelo de IA',
          details: error?.message || String(error),
        });
      }
    }
  });

  // Endpoint para Generación Rápida de Dictámenes y Resoluciones con IA
  app.post('/api/gemini/generate-resolution', async (req, res) => {
    try {
      const { type, entity, caseDetails } = req.body;
      const ai = getGenAI();

      const prompt = `Genera el texto legal y técnico formal completo de una ${type || 'Resolución Directoral'} emitida por ${entity || 'ANA'} para el caso: ${caseDetails || 'Superación de límites ECA en cuenca alta de Quiruvilca y regulación de caudales en estiaje'}. Incluye VISTOS, CONSIDERANDO y SE RESUELVE con articulado formal conforme a la Ley 29338.`;

      if (!ai) {
        return res.json({
          documentText: generateFallbackResolution(type, entity, caseDetails),
          mode: 'expert_rule_engine',
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          systemInstruction: 'Eres un abogado e ingeniero especialista en derecho administrativo de aguas en el Perú. Redacta documentos con la más alta rigurosidad jurídica institucional.',
        },
      });

      return res.json({
        documentText: response.text || 'Documento generado.',
        mode: 'gemini_ai',
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Error generando resolución' });
    }
  });

  // ----------------------------------------------------
  // RUTAS DE GEODATOS REALES (DEM, hidrografía OSM, clima)
  // ----------------------------------------------------

  // Modelo Digital de Elevación real de la cuenca del Moche
  app.get('/api/geo/dem', async (req, res) => {
    try {
      const zoom = Math.min(13, Math.max(9, Number(req.query.zoom) || 12));
      const gridWidth = Math.min(720, Math.max(64, Number(req.query.grid) || 480));
      const dem = await fetchBasinDEM(MOCHE_BASIN_BBOX, zoom, gridWidth);
      res.set('Cache-Control', 'public, max-age=86400');
      res.json(dem);
    } catch (error: any) {
      console.error('[GEO] Error DEM:', error?.message);
      res.status(502).json({ error: error?.message || 'No se pudo obtener el DEM' });
    }
  });

  // Red hidrográfica, cuerpos de agua y localidades reales (OpenStreetMap)
  app.get('/api/geo/hydrography', async (req, res) => {
    try {
      const data = await fetchHydrography(MOCHE_BASIN_BBOX);
      res.set('Cache-Control', 'public, max-age=86400');
      res.json(data);
    } catch (error: any) {
      console.error('[GEO] Error hidrografía:', error?.message);
      res.status(502).json({ error: error?.message || 'No se pudo obtener la hidrografía' });
    }
  });

  // Clima real por estación (precipitación, temperatura, ET0)
  app.post('/api/geo/weather', async (req, res) => {
    try {
      const points = req.body?.points;
      if (!Array.isArray(points) || points.length === 0) {
        return res.status(400).json({ error: 'Se requiere un arreglo "points" con {lat, lon}' });
      }
      const pastDays = Math.min(90, Math.max(1, Number(req.body?.pastDays) || 60));
      const data = await fetchWeatherForPoints(points.slice(0, 25), pastDays);
      res.json(data);
    } catch (error: any) {
      console.error('[GEO] Error clima:', error?.message);
      res.status(502).json({ error: error?.message || 'No se pudo obtener el clima' });
    }
  });

  // Contraste de elevaciones con Google Maps Platform (requiere API key propia)
  app.post('/api/geo/google-elevation', async (req, res) => {
    if (!isGoogleMapsConfigured()) {
      return res.status(503).json({
        error: 'GOOGLE_MAPS_API_KEY no configurada en el servidor',
        hint: 'Añade GOOGLE_MAPS_API_KEY a tu archivo .env para habilitar esta fuente.',
      });
    }
    try {
      const points = req.body?.points;
      if (!Array.isArray(points) || points.length === 0) {
        return res.status(400).json({ error: 'Se requiere un arreglo "points" con {lat, lon}' });
      }
      res.json({ results: await fetchGoogleElevations(points.slice(0, 100)) });
    } catch (error: any) {
      console.error('[GEO] Error Google Elevation:', error?.message);
      res.status(502).json({ error: error?.message || 'Google Elevation API falló' });
    }
  });

  // Estado de las fuentes de datos externas
  app.get('/api/geo/sources', (req, res) => {
    res.json({
      bbox: MOCHE_BASIN_BBOX,
      sources: [
        {
          id: 'dem',
          name: 'AWS Terrain Tiles (Terrarium)',
          detail: 'SRTM · Copernicus GLO-30 · NED',
          kind: 'Modelo Digital de Elevación',
          requiresKey: false,
          enabled: true,
        },
        {
          id: 'osm',
          name: 'OpenStreetMap / Overpass',
          detail: 'Cauces, cuerpos de agua y localidades',
          kind: 'Hidrografía vectorial',
          requiresKey: false,
          enabled: true,
        },
        {
          id: 'open-meteo',
          name: 'Open-Meteo',
          detail: 'Precipitación, temperatura y ET0 (ECMWF/GFS)',
          kind: 'Hidrometeorología',
          requiresKey: false,
          enabled: true,
        },
        {
          id: 'google-maps',
          name: 'Google Maps Platform',
          detail: 'Elevation API — contraste de cotas',
          kind: 'Elevación de contraste',
          requiresKey: true,
          enabled: isGoogleMapsConfigured(),
        },
      ],
    });
  });

  // ----------------------------------------------------
  // VITE MIDDLEWARE (DEV) O SERVIDO ESTÁTICO (PROD)
  // ----------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[HYDROTWIN SERVER] Servidor ejecutándose en http://0.0.0.0:${PORT}`);
  });
}

function generateFallbackResolution(type: string, entity: string, caseDetails: string): string {
  return `RESOLUCIÓN DIRECTORAL N° 0148-2026-ANA-AAA.HC
Trujillo, 26 de agosto de 2026

VISTO:
El Expediente Técnico N° 2026-089-ANA sobre el informe de fiscalización hidrológica y calidad de agua en la cuenca del Río Moche, respecto a: ${caseDetails}; y,

CONSIDERANDO:
Que, el artículo 15 de la Ley de Recursos Hídricos N° 29338 establece que la Autoridad Nacional del Agua es el ente rector y la máxima autoridad técnico-normativa del Sistema Nacional de Gestión de los Recursos Hídricos;

Que, el artículo 79 de la citada Ley prohíbe todo vertimiento de aguas residuales sin la debida autorización de la Autoridad Nacional del Agua y que contravenga los Estándares de Calidad Ambiental (ECA-Agua) aprobados por D.S. N° 004-2017-MINAM;

Que, el Gemelo Digital Hidrológico del Río Moche ha registrado anomalías en la estación Quiruvilca que ameritan la inmediata adopción de medidas preventivas y sancionadoras;

SE RESUELVE:
ARTÍCULO PRIMERO.- DISPONER la ejecución inmediata del Plan de Contingencia Hidrogeoquímica en la cuenca alta del Río Moche.
ARTÍCULO SEGUNDO.- ORDENAR a los usuarios del Valle Santa Catalina el ajuste estricto de compuertas para garantizar el Caudal Ecológico de 1.65 m³/s.
ARTÍCULO TERCERO.- REMITIR lo actuado al Organismo de Evaluación y Fiscalización Ambiental (OEFA) para las acciones de su competencia.

Regístrese, comuníquese y publíquese.

AUTORIDAD ADMINISTRATIVA DEL AGUA HUARMEY-CHICAMA
AUTORIDAD NACIONAL DEL AGUA`;
}

startServer();
