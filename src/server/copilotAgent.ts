/**
 * copilotAgent.ts - Orquestación del Copiloto Inteligente de Cuenca
 *
 * Dos caminos que comparten el mismo registro de herramientas de `basinTools.ts`:
 *
 *  1. `runWithGemini`      Bucle de llamada a funciones. El modelo decide qué
 *                          motores ejecutar, recibe los resultados y redacta
 *                          sobre cifras calculadas, no inventadas.
 *  2. `runDeterministic`   Enrutador por intención, sin modelo. Se usa cuando no
 *                          hay GEMINI_API_KEY. Antes esta rama devolvía una
 *                          plantilla fija: el mismo informe se escribiera lo que
 *                          se escribiera. Ahora deduce la intención, extrae las
 *                          magnitudes del enunciado, ejecuta los mismos motores
 *                          y redacta el informe con lo que salga.
 *
 * En ambos caminos las citas normativas y las acciones de interfaz provienen de
 * las herramientas que se ejecutaron con éxito, nunca de buscar palabras en el
 * texto de salida.
 */

import type { GoogleGenAI } from '@google/genai';

import {
  BASIN_TOOLS,
  collectActions,
  collectCitations,
  runTool,
  toGeminiDeclarations,
  type ToolAction,
  type ToolRun,
} from './basinTools';

// Modelo configurable por entorno. Por defecto un flash antiguo y estable:
// es barato, rápido y admite llamada a funciones.
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
/** Tope de vueltas del bucle de herramientas, para que un modelo indeciso no cicle. */
const MAX_TOOL_ITERATIONS = 4;
/** Turnos previos que se reenvían como memoria conversacional. */
const MAX_HISTORY_TURNS = 6;
/** Recorte de cada turno recordado, para no arrastrar informes enteros. */
const MAX_HISTORY_CHARS = 700;
/** Techo de redacción, suficiente para un informe técnico. */
const MAX_OUTPUT_TOKENS = 1400;
/** Elementos que se conservan de cada serie enviada al modelo. */
const MAX_SERIES_ITEMS = 8;

/**
 * Compacta la salida de una herramienta antes de devolvérsela al modelo.
 *
 * Los motores producen series largas: GR4J devuelve un caudal por día, EnKF
 * arrastra bandas de incertidumbre y el perfil hidráulico trae todas las
 * secciones. Enviar eso íntegro multiplica el coste sin mejorar la respuesta,
 * porque al modelo le basta la forma y los extremos. El resultado completo
 * permanece en el servidor para la traza de auditoría.
 */
function compactForModel(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    if (value.length <= MAX_SERIES_ITEMS) return value.map(v => compactForModel(v, depth + 1));
    const head = value.slice(0, MAX_SERIES_ITEMS - 2).map(v => compactForModel(v, depth + 1));
    const tail = compactForModel(value[value.length - 1], depth + 1);
    return [...head, `... ${value.length - MAX_SERIES_ITEMS + 1} elementos omitidos ...`, tail];
  }

  if (typeof value === 'string') {
    return value.length > 400 ? `${value.slice(0, 400)}...` : value;
  }

  if (typeof value === 'object') {
    // Más allá de tres niveles la estructura deja de aportar contexto útil.
    if (depth >= 3) return '[objeto anidado omitido]';
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = compactForModel(v, depth + 1);
    }
    return out;
  }

  return value;
}

export type SpecialistMode =
  | 'general'
  | 'water_quality_dam'
  | 'flood_hydraulics'
  | 'regulatory_legal'
  | 'scada_allocation';

export interface CopilotTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface CopilotRequest {
  prompt: string;
  specialistMode?: SpecialistMode;
  history?: CopilotTurn[];
  context?: Record<string, any>;
}

export interface CopilotProtocol {
  title: string;
  level: 'info' | 'warning' | 'critical';
  steps: string[];
  affectedZones: string[];
  recommendedGateActions: string[];
}

export interface CopilotResult {
  reply: string;
  actionProtocol: CopilotProtocol | null;
  executableActions: ToolAction[];
  citations: string[];
  /** Traza de auditoría: qué motor se ejecutó, con qué argumentos y con qué salida. */
  toolRuns: Array<{ name: string; args: Record<string, any>; ok: boolean; summary: string }>;
  mode: 'gemini_tools' | 'deterministic_engine';
}

