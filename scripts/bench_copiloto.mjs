// Banco de pruebas del copiloto en modo determinista.
// Mide: acierto de motor (corrección de la consulta), falsos positivos,
// extracción de magnitudes y latencia secuencial y concurrente.
// Uso: node scripts/bench_copiloto.mjs http://localhost:3002 scripts/resultados/bench_copiloto.json
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

const BASE = process.argv[2] ?? 'http://localhost:3002';
const OUT = process.argv[3] ?? 'bench_resultados.json';
const REPS = 10;
const CONC_WORKERS = 10;

const G = 'simular_caudal_gr4j', P = 'calcular_perfil_hidraulico', M = 'simular_transporte_metales',
  A = 'optimizar_asignacion_caudal', E = 'evaluar_caudal_ecologico', W = 'evaluar_calidad_agua_wqi',
  K = 'asimilar_datos_enkf', N = 'consultar_estandares_eca', S = 'consultar_estado_cuenca';

// tipo: 'directa' usa el vocabulario técnico habitual; 'parafrasis' dice lo mismo con otras palabras.
// req: motores que deben ejecutarse. allow: compañeros aceptables. arg: magnitud que debe extraerse.
const CASOS = [
  { id: 1, intent: 'metales', tipo: 'directa', q: '¿Cuánto bajaría el plomo en el río si remediamos el efluente minero al 80%?', req: [M], allow: [], arg: [M, 'eficiencia_remediacion_pct', 80] },
  { id: 2, intent: 'metales', tipo: 'directa', q: 'Simula el drenaje ácido de Quiruvilca sin tratamiento', req: [M], allow: [] },
  { id: 3, intent: 'metales', tipo: 'parafrasis', q: 'Si tratamos el agua que sale de la mina al 95, ¿el Pb cumple en Trujillo?', req: [M], allow: [N], arg: [M, 'eficiencia_remediacion_pct', 95] },
  { id: 4, intent: 'metales', tipo: 'directa', q: '¿Qué concentración de arsénico llega a la costa?', req: [M], allow: [] },
  { id: 5, intent: 'crecida', tipo: 'directa', q: '¿Qué pasa si llueven 60 mm en la cuenca alta durante 5 días?', req: [G, P], allow: [] },
  { id: 6, intent: 'crecida', tipo: 'directa', q: 'Riesgo de desborde en Trujillo con un Niño fuerte', req: [G, P], allow: [] },
  { id: 7, intent: 'crecida', tipo: 'parafrasis', q: '¿Se sale el agua del cauce si el caudal sube a 120 m3/s?', req: [P], allow: [G], arg: [P, 'caudal_base_m3s', 120] },
  { id: 8, intent: 'crecida', tipo: 'parafrasis', q: 'Pronóstico de caudal para una tormenta de 80 mm', req: [G], allow: [P] },
  { id: 9, intent: 'asignacion', tipo: 'directa', q: 'Reparte 4 m3/s entre los usuarios en estiaje', req: [A], allow: [], arg: [A, 'caudal_disponible_m3s', 4] },
  { id: 10, intent: 'asignacion', tipo: 'directa', q: '¿Cómo distribuyo el agua de riego si solo hay 3.5 m³/s?', req: [A], allow: [], arg: [A, 'caudal_disponible_m3s', 3.5] },
  { id: 11, intent: 'asignacion', tipo: 'parafrasis', q: 'Prioriza el agua para la ciudad y los agricultores este mes seco', req: [A], allow: [E] },
  { id: 12, intent: 'asignacion', tipo: 'parafrasis', q: 'Abre o cierra la toma de Menocucho según lo que necesiten los regantes', req: [A], allow: [] },
  { id: 13, intent: 'eflow', tipo: 'directa', q: '¿Se cumple el caudal ecológico con 2 m3/s?', req: [E], allow: [], arg: [E, 'caudal_actual_m3s', 2] },
  { id: 14, intent: 'eflow', tipo: 'directa', q: 'Evalúa el caudal mínimo para el hábitat de peces', req: [E], allow: [] },
  { id: 15, intent: 'eflow', tipo: 'parafrasis', q: '¿Cuánta agua hay que dejar en el río para que no se muera?', req: [E], allow: [] },
  { id: 16, intent: 'eflow', tipo: 'parafrasis', q: '¿Qué volumen debe quedar en el cauce para los peces y las aves?', req: [E], allow: [] },
  { id: 17, intent: 'calidad', tipo: 'directa', q: '¿Cuál es el WQI en la estación de Simbal?', req: [W], allow: [N] },
  { id: 18, intent: 'calidad', tipo: 'directa', q: 'Calidad del agua con pH 5.2', req: [W], allow: [N], arg: [W, 'ph', 5.2] },
  { id: 19, intent: 'calidad', tipo: 'parafrasis', q: '¿El agua del río sirve para regar hortalizas?', req: [W], allow: [N] },
  { id: 20, intent: 'calidad', tipo: 'parafrasis', q: '¿Está sucia el agua en la parte baja?', req: [W], allow: [N] },
  { id: 21, intent: 'enkf', tipo: 'directa', q: 'Ejecuta la asimilación de datos con el filtro de Kalman', req: [K], allow: [] },
  { id: 22, intent: 'enkf', tipo: 'directa', q: 'Muestra el Nash y el KGE del modelo calibrado', req: [K], allow: [] },
  { id: 23, intent: 'enkf', tipo: 'parafrasis', q: '¿Qué tan confiable es la simulación de caudal?', req: [K], allow: [G, P] },
  { id: 24, intent: 'enkf', tipo: 'parafrasis', q: '¿Cuánto se equivoca el modelo frente a lo medido?', req: [K], allow: [] },
  { id: 25, intent: 'normativa', tipo: 'directa', q: '¿Qué dice la norma ECA para riego?', req: [N], allow: [A, W] },
  { id: 26, intent: 'normativa', tipo: 'directa', q: 'Prepara un dictamen para la ANA', req: [N], allow: [] },
  { id: 27, intent: 'normativa', tipo: 'parafrasis', q: '¿Qué límite de plomo permite el reglamento peruano?', req: [N], allow: [M] },
  { id: 28, intent: 'normativa', tipo: 'parafrasis', q: '¿Qué multa le cae a la minera si contamina?', req: [N], allow: [M, W] },
  { id: 29, intent: 'estado', tipo: 'directa', q: 'Dame un resumen del estado de la cuenca', req: [S], allow: [] },
  { id: 30, intent: 'estado', tipo: 'directa', q: 'Diagnóstico general', req: [S], allow: [] },
  { id: 31, intent: 'estado', tipo: 'parafrasis', q: '¿Cómo va el río hoy?', req: [S], allow: [] },
  { id: 32, intent: 'estado', tipo: 'parafrasis', q: 'Hola', req: [S], allow: [] },
];

