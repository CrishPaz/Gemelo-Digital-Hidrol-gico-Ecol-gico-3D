/**
 * basinTools.ts - Registro de herramientas del Copiloto Inteligente de Cuenca
 *
 * Expone los motores deterministas del gemelo (GR4J, EnKF, WQI, hidrodinámica,
 * asignación de caudales y caudal ecológico) como herramientas invocables, de
 * modo que el copiloto **calcule** en lugar de redactar cifras plausibles.
 *
 * El registro es agnóstico del proveedor: `toGeminiDeclarations()` lo traduce al
 * formato de @google/genai, y el enrutador determinista de `copilotAgent.ts` lo
 * recorre sin modelo alguno cuando no hay API key.
 *
 * Cada herramienta declara, además de su esquema:
 *  - `citations`: las normas que su resultado realmente implica.
 *  - `actions`:   las vistas del gemelo que su resultado justifica abrir.
 * Ambas cosas se derivan de qué se ejecutó, no de buscar subcadenas en la
 * respuesta del modelo, que es lo que producía citas y botones fuera de lugar.
 */

import { Type, type FunctionDeclaration, type Schema } from '@google/genai';

import { runGR4JSimulation, DEFAULT_MOCHE_GR4J_PARAMS } from '../services/hydroEngine';
import { runEnKFAssimilation, calculateHydroMetrics } from '../services/enkfEngine';
import { calculateWQI, type WaterQualityInput } from '../services/waterQualityEngine';
import {
  computeHydraulicProfile,
  optimizeWaterAllocation,
  simulateHeavyMetalsTransport,
} from '../services/hydrodynamicsEngine';
import { calculateTennantFlows, evaluateEFlowCompliance } from '../services/eflowEngine';
import { MOCHE_MONITORING_STATIONS, PERU_ECA_AGUA_STANDARDS } from '../data/mocheBasinData';

// ----------------------------------------------------------------------------
// Catálogo normativo
// ----------------------------------------------------------------------------
// Antes se anexaban las mismas cuatro normas a toda respuesta. Aquí cada norma
// se cita solo si la herramienta que la invoca llegó a ejecutarse.
export const NORMS = {
  ECA: 'D.S. N° 004-2017-MINAM — Estándares de Calidad Ambiental (ECA) para Agua',
  LRH: 'Ley N° 29338 — Ley de Recursos Hídricos y su Reglamento (D.S. N° 001-2010-AG)',
  QECO: 'R.J. N° 055-2022-ANA — Metodología para la Determinación de Caudales Ecológicos',
  PGRHC: 'Plan de Gestión de Recursos Hídricos de la Cuenca Moche (PGRHC Moche)',
  SINAGERD: 'Ley N° 29664 — SINAGERD; protocolos INDECI / COER La Libertad',
  PAMA: 'D.S. N° 040-2014-EM — Reglamento de Protección Ambiental en Actividades Mineras',
} as const;

export type ToolAction = {
  id: string;
  label: string;
  actionType: 'navigate_tab' | 'run_simulation' | 'open_station' | 'download_dossier' | 'trigger_alert';
  targetTab?: string;
  payload?: unknown;
};

export interface BasinTool {
  name: string;
  description: string;
  parameters?: Schema;
  citations: string[];
  actions: ToolAction[];
  /** Devuelve un resumen legible y los datos crudos que se envían al modelo. */
  execute: (args: Record<string, any>) => { summary: string; data: unknown };
}

const num = (n: number, d = 2) => Number(n.toFixed(d));