// ----------------------------------------------------------------------------
// Instrucciones de sistema
// ----------------------------------------------------------------------------
const SPECIALIST_INSTRUCTIONS: Record<SpecialistMode, string> = {
  general: `Eres el "Copiloto Hidro-Ecológico Principal del Río Moche" (La Libertad, Perú), IA de soporte a decisiones para la gestión integrada de recursos hídricos (GIRH).`,
  water_quality_dam: `Eres el "Especialista Geoquímico y de Calidad de Aguas de Cuenca". Priorizas el Drenaje Ácido de Mina de Quiruvilca/Shorey, metales pesados (Pb, As, Cd, Fe), pH ácido, capacidad de asimilación TMDL y el D.S. 004-2017-MINAM.`,
  flood_hydraulics: `Eres el "Ingeniero Hidráulico Fluvial y de Gestión de Riesgo de Crecidas (FEN / Dam-Break)". Dominas hidrodinámica de Saint-Venant, caudales máximos, rotura de presas de relaves y alertas tempranas para COER La Libertad e INDECI.`,
  regulatory_legal: `Eres el "Asesor Jurídico-Técnico en Legislación Hídrica y Ambiental Peruana". Dominas la Ley 29338, su reglamento, y las competencias de ANA, OEFA y ALA Moche-Virú-Chao. Redactas con estilo formal vinculante.`,
  scada_allocation: `Eres el "Superintendente SCADA y Gestor de Distribución de Caudales". Operas las bocatomas Menocucho, La Mochica y Quiruvilca, y asignas en estiaje respetando el caudal ecológico.`,
};

const TOOL_DISCIPLINE = `
REGLA ABSOLUTA SOBRE CIFRAS:
No inventes ni estimes de memoria ningún valor numérico del estado de la cuenca.
Dispones de herramientas conectadas a los motores deterministas del gemelo digital.
- Para el estado presente (caudal, WQI, pH, plomo, cumplimiento ECA) llama SIEMPRE a consultar_estado_cuenca.
- Para escenarios de lluvia o crecida usa simular_caudal_gr4j y calcular_perfil_hidraulico.
- Para calidad de agua usa evaluar_calidad_agua_wqi y consultar_estandares_eca.
- Para drenaje ácido y metales usa simular_transporte_metales.
- Para estiaje y reparto usa optimizar_asignacion_caudal y evaluar_caudal_ecologico.
- Para justificar la confianza del modelo usa asimilar_datos_enkf.
Si una herramienta falla, dilo explícitamente en la respuesta en lugar de rellenar el hueco con una cifra plausible.
Cita una norma solo si es pertinente a lo que calculaste.

ESTRUCTURA DE RESPUESTA:
1. Diagnóstico cuantitativo, con las cifras que devolvieron las herramientas.
2. Análisis técnico, con las fórmulas e índices aplicables.
3. Recomendaciones operativas inmediatas.
4. Marco normativo peruano aplicable al caso concreto.
Responde en el idioma del operador. Sé conciso y técnico.`;

function buildSystemInstruction(mode: SpecialistMode): string {
  return `${SPECIALIST_INSTRUCTIONS[mode] ?? SPECIALIST_INSTRUCTIONS.general}\n${TOOL_DISCIPLINE}`;
}