async function ask(q) {
  const t0 = performance.now();
  const r = await fetch(`${BASE}/api/gemini/assist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: q, specialistMode: 'general' }),
  });
  const text = await r.text();
  const ms = performance.now() - t0;
  let body = null;
  try { body = JSON.parse(text); } catch { /* respuesta no JSON */ }
  return { ms, status: r.status, bytes: Buffer.byteLength(text), body };
}

const pct = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[i];
};
const stats = arr => ({
  n: arr.length,
  media: arr.reduce((a, b) => a + b, 0) / arr.length,
  p50: pct(arr, 50), p95: pct(arr, 95), p99: pct(arr, 99),
  min: Math.min(...arr), max: Math.max(...arr),
});

// Calentamiento: la primera llamada compila módulos en tsx y no representa el régimen.
for (let i = 0; i < 3; i++) await ask('Hola');

// 1. Corrección de la consulta y latencia secuencial
const porCaso = [];
const latSeq = [];
let errores = 0;
for (const c of CASOS) {
  let primera = null;
  const lat = [];
  for (let r = 0; r < REPS; r++) {
    const res = await ask(c.q);
    if (res.status !== 200 || !res.body) { errores++; continue; }
    lat.push(res.ms); latSeq.push(res.ms);
    if (!primera) primera = res;
  }
  const runs = primera?.body?.toolRuns ?? [];
  const ejecutados = runs.map(t => t.name);
  const okReq = c.req.every(n => ejecutados.includes(n));
  const fp = ejecutados.filter(n => n !== S && !c.req.includes(n) && !c.allow.includes(n));
  let argOk = null;
  if (c.arg) {
    const [tool, key, val] = c.arg;
    const run = runs.find(t => t.name === tool);
    argOk = run ? Number(run.args?.[key]) === val : false;
  }
  porCaso.push({
    id: c.id, intent: c.intent, tipo: c.tipo, consulta: c.q,
    esperado: c.req, ejecutados, acierto: okReq, falsos_positivos: fp, magnitud_ok: argOk,
    modo: primera?.body?.mode, bytes: primera?.bytes, latencia_ms: stats(lat),
  });
}

// 2. Carga concurrente: CONC_WORKERS clientes recorren las 32 consultas a la vez.
const latConc = [];
let erroresConc = 0;
const tC0 = performance.now();
await Promise.all(Array.from({ length: CONC_WORKERS }, async (_, w) => {
  for (let i = 0; i < CASOS.length; i++) {
    const c = CASOS[(i + w) % CASOS.length];
    const res = await ask(c.q);
    if (res.status !== 200) erroresConc++; else latConc.push(res.ms);
  }
}));
const durConc = (performance.now() - tC0) / 1000;

// 3. Endpoints de geodatos con caché en disco caliente
async function timeGet(path, n = 20, body) {
  const lat = []; let err = 0;
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    const r = await fetch(`${BASE}${path}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
    await r.arrayBuffer();
    if (r.status !== 200) err++; else lat.push(performance.now() - t0);
  }
  return { ...stats(lat), errores: err };
}
const puntos = [{ lat: -7.97, lon: -78.32 }, { lat: -8.11, lon: -78.97 }];
const geo = {
  health: await timeGet('/api/health'),
  dem: await timeGet('/api/geo/dem'),
  hydrography: await timeGet('/api/geo/hydrography'),
  weather_2_puntos: await timeGet('/api/geo/weather', 20, { points: puntos }),
};