// ----------------------------------------------------------------------------
// 1. Estado real de la cuenca
// ----------------------------------------------------------------------------
// Sustituye al bloque de contexto que estaba escrito a mano en server.ts, con
// valores literales como 6.45 m3/s que no cambiaban nunca.
const consultarEstadoCuenca: BasinTool = {
  name: 'consultar_estado_cuenca',
  description:
    'Devuelve el estado actual observado de la cuenca del Moche a partir de la red de estaciones de monitoreo: caudal, WQI, pH, plomo, incumplimientos ECA por estación y agregados por subcuenca. Úsala SIEMPRE antes de dar cifras del estado presente.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      subcuenca: {
        type: Type.STRING,
        description: 'Filtro opcional por subcuenca.',
        enum: ['Cuenca Alta (Cabecera)', 'Cuenca Media (Valles)', 'Cuenca Baja (Desembocadura)'],
      },
    },
  },
  citations: [NORMS.ECA, NORMS.PGRHC],
  actions: [
    { id: 'act-telemetry', label: 'Ver Telemetría IoT en Tiempo Real', actionType: 'navigate_tab', targetTab: 'telemetry' },
  ],
  execute: ({ subcuenca }) => {
    const stations = subcuenca
      ? MOCHE_MONITORING_STATIONS.filter(s => s.subbasin === subcuenca)
      : MOCHE_MONITORING_STATIONS;

    if (!stations.length) {
      return { summary: `No hay estaciones registradas para "${subcuenca}".`, data: { stations: [] } };
    }

    const mean = (pick: (s: (typeof stations)[number]) => number) =>
      num(stations.reduce((a, s) => a + pick(s), 0) / stations.length);

    const nonCompliant = stations.filter(s => !s.ecaCompliance.isCompliant);
    const detail = stations.map(s => ({
      estacion: s.name,
      subcuenca: s.subbasin,
      caudal_m3s: s.currentValues.discharge,
      wqi: s.currentValues.wqi,
      ph: s.currentValues.ph,
      plomo_mgL: s.currentValues.heavy_metals_lead,
      cumple_eca: s.ecaCompliance.isCompliant,
      parametros_excedidos: s.ecaCompliance.violatedParameters,
    }));

    const summary =
      `Estado observado en ${stations.length} estaciones` +
      (subcuenca ? ` de ${subcuenca}` : '') +
      `: caudal medio ${mean(s => s.currentValues.discharge)} m3/s, WQI medio ${mean(s => s.currentValues.wqi)}/100, ` +
      `pH medio ${mean(s => s.currentValues.ph)}. ${nonCompliant.length} estaciones incumplen el ECA` +
      (nonCompliant.length ? `: ${nonCompliant.map(s => s.name).join(', ')}.` : '.');

    return {
      summary,
      data: {
        n_estaciones: stations.length,
        caudal_medio_m3s: mean(s => s.currentValues.discharge),
        wqi_medio: mean(s => s.currentValues.wqi),
        ph_medio: mean(s => s.currentValues.ph),
        plomo_medio_mgL: num(stations.reduce((a, s) => a + s.currentValues.heavy_metals_lead, 0) / stations.length, 4),
        estaciones_no_conformes: nonCompliant.length,
        estaciones: detail,
      },
    };
  },
};

// ----------------------------------------------------------------------------
// 2. Simulación lluvia-escorrentía GR4J
// ----------------------------------------------------------------------------
const simularCaudalGR4J: BasinTool = {
  name: 'simular_caudal_gr4j',
  description:
    'Ejecuta el modelo hidrológico GR4J calibrado para la cuenca del Moche (2708 km2) y devuelve la serie de caudales simulados. Úsala para responder escenarios del tipo "qué pasa si llueve X mm" o para proyectar crecidas y estiajes.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      precipitacion_mm_dia: {
        type: Type.ARRAY,
        items: { type: Type.NUMBER },
        description: 'Serie diaria de precipitación en mm. Un valor por día.',
      },
      evapotranspiracion_mm_dia: {
        type: Type.ARRAY,
        items: { type: Type.NUMBER },
        description: 'Serie diaria de ET0 en mm. Opcional; si se omite se usa 3.5 mm/dia, media de la cuenca.',
      },
      humedad_inicial: {
        type: Type.NUMBER,
        description: 'Fracción de llenado inicial de los almacenamientos, 0 a 1. Por defecto 0.5.',
      },
    },
    required: ['precipitacion_mm_dia'],
  },
  citations: [NORMS.PGRHC],
  actions: [
    { id: 'act-enkf', label: 'Ver Modelo Hidrológico GR4J y Asimilación', actionType: 'navigate_tab', targetTab: 'hydro_enkf' },
    { id: 'act-scenarios', label: 'Abrir Escenarios What-If', actionType: 'navigate_tab', targetTab: 'scenarios' },
  ],
  execute: ({ precipitacion_mm_dia, evapotranspiracion_mm_dia, humedad_inicial }) => {
    const p: number[] = (precipitacion_mm_dia || []).map(Number).filter((v: number) => Number.isFinite(v));
    if (!p.length) throw new Error('precipitacion_mm_dia debe traer al menos un valor numérico.');

    const pet: number[] = Array.isArray(evapotranspiracion_mm_dia) && evapotranspiracion_mm_dia.length
      ? p.map((_, i) => Number(evapotranspiracion_mm_dia[i] ?? 3.5))
      : p.map(() => 3.5);

    const q = runGR4JSimulation(p, pet, DEFAULT_MOCHE_GR4J_PARAMS, humedad_inicial ?? 0.5);
    const qMax = Math.max(...q);
    const diaPico = q.indexOf(qMax) + 1;

    return {
      summary:
        `GR4J sobre ${p.length} días (P total ${num(p.reduce((a, b) => a + b, 0), 1)} mm): ` +
        `caudal pico ${num(qMax)} m3/s el día ${diaPico}, caudal medio ${num(q.reduce((a, b) => a + b, 0) / q.length)} m3/s, ` +
        `caudal final ${num(q[q.length - 1])} m3/s.`,
      data: {
        parametros: DEFAULT_MOCHE_GR4J_PARAMS,
        caudal_simulado_m3s: q,
        caudal_pico_m3s: num(qMax),
        dia_pico: diaPico,
        caudal_medio_m3s: num(q.reduce((a, b) => a + b, 0) / q.length),
      },
    };
  },
};