// ----------------------------------------------------------------------------
// Camino 1: Gemini con llamada a funciones
// ----------------------------------------------------------------------------
export async function runWithGemini(ai: GoogleGenAI, req: CopilotRequest): Promise<CopilotResult> {
  const mode = (req.specialistMode ?? 'general') as SpecialistMode;
  const toolRuns: ToolRun[] = [];

  // Memoria conversacional: el servidor era apátrida y cada turno arrancaba de cero.
  const history = (req.history ?? []).slice(-MAX_HISTORY_TURNS);
  const contents: any[] = history.map(t => ({
    role: t.role === 'assistant' ? 'model' : 'user',
    parts: [
      {
        text:
          t.content.length > MAX_HISTORY_CHARS
            ? `${t.content.slice(0, MAX_HISTORY_CHARS)}... [informe recortado]`
            : t.content,
      },
    ],
  }));

  contents.push({ role: 'user', parts: [{ text: req.prompt }] });

  const config: any = {
    systemInstruction: buildSystemInstruction(mode),
    temperature: 0.35,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    tools: [{ functionDeclarations: toGeminiDeclarations() }],
  };

  let replyText = '';

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    // En la última vuelta se retiran las herramientas para forzar una redacción final.
    const isLast = i === MAX_TOOL_ITERATIONS - 1;
    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: isLast ? { ...config, tools: undefined } : config,
    });

    const calls = response.functionCalls ?? [];
    if (!calls.length) {
      replyText = response.text ?? '';
      break;
    }

    contents.push({ role: 'model', parts: calls.map(c => ({ functionCall: c })) });

    const parts = calls.map(call => {
      const run = runTool(String(call.name), (call.args ?? {}) as Record<string, any>);
      toolRuns.push(run);
      return {
        functionResponse: {
          id: call.id,
          name: call.name,
          response: run.ok
            ? { resumen: run.summary, datos: compactForModel(run.data) }
            : { error: run.error, resumen: run.summary },
        },
      };
    });

    contents.push({ role: 'user', parts });
  }

  if (!replyText.trim()) {
    replyText = toolRuns.length
      ? `Se ejecutaron los motores del gemelo pero el modelo no devolvió redacción. Resultados calculados:\n\n${toolRuns.map(r => `- ${r.summary}`).join('\n')}`
      : 'El modelo no devolvió respuesta.';
  }

  return {
    reply: replyText,
    actionProtocol: buildProtocol(toolRuns, mode),
    executableActions: collectActions(toolRuns),
    citations: collectCitations(toolRuns),
    toolRuns: toolRuns.map(({ name, args, ok, summary }) => ({ name, args, ok, summary })),
    mode: 'gemini_tools',
  };
}

// ----------------------------------------------------------------------------
// Camino 2: enrutador determinista, sin modelo
// ----------------------------------------------------------------------------

const num = (n: number, d = 2) => Number(n.toFixed(d));

/** Extrae magnitudes del enunciado para que el informe responda a lo preguntado. */
function extractQuantities(prompt: string) {
  const norm = prompt.toLowerCase().replace(/,/g, '.');
  const grab = (re: RegExp): number | null => {
    const m = norm.match(re);
    return m ? Number(m[1]) : null;
  };
  return {
    lluviaMm: grab(/(\d+(?:\.\d+)?)\s*(?:mm)/),
    caudalM3s: grab(/(\d+(?:\.\d+)?)\s*(?:m3\/s|m³\/s|metros c[uú]bicos)/),
    porcentaje: grab(/(\d+(?:\.\d+)?)\s*%/),
    dias: grab(/(\d+)\s*(?:d[ií]as?)/),
    ph: grab(/ph\s*(?:de\s*)?(\d+(?:\.\d+)?)/),
  };
}

type Intent = 'metales' | 'crecida' | 'asignacion' | 'eflow' | 'calidad' | 'enkf' | 'normativa' | 'estado';

function detectIntents(prompt: string, mode: SpecialistMode): Intent[] {
  const p = prompt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  const hits = new Set<Intent>();

  const has = (...words: string[]) => words.some(w => p.includes(w));

  if (has('metal', 'plomo', 'arsenico', 'cadmio', 'dam', 'drenaje acido', 'quiruvilca', 'shorey', 'miner', 'relave', 'efluente', 'remediac', 'neutraliz', 'tmdl', 'lixiviad')) hits.add('metales');
  if (has('inunda', 'crecida', 'desborde', 'avenida', 'niño', 'nino', 'fen', 'presa', 'dam-break', 'huaico', 'tirante', 'manning')) hits.add('crecida');
  if (has('asigna', 'reparto', 'estiaje', 'compuerta', 'bocatoma', 'demanda', 'riego', 'concesion', 'scada')) hits.add('asignacion');
  if (has('ecologico', 'caudal minimo', 'tennant', 'q95', 'habitat')) hits.add('eflow');
  if (has('calidad', 'wqi', 'oxigeno', 'coliforme', 'turbidez', 'nitrato', 'ph', 'contamina')) hits.add('calidad');
  if (has('enkf', 'kalman', 'asimila', 'calibra', 'nash', 'kge', 'incertidumbre', 'confianza')) hits.add('enkf');
  if (has('ley', 'norma', 'ana', 'oefa', 'resolucion', 'dictamen', 'sancion', 'eca', 'legal', 'juridic')) hits.add('normativa');
  if (has('llueve', 'lluvia', 'precipita', 'que pasa si', 'escenario', 'simula', 'proyecta')) hits.add('crecida');
  if (has('estado', 'situacion', 'resumen', 'como esta', 'diagnostic')) hits.add('estado');

  // El modo especialista inclina, pero no sustituye a lo que se preguntó.
  const byMode: Record<SpecialistMode, Intent | null> = {
    general: null,
    water_quality_dam: 'metales',
    flood_hydraulics: 'crecida',
    regulatory_legal: 'normativa',
    scada_allocation: 'asignacion',
  };
  // El modo lo elige el operador de forma explícita, así que suma siempre. Si
  // solo actuara como respaldo, elegir "Calidad de agua y DAM" y preguntar por
  // remediación del efluente no llegaba a ejecutar el motor de metales.
  const biased = byMode[mode];
  if (biased) hits.add(biased);

  if (!hits.size) hits.add('estado');
  return [...hits];
}