const resumen = (filtro) => {
  const s = porCaso.filter(filtro);
  const conArg = s.filter(c => c.magnitud_ok !== null);
  return {
    casos: s.length,
    aciertos: s.filter(c => c.acierto).length,
    con_falsos_positivos: s.filter(c => c.falsos_positivos.length).length,
    magnitudes: `${conArg.filter(c => c.magnitud_ok).length}/${conArg.length}`,
  };
};

const salida = {
  fecha: new Date().toISOString(),
  base: BASE,
  repeticiones_por_caso: REPS,
  correccion: {
    total: resumen(() => true),
    directas: resumen(c => c.tipo === 'directa'),
    parafrasis: resumen(c => c.tipo === 'parafrasis'),
  },
  latencia_secuencial_ms: { ...stats(latSeq), errores },
  carga_concurrente: {
    clientes: CONC_WORKERS, peticiones: latConc.length + erroresConc, errores: erroresConc,
    duracion_s: durConc, throughput_rps: (latConc.length + erroresConc) / durConc, latencia_ms: stats(latConc),
  },
  geodatos_cache_caliente_ms: geo,
  por_caso: porCaso,
};
writeFileSync(OUT, JSON.stringify(salida, null, 1));
console.log(JSON.stringify({ correccion: salida.correccion, latencia_secuencial_ms: salida.latencia_secuencial_ms, carga_concurrente: salida.carga_concurrente, geo }, null, 1));
for (const c of porCaso) {
  console.log(`${String(c.id).padStart(2)} ${c.tipo.padEnd(10)} ${c.intent.padEnd(10)} ${c.acierto ? 'OK ' : 'NO '} fp=${c.falsos_positivos.join(',') || '-'} arg=${c.magnitud_ok ?? '-'} | ${c.ejecutados.join(',')}`);
}