// ----------------------------------------------------------------------------
// 3. Calidad de agua (WQI) y contraste ECA
// ----------------------------------------------------------------------------
const evaluarCalidadAgua: BasinTool = {
  name: 'evaluar_calidad_agua_wqi',
  description:
    'Calcula el Índice de Calidad de Agua (WQI) ponderado a partir de parámetros fisicoquímicos y lo contrasta con los ECA Categoría 3 (riego) y Categoría 4 (ecosistemas) del D.S. 004-2017-MINAM.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      do: { type: Type.NUMBER, description: 'Oxígeno disuelto, mg/L' },
      ph: { type: Type.NUMBER, description: 'pH' },
      ec: { type: Type.NUMBER, description: 'Conductividad eléctrica, uS/cm' },
      turbidity: { type: Type.NUMBER, description: 'Turbidez, NTU' },
      tss: { type: Type.NUMBER, description: 'Sólidos suspendidos totales, mg/L' },
      nitrates: { type: Type.NUMBER, description: 'Nitratos NO3-, mg/L' },
      total_p: { type: Type.NUMBER, description: 'Fósforo total, mg/L' },
      fecal_coliforms: { type: Type.NUMBER, description: 'Coliformes fecales, NMP/100 mL' },
      heavy_metals_lead: { type: Type.NUMBER, description: 'Plomo total, mg/L' },
      estacion: {
        type: Type.STRING,
        description: 'Nombre de estación para tomar sus valores medidos en lugar de indicarlos uno a uno.',
      },
    },
  },
  citations: [NORMS.ECA, NORMS.LRH],
  actions: [
    { id: 'act-telemetry', label: 'Ver Telemetría y Validación de Datos', actionType: 'navigate_tab', targetTab: 'telemetry' },
    { id: 'act-dashboard', label: 'Ver Tablero Ejecutivo de Cuenca', actionType: 'navigate_tab', targetTab: 'dashboard' },
  ],
  execute: args => {
    let input: WaterQualityInput;
    let origen = 'valores indicados';

    if (args.estacion) {
      const needle = String(args.estacion).toLowerCase();
      const st = MOCHE_MONITORING_STATIONS.find(s => s.name.toLowerCase().includes(needle));
      if (!st) throw new Error(`Estación "${args.estacion}" no encontrada en la red de monitoreo.`);
      input = { ...st.currentValues };
      origen = `valores medidos en ${st.name}`;
    } else {
      input = {
        do: args.do ?? 7.0,
        ph: args.ph ?? 7.2,
        ec: args.ec ?? 800,
        turbidity: args.turbidity ?? 20,
        tss: args.tss ?? 30,
        nitrates: args.nitrates ?? 5,
        total_p: args.total_p ?? 0.1,
        fecal_coliforms: args.fecal_coliforms ?? 200,
        heavy_metals_lead: args.heavy_metals_lead ?? 0.002,
      };
    }

    const wqi = calculateWQI(input);
    const c3 = PERU_ECA_AGUA_STANDARDS.category3_irrigation;
    const c4 = PERU_ECA_AGUA_STANDARDS.category4_ecosystem;

    const excedencias: string[] = [];
    if (input.ph < c3.ph_min || input.ph > c3.ph_max) excedencias.push(`pH ${input.ph} fuera del rango Cat 3 (${c3.ph_min}-${c3.ph_max})`);
    if (input.do < c3.do_min) excedencias.push(`OD ${input.do} mg/L bajo el mínimo Cat 3 (${c3.do_min})`);
    if ((input.heavy_metals_lead ?? 0) > c3.lead_max) excedencias.push(`Pb ${input.heavy_metals_lead} mg/L supera Cat 3 (${c3.lead_max})`);
    if ((input.heavy_metals_lead ?? 0) > c4.lead_max) excedencias.push(`Pb ${input.heavy_metals_lead} mg/L supera Cat 4 (${c4.lead_max})`);
    if (input.fecal_coliforms > c3.fecal_coliforms_max) excedencias.push(`Coliformes ${input.fecal_coliforms} NMP/100mL superan Cat 3 (${c3.fecal_coliforms_max})`);
    if (input.nitrates > c4.nitrates_max) excedencias.push(`Nitratos ${input.nitrates} mg/L superan Cat 4 (${c4.nitrates_max})`);

    return {
      summary:
        `WQI ${wqi.score}/100 (${wqi.classification}) con ${origen}. ` +
        (excedencias.length ? `${excedencias.length} excedencias ECA: ${excedencias.join('; ')}.` : 'Sin excedencias ECA en los parámetros evaluados.'),
      data: { entrada: input, origen, wqi, excedencias_eca: excedencias },
    };
  },
};