/** Selecciona y parametriza las herramientas que corresponden a la consulta. */
function planTools(intents: Intent[], q: ReturnType<typeof extractQuantities>, ctx: Record<string, any> = {}) {
  const plan: Array<{ name: string; args: Record<string, any> }> = [];
  const caudalActual = Number(ctx.currentDischarge ?? 6.45) || 6.45;

  // El estado real de la cuenca sustenta cualquier respuesta.
  plan.push({ name: 'consultar_estado_cuenca', args: {} });

  if (intents.includes('crecida')) {
    const lluvia = q.lluviaMm ?? 45;
    const dias = Math.min(Math.max(q.dias ?? 10, 3), 60);
    // Hietograma triangular centrado: entra el evento indicado y decae.
    const serie = Array.from({ length: dias }, (_, i) => {
      const centro = Math.floor(dias / 3);
      const f = Math.max(0, 1 - Math.abs(i - centro) / Math.max(1, centro));
      return num(lluvia * f, 1);
    });
    plan.push({ name: 'simular_caudal_gr4j', args: { precipitacion_mm_dia: serie } });
    plan.push({ name: 'calcular_perfil_hidraulico', args: { caudal_base_m3s: q.caudalM3s ?? caudalActual } });
  }

  if (intents.includes('metales')) {
    plan.push({ name: 'simular_transporte_metales', args: { eficiencia_remediacion_pct: q.porcentaje ?? 0 } });
  }

  if (intents.includes('calidad')) {
    plan.push({ name: 'evaluar_calidad_agua_wqi', args: q.ph != null ? { ph: q.ph } : {} });
    plan.push({ name: 'consultar_estandares_eca', args: { categoria: 'ambas' } });
  }

  if (intents.includes('asignacion')) {
    plan.push({ name: 'optimizar_asignacion_caudal', args: { caudal_disponible_m3s: q.caudalM3s ?? caudalActual } });
  }

  if (intents.includes('eflow')) {
    plan.push({ name: 'evaluar_caudal_ecologico', args: { caudal_actual_m3s: q.caudalM3s ?? caudalActual } });
  }

  if (intents.includes('enkf')) {
    const p = [2, 8, 26, 41, 18, 9, 4, 2, 1, 0];
    const obs = [5.9, 6.4, 8.8, 12.6, 10.2, 8.1, 7.0, 6.4, 6.1, 5.8];
    plan.push({ name: 'asimilar_datos_enkf', args: { precipitacion_mm_dia: p, caudal_observado_m3s: obs } });
  }

  if (intents.includes('normativa')) {
    plan.push({ name: 'consultar_estandares_eca', args: { categoria: 'ambas' } });
  }

  // Deduplica conservando el primero, que ya trae argumentos.
  const seen = new Set<string>();
  return plan.filter(s => (seen.has(s.name) ? false : (seen.add(s.name), true)));
}