// ----------------------------------------------------------------------------
// 4. Transporte de metales pesados y remediación
// ----------------------------------------------------------------------------
const simularTransporteMetales: BasinTool = {
  name: 'simular_transporte_metales',
  description:
    'Simula la dispersión longitudinal de Pb, As, Cd y Fe desde los pasivos mineros de Quiruvilca/Shorey a lo largo del río, con atenuación y dilución, bajo un porcentaje de remediación dado. Úsala para dimensionar tratamiento de drenaje ácido de mina.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      eficiencia_remediacion_pct: {
        type: Type.NUMBER,
        description: 'Eficiencia del tratamiento del efluente minero en cabecera, 0 a 100. Por defecto 0 (sin tratamiento).',
      },
      multiplicador_dilucion: {
        type: Type.NUMBER,
        description: 'Factor de caudal de dilución respecto al actual. 1.0 = caudal actual, 2.0 = el doble.',
      },
    },
  },
  citations: [NORMS.ECA, NORMS.PAMA, NORMS.LRH],
  actions: [
    { id: 'act-metals', label: 'Ver Dispersión de Metales Pesados en Cuenca', actionType: 'navigate_tab', targetTab: 'heavy_metals' },
    { id: 'act-scada', label: 'Operar Compuertas en Módulo SCADA', actionType: 'navigate_tab', targetTab: 'scada_infra' },
  ],
  execute: ({ eficiencia_remediacion_pct, multiplicador_dilucion }) => {
    const eff = Math.max(0, Math.min(100, Number(eficiencia_remediacion_pct ?? 0)));
    const dil = Math.max(0.1, Number(multiplicador_dilucion ?? 1.0));
    const profile = simulateHeavyMetalsTransport(eff, dil);

    const criticos = profile.filter(p => p.status === 'Superación Crítica ECA');
    const maxPb = Math.max(...profile.map(p => p.leadPb_mgL));

    return {
      summary:
        `Con ${eff}% de remediación y dilución ${dil}x: Pb máximo ${maxPb} mg/L, ` +
        `${criticos.length} de ${profile.length} puntos en superación crítica del ECA` +
        (criticos.length ? ` (${criticos.map(c => c.locationName).join(', ')}).` : '.'),
      data: { eficiencia_remediacion_pct: eff, multiplicador_dilucion: dil, perfil: profile },
    };
  },
};