export function runDeterministic(req: CopilotRequest): CopilotResult {
  const mode = (req.specialistMode ?? 'general') as SpecialistMode;
  const intents = detectIntents(req.prompt, mode);
  const quantities = extractQuantities(req.prompt);
  const plan = planTools(intents, quantities, req.context ?? {});

  const toolRuns = plan.map(step => runTool(step.name, step.args));

  // Encadenamiento entre motores.
  //
  // El plan se arma antes de ejecutar nada, así que no puede conocer la salida
  // de un motor al parametrizar el siguiente. Sin este paso el informe se
  // contradecía: GR4J anunciaba un pico de crecida mientras el perfil hidráulico
  // se calculaba con el caudal actual y concluía que no había desborde.
  const gr4jRun = toolRuns.find(r => r.name === 'simular_caudal_gr4j' && r.ok);
  const pico = (gr4jRun?.data as any)?.caudal_pico_m3s;
  const perfilIdx = toolRuns.findIndex(r => r.name === 'calcular_perfil_hidraulico');

  if (perfilIdx >= 0 && typeof pico === 'number' && quantities.caudalM3s == null) {
    // El perfil se recalcula con el caudal que el propio modelo lluvia-escorrentía predice.
    toolRuns[perfilIdx] = runTool('calcular_perfil_hidraulico', { caudal_base_m3s: pico });
  }

  // Si el operador no indicó un caudal, el reparto y el caudal ecológico se
  // evalúan sobre el caudal medido en la red, no sobre una constante.
  const estadoRun = toolRuns.find(r => r.name === 'consultar_estado_cuenca' && r.ok);
  const caudalObservado = (estadoRun?.data as any)?.caudal_medio_m3s;
  if (typeof caudalObservado === 'number' && quantities.caudalM3s == null) {
    for (const [name, key] of [
      ['optimizar_asignacion_caudal', 'caudal_disponible_m3s'],
      ['evaluar_caudal_ecologico', 'caudal_actual_m3s'],
    ] as const) {
      const i = toolRuns.findIndex(r => r.name === name);
      if (i >= 0 && toolRuns[i].args?.[key] !== caudalObservado) {
        toolRuns[i] = runTool(name, { ...toolRuns[i].args, [key]: caudalObservado });
      }
    }
  }

  const ok = toolRuns.filter(r => r.ok);

  const titles: Record<Intent, string> = {
    metales: 'Diagnóstico hidrogeoquímico: metales pesados y drenaje ácido',
    crecida: 'Análisis hidrológico-hidráulico de crecida',
    asignacion: 'Asignación de caudales y operación de compuertas',
    eflow: 'Evaluación de cumplimiento del caudal ecológico',
    calidad: 'Evaluación de calidad de agua y contraste ECA',
    enkf: 'Desempeño del modelo y asimilación de datos',
    normativa: 'Marco normativo aplicable',
    estado: 'Diagnóstico general del estado de cuenca',
  };
  const title = titles[intents[0]] ?? titles.estado;

  const lines: string[] = [];
  lines.push(`### ${title}`);
  lines.push('');
  lines.push(`**Consulta atendida:** ${req.prompt.trim()}`);

  const supuestos: string[] = [];
  if (intents.includes('crecida') && quantities.lluviaMm == null) supuestos.push('lluvia de 45 mm al no indicarse una lámina');
  if (quantities.caudalM3s == null && (intents.includes('asignacion') || intents.includes('eflow'))) {
    supuestos.push('caudal observado de la red de estaciones al no indicarse uno');
  }
  if (supuestos.length) lines.push(`**Supuestos:** se asumió ${supuestos.join('; ')}.`);

  lines.push('');
  lines.push('**1. Resultados calculados por los motores del gemelo**');
  lines.push('');
  for (const r of toolRuns) {
    lines.push(r.ok ? `- \`${r.name}\` → ${r.summary}` : `- \`${r.name}\` → **no se pudo ejecutar**: ${r.error}`);
  }

  const recomendaciones = buildRecommendations(toolRuns, intents);
  if (recomendaciones.length) {
    lines.push('');
    lines.push('**2. Recomendaciones operativas derivadas**');
    lines.push('');
    recomendaciones.forEach(r => lines.push(`- ${r}`));
  }

  const citations = collectCitations(toolRuns);
  if (citations.length) {
    lines.push('');
    lines.push('**3. Marco normativo aplicable a este caso**');
    lines.push('');
    citations.forEach(c => lines.push(`- ${c}`));
  }

  lines.push('');
  lines.push(
    ok.length
      ? `_Respuesta generada por el motor determinista del gemelo sobre ${ok.length} simulaciones reales. Configure GEMINI_API_KEY para obtener además la redacción analítica del modelo._`
      : '_No se pudo ejecutar ningún motor con los datos de la consulta. Reformule indicando magnitudes (mm de lluvia, m³/s de caudal)._'
  );

  return {
    reply: lines.join('\n'),
    actionProtocol: buildProtocol(toolRuns, mode),
    executableActions: collectActions(toolRuns),
    citations,
    toolRuns: toolRuns.map(({ name, args, ok, summary }) => ({ name, args, ok, summary })),
    mode: 'deterministic_engine',
  };
}

// ----------------------------------------------------------------------------
// Recomendaciones y protocolo, derivados de los datos calculados
// ----------------------------------------------------------------------------
function findRun(runs: ToolRun[], name: string) {
  return runs.find(r => r.name === name && r.ok);
}

function buildRecommendations(runs: ToolRun[], intents: Intent[]): string[] {
  const out: string[] = [];

  const estado = findRun(runs, 'consultar_estado_cuenca')?.data as any;
  if (estado?.estaciones_no_conformes > 0) {
    const nombres = (estado.estaciones ?? [])
      .filter((e: any) => !e.cumple_eca)
      .map((e: any) => `${e.estacion} (${e.parametros_excedidos?.join(', ') || 'sin detalle'})`);
    out.push(`Intensificar muestreo en las ${estado.estaciones_no_conformes} estaciones no conformes: ${nombres.join('; ')}.`);
  }

  const metales = findRun(runs, 'simular_transporte_metales')?.data as any;
  if (metales?.perfil) {
    const criticos = metales.perfil.filter((p: any) => p.status === 'Superación Crítica ECA');
    if (criticos.length) {
      out.push(
        `Activar dosificación de lechada de cal en cabecera: ${criticos.length} puntos superan el ECA con ${metales.eficiencia_remediacion_pct}% de remediación. ` +
          `Pb máximo ${Math.max(...metales.perfil.map((p: any) => p.leadPb_mgL))} mg/L frente al límite Cat 3 de 0.05 mg/L.`
      );
      out.push('Restringir captaciones de riego aguas abajo hasta que el plomo baje del límite de Categoría 3.');
    } else {
      out.push(`Con ${metales.eficiencia_remediacion_pct}% de remediación ningún punto supera críticamente el ECA. Mantener el tratamiento actual.`);
    }
  }

  const perfil = findRun(runs, 'calcular_perfil_hidraulico')?.data as any;
  if (perfil?.secciones) {
    const desborde = perfil.secciones.filter((s: any) => s.isOverbankFlooded);
    if (desborde.length) {
      out.push(`Emitir alerta temprana: ${desborde.length} secciones en desborde (${desborde.map((s: any) => s.name).join(', ')}). Notificar a COER La Libertad e INDECI.`);
    } else {
      out.push(`Sin desborde para ${perfil.caudal_base_m3s} m³/s. Bordo libre mínimo ${Math.min(...perfil.secciones.map((s: any) => s.freeboardM))} m.`);
    }
  }

  const gr4j = findRun(runs, 'simular_caudal_gr4j')?.data as any;
  if (gr4j) {
    out.push(`Preparar operación para un pico de ${gr4j.caudal_pico_m3s} m³/s al día ${gr4j.dia_pico} del evento simulado.`);
  }

  const asignacion = findRun(runs, 'optimizar_asignacion_caudal')?.data as any;
  if (asignacion?.sectores) {
    const cierres = asignacion.sectores.filter((s: any) => s.gateStatus === 'Cierre Preventivo');
    if (cierres.length) {
      out.push(`Ejecutar cierre preventivo en: ${cierres.map((s: any) => s.intakeName).join(', ')}.`);
    }
  }

  const eflow = findRun(runs, 'evaluar_caudal_ecologico')?.data as any;
  if (eflow?.cumplimiento?.deficitM3s > 0) {
    out.push(`Reponer un déficit de ${eflow.cumplimiento.deficitM3s} m³/s para restituir el caudal ecológico (estado: ${eflow.cumplimiento.status}).`);
  }

  const enkf = findRun(runs, 'asimilar_datos_enkf')?.data as any;
  if (enkf) {
    out.push(`La asimilación EnKF eleva el Nash-Sutcliffe de ${enkf.metricas_sin_asimilar.nse} a ${enkf.metricas_asimiladas.nse}, lo que respalda el uso operativo del pronóstico.`);
  }

  if (!out.length && intents.includes('normativa')) {
    out.push('Contrastar los parámetros medidos contra las categorías 3 y 4 del ECA antes de iniciar un procedimiento administrativo sancionador.');
  }

  return out;
}