// ----------------------------------------------------------------------------
// 5. Perfil hidráulico y desborde
// ----------------------------------------------------------------------------
const calcularPerfilHidraulico: BasinTool = {
  name: 'calcular_perfil_hidraulico',
  description:
    'Calcula el perfil hidráulico del cauce por inversión de Manning para un caudal base dado: tirante, nivel de agua y riesgo de desborde en cada sección transversal del Moche. Úsala para crecidas, FEN y rotura de presa.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      caudal_base_m3s: { type: Type.NUMBER, description: 'Caudal base en la cabecera, m3/s.' },
      escala_manning: { type: Type.NUMBER, description: 'Factor sobre la rugosidad n de Manning. 1.0 = calibrado.' },
    },
    required: ['caudal_base_m3s'],
  },
  citations: [NORMS.SINAGERD, NORMS.PGRHC],
  actions: [
    { id: 'act-hydro', label: 'Ver Simulación Hidrodinámica 2D y Dam-Break', actionType: 'navigate_tab', targetTab: 'hydrodynamics' },
    { id: 'act-sat', label: 'Ver Sistema de Alerta Temprana y Sirenas', actionType: 'navigate_tab', targetTab: 'sat_early_warning' },
  ],
  execute: ({ caudal_base_m3s, escala_manning }) => {
    const q = Number(caudal_base_m3s);
    if (!Number.isFinite(q) || q < 0) throw new Error('caudal_base_m3s debe ser un número no negativo.');
    const profile = computeHydraulicProfile(q, Number(escala_manning ?? 1.0));

    const enRiesgo = profile.filter(s => s.isOverbankFlooded || s.floodRiskLevel === "Alto" || s.floodRiskLevel === "Extremo");
    const tiranteMax = Math.max(...profile.map(s => s.waterDepthM));

    return {
      summary:
        `Perfil para ${q} m3/s en cabecera: tirante máximo ${num(tiranteMax)} m en ${profile.length} secciones` +
        (enRiesgo.length ? `; ${enRiesgo.length} secciones con riesgo de desborde.` : '; sin secciones en desborde.'),
      data: { caudal_base_m3s: q, secciones: profile },
    };
  },
};

// ----------------------------------------------------------------------------
// 6. Asignación de caudales en estiaje
// ----------------------------------------------------------------------------
const optimizarAsignacion: BasinTool = {
  name: 'optimizar_asignacion_caudal',
  description:
    'Reparte un caudal disponible entre los sectores de demanda respetando el orden de prioridad de la Ley 29338: ecológico, poblacional, agrario e industrial/minero. Devuelve la asignación y la maniobra de compuerta que corresponde a cada bocatoma.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      caudal_disponible_m3s: { type: Type.NUMBER, description: 'Caudal disponible en el río, m3/s.' },
    },
    required: ['caudal_disponible_m3s'],
  },
  citations: [NORMS.LRH, NORMS.QECO, NORMS.PGRHC],
  actions: [
    { id: 'act-allocation', label: 'Ver Asignación y Balance Hídrico', actionType: 'navigate_tab', targetTab: 'allocation' },
    { id: 'act-scada', label: 'Operar Compuertas en Módulo SCADA', actionType: 'navigate_tab', targetTab: 'scada_infra' },
  ],
  execute: ({ caudal_disponible_m3s }) => {
    const q = Number(caudal_disponible_m3s);
    if (!Number.isFinite(q) || q < 0) throw new Error('caudal_disponible_m3s debe ser un número no negativo.');
    const sectors = optimizeWaterAllocation(q);

    const deficitarios = sectors.filter(s => s.satisfactionRatePercent < 100);
    return {
      summary:
        `Con ${q} m3/s disponibles: ${sectors.length} sectores atendidos, ` +
        (deficitarios.length
          ? `${deficitarios.length} con déficit (${deficitarios.map(s => `${s.name} ${s.satisfactionRatePercent}%`).join(', ')}).`
          : 'todos al 100% de su demanda.'),
      data: { caudal_disponible_m3s: q, sectores: sectors },
    };
  },
};

// ----------------------------------------------------------------------------
// 7. Caudal ecológico
// ----------------------------------------------------------------------------
const evaluarCaudalEcologico: BasinTool = {
  name: 'evaluar_caudal_ecologico',
  description:
    'Evalúa el cumplimiento del caudal ecológico comparando el caudal actual con los umbrales de Tennant (Montana) derivados del caudal medio anual, conforme a la R.J. 055-2022-ANA.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      caudal_actual_m3s: { type: Type.NUMBER, description: 'Caudal actual observado, m3/s.' },
      caudal_medio_anual_m3s: { type: Type.NUMBER, description: 'Caudal medio anual (MAF) de referencia, m3/s. Por defecto 8.2.' },
      temporada_humeda: { type: Type.BOOLEAN, description: 'true si se evalúa en avenida, false en estiaje.' },
    },
    required: ['caudal_actual_m3s'],
  },
  citations: [NORMS.QECO, NORMS.LRH],
  actions: [
    { id: 'act-eflow', label: 'Ver Caudal Ecológico y Curvas de Duración', actionType: 'navigate_tab', targetTab: 'eflow' },
  ],
  execute: ({ caudal_actual_m3s, caudal_medio_anual_m3s, temporada_humeda }) => {
    const q = Number(caudal_actual_m3s);
    if (!Number.isFinite(q)) throw new Error('caudal_actual_m3s debe ser numérico.');
    const maf = Number(caudal_medio_anual_m3s ?? 8.2);
    const tennant = calculateTennantFlows(maf, Boolean(temporada_humeda));
    const required = (tennant as any).fairMinimum ?? (tennant as any).good ?? maf * 0.3;
    const compliance = evaluateEFlowCompliance(q, required);

    return {
      summary:
        `Caudal actual ${q} m3/s frente a un mínimo Tennant de ${required} m3/s (MAF ${maf} m3/s): ` +
        `${compliance.status}.`,
      data: { caudal_actual_m3s: q, caudal_medio_anual_m3s: maf, umbrales_tennant: tennant, cumplimiento: compliance },
    };
  },
};

// ----------------------------------------------------------------------------
// 8. Asimilación de datos EnKF
// ----------------------------------------------------------------------------
const asimilarEnKF: BasinTool = {
  name: 'asimilar_datos_enkf',
  description:
    'Ejecuta el Filtro de Kalman por Ensambles sobre GR4J, corrigiendo la simulación con caudales observados. Devuelve las métricas de desempeño Nash-Sutcliffe, KGE y RMSE antes y después de asimilar. Úsala para justificar la confianza del gemelo.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      precipitacion_mm_dia: { type: Type.ARRAY, items: { type: Type.NUMBER }, description: 'Serie diaria de precipitación, mm.' },
      caudal_observado_m3s: { type: Type.ARRAY, items: { type: Type.NUMBER }, description: 'Serie diaria de caudal observado, m3/s. Misma longitud que la precipitación.' },
      evapotranspiracion_mm_dia: { type: Type.ARRAY, items: { type: Type.NUMBER }, description: 'Serie diaria de ET0, mm. Opcional.' },
    },
    required: ['precipitacion_mm_dia', 'caudal_observado_m3s'],
  },
  citations: [NORMS.PGRHC],
  actions: [
    { id: 'act-enkf', label: 'Ver Asimilación EnKF y Bandas de Incertidumbre', actionType: 'navigate_tab', targetTab: 'hydro_enkf' },
    { id: 'act-calibration', label: 'Ver Calibración del Modelo', actionType: 'navigate_tab', targetTab: 'calibration' },
  ],
  execute: ({ precipitacion_mm_dia, caudal_observado_m3s, evapotranspiracion_mm_dia }) => {
    const p: number[] = (precipitacion_mm_dia || []).map(Number);
    const obs: number[] = (caudal_observado_m3s || []).map(Number);
    if (p.length < 2 || obs.length < 2) throw new Error('Se requieren al menos dos pasos de tiempo.');
    if (p.length !== obs.length) throw new Error(`Longitudes distintas: precipitación ${p.length}, observado ${obs.length}.`);

    const pet = Array.isArray(evapotranspiracion_mm_dia) && evapotranspiracion_mm_dia.length
      ? p.map((_, i) => Number(evapotranspiracion_mm_dia[i] ?? 3.5))
      : p.map(() => 3.5);
    const dates = p.map((_, i) => `t+${i}`);

    const result = runEnKFAssimilation(dates, p, pet, obs);
    const prior = calculateHydroMetrics(obs, result.simulatedPriorDischarge);
    const post = calculateHydroMetrics(obs, result.simulatedPosteriorDischarge);

    return {
      summary:
        `EnKF sobre ${p.length} pasos: NSE ${prior.nse} -> ${post.nse}, ` +
        `KGE ${prior.kge} -> ${post.kge}, RMSE ${prior.rmse} -> ${post.rmse} m3/s.`,
      data: {
        metricas_sin_asimilar: prior,
        metricas_asimiladas: post,
        caudal_posterior_m3s: result.simulatedPosteriorDischarge,
        banda_p10: result.boundsP10,
        banda_p90: result.boundsP90,
      },
    };
  },
};