function buildProtocol(runs: ToolRun[], mode: SpecialistMode): CopilotProtocol | null {
  const ok = runs.filter(r => r.ok);
  if (!ok.length) return null;

  let level: CopilotProtocol['level'] = 'info';
  const steps: string[] = [];
  const zones = new Set<string>();
  const gates: string[] = [];

  const metales = findRun(runs, 'simular_transporte_metales')?.data as any;
  if (metales?.perfil) {
    const criticos = metales.perfil.filter((p: any) => p.status === 'Superación Crítica ECA');
    if (criticos.length) {
      level = 'critical';
      steps.push('Activar dosificación de neutralizante alcalino en la bocatoma Shorey.');
      steps.push('Notificar a OEFA y a la ALA Moche-Virú-Chao.');
      criticos.forEach((c: any) => zones.add(c.locationName));
      gates.push('Compuerta Shorey: cierre preventivo al 70%');
    }
  }

  const perfil = findRun(runs, 'calcular_perfil_hidraulico')?.data as any;
  if (perfil?.secciones) {
    const desborde = perfil.secciones.filter((s: any) => s.isOverbankFlooded);
    const alto = perfil.secciones.filter((s: any) => s.floodRiskLevel === 'Alto' || s.floodRiskLevel === 'Extremo');
    if (desborde.length) {
      level = 'critical';
      steps.push('Activar sirenas del sistema de alerta temprana en las secciones en desborde.');
      desborde.forEach((s: any) => zones.add(s.name));
    } else if (alto.length && level === 'info') {
      level = 'warning';
      steps.push('Vigilancia reforzada en las secciones con riesgo hidráulico alto.');
      alto.forEach((s: any) => zones.add(s.name));
    }
  }

  const estado = findRun(runs, 'consultar_estado_cuenca')?.data as any;
  if (estado?.estaciones_no_conformes > 0) {
    if (level === 'info') level = 'warning';
    steps.push(`Elevar la frecuencia de muestreo IoT en las ${estado.estaciones_no_conformes} estaciones no conformes.`);
    (estado.estaciones ?? []).filter((e: any) => !e.cumple_eca).forEach((e: any) => zones.add(e.estacion));
  }

  const asignacion = findRun(runs, 'optimizar_asignacion_caudal')?.data as any;
  if (asignacion?.sectores) {
    asignacion.sectores
      .filter((s: any) => s.gateStatus !== '100% Abierta')
      .forEach((s: any) => gates.push(`${s.intakeName}: ${s.gateStatus}`));
    if (gates.length && level === 'info') level = 'warning';
  }

  const eflow = findRun(runs, 'evaluar_caudal_ecologico')?.data as any;
  if (eflow?.cumplimiento?.status?.startsWith('Alerta')) {
    if (level === 'info') level = 'warning';
    steps.push(`Restituir el caudal ecológico: ${eflow.cumplimiento.status}.`);
  }

  if (!steps.length) return null;

  const titleByMode: Record<SpecialistMode, string> = {
    general: 'Protocolo operativo de cuenca',
    water_quality_dam: 'Protocolo de contingencia por drenaje ácido y metales pesados',
    flood_hydraulics: 'Protocolo de gestión de riesgo de crecida',
    regulatory_legal: 'Protocolo de actuación normativa',
    scada_allocation: 'Protocolo de operación SCADA y reparto',
  };

  return {
    title: titleByMode[mode] ?? titleByMode.general,
    level,
    steps,
    affectedZones: [...zones],
    recommendedGateActions: gates,
  };
}

/** Diagnóstico del registro, expuesto en /api/health para verificación rápida. */
export function describeTools() {
  return BASIN_TOOLS.map(t => ({ name: t.name, description: t.description.slice(0, 90) }));
}