// ----------------------------------------------------------------------------
// 9. Consulta normativa ECA
// ----------------------------------------------------------------------------
const consultarECA: BasinTool = {
  name: 'consultar_estandares_eca',
  description:
    'Devuelve los valores límite del D.S. 004-2017-MINAM para las Categorías 3 (riego y bebida de animales) y 4 (conservación del ambiente acuático). Úsala antes de afirmar que un parámetro cumple o incumple.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      categoria: { type: Type.STRING, description: 'Categoría a consultar.', enum: ['3', '4', 'ambas'] },
    },
  },
  citations: [NORMS.ECA],
  actions: [
    { id: 'act-reports', label: 'Ver Expedientes Técnicos y Normativa', actionType: 'navigate_tab', targetTab: 'reports' },
  ],
  execute: ({ categoria }) => {
    const cat = String(categoria ?? 'ambas');
    const data =
      cat === '3'
        ? { category3_irrigation: PERU_ECA_AGUA_STANDARDS.category3_irrigation }
        : cat === '4'
          ? { category4_ecosystem: PERU_ECA_AGUA_STANDARDS.category4_ecosystem }
          : PERU_ECA_AGUA_STANDARDS;

    return { summary: `Estándares ECA solicitados (categoría ${cat}) del D.S. 004-2017-MINAM.`, data };
  },
};

// ----------------------------------------------------------------------------
// Registro
// ----------------------------------------------------------------------------
export const BASIN_TOOLS: BasinTool[] = [
  consultarEstadoCuenca,
  simularCaudalGR4J,
  evaluarCalidadAgua,
  simularTransporteMetales,
  calcularPerfilHidraulico,
  optimizarAsignacion,
  evaluarCaudalEcologico,
  asimilarEnKF,
  consultarECA,
];

const BY_NAME = new Map(BASIN_TOOLS.map(t => [t.name, t]));

export function getTool(name: string): BasinTool | undefined {
  return BY_NAME.get(name);
}

/** Traduce el registro al formato de declaración de funciones de @google/genai. */
export function toGeminiDeclarations(): FunctionDeclaration[] {
  return BASIN_TOOLS.map(t => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}

export interface ToolRun {
  name: string;
  args: Record<string, any>;
  ok: boolean;
  summary: string;
  data?: unknown;
  error?: string;
}

/** Ejecuta una herramienta capturando el fallo como dato, para devolvérselo al modelo. */
export function runTool(name: string, args: Record<string, any> = {}): ToolRun {
  const tool = BY_NAME.get(name);
  if (!tool) {
    return { name, args, ok: false, summary: `Herramienta desconocida: ${name}`, error: 'unknown_tool' };
  }
  try {
    const { summary, data } = tool.execute(args || {});
    return { name, args, ok: true, summary, data };
  } catch (err: any) {
    const msg = err?.message || String(err);
    return { name, args, ok: false, summary: `La herramienta ${name} falló: ${msg}`, error: msg };
  }
}

/** Citas y acciones derivadas de lo que realmente se ejecutó con éxito. */
export function collectCitations(runs: ToolRun[]): string[] {
  const out = new Set<string>();
  for (const r of runs) {
    if (!r.ok) continue;
    BY_NAME.get(r.name)?.citations.forEach(c => out.add(c));
  }
  return [...out];
}

export function collectActions(runs: ToolRun[]): ToolAction[] {
  const out = new Map<string, ToolAction>();
  for (const r of runs) {
    if (!r.ok) continue;
    BY_NAME.get(r.name)?.actions.forEach(a => out.set(a.id, a));
  }
  return [...out.values()];
}
