/**
 * CrispDmStudyPanel - Estudio de minería de datos CRISP-DM
 *
 * Muestra el informe que produce el motor analítico de `ml/`: las seis fases de
 * la metodología, con sus figuras y tablas, cada una acompañada de los tres
 * bloques de lectura que exige el encargo (qué muestra, cómo leerlo e
 * interpretación).
 *
 * El contenido se carga de `/crispdm/informe.json`, que genera
 * `ml/exportar_front.py`. Es un resultado congelado que se recalcula al
 * reentrenar, no en cada petición, así que se sirve como archivo estático y el
 * gemelo sigue funcionando aunque Python no esté instalado en la máquina.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  ChevronDown,
  Database,
  Download,
  Eye,
  Image as ImageIcon,
  Lightbulb,
  Table as TableIcon,
  TrendingDown,
} from 'lucide-react';

import { useI18n } from '../providers/I18nProvider';

// ---------------------------------------------------------------------------
// Tipos del documento exportado
// ---------------------------------------------------------------------------
interface Lecturas {
  que: string;
  como: string;
  interpretacion: string;
}

interface PiezaFase {
  tipo: 'fase';
  numero: number;
  titulo: string;
  proposito: string;
  texto: string;
}

interface PiezaFigura extends Lecturas {
  tipo: 'figura';
  numero: number;
  titulo: string;
  imagen: string | null;
  fase: number | null;
}

interface PiezaTabla extends Lecturas {
  tipo: 'tabla';
  numero: number;
  titulo: string;
  csv: string | null;
  fase: number | null;
  columnas: string[];
  filas: string[][];
}

type Pieza = PiezaFase | PiezaFigura | PiezaTabla;

interface Dataset {
  fuente: {
    nombre: string;
    modelo: string;
    url: string;
    credenciales: string;
    licencia: string;
    variables_pedidas: string[];
    consulta_ejemplo: string;
  };
  volumen: {
    filas: number; columnas: number; estaciones: number; dias: number;
    periodo: string; anios: number; nulos_totales: number;
    elev_min: number; elev_max: number;
  };
  papeles: Record<string, number>;
  esquema: Array<{
    columna: string; unidad: string; papel: string; rango: string;
    media: number | null; nulos: number; explicacion: string;
  }>;
  estaciones: Array<{
    codigo: string; nombre: string; subcuenca: string; lat: number; lon: number;
    elev_ficha: number; elev_era5: number | null; registros: number; et0_media: number | null;
  }>;
  muestra: { columnas: string[]; filas: string[][] };
  /** Los tres bloques de lectura de cada vista, generados de los datos reales. */
  lecturas: Record<'esquema' | 'estaciones' | 'muestra', Lecturas>;
}

interface Documento {
  dataset: Dataset | null;
  titulo: string;
  subtitulo: string;
  fuente: string;
  registros: number;
  estaciones: number;
  periodo: string;
  resumen: {
    modelo: string;
    rmse: number;
    rmse_base: number;
    mejora_pct: number;
    nse: number;
    sesgo: number;
    sesgo_base: number;
  };
  piezas: Pieza[];
}

// ---------------------------------------------------------------------------
// Bloques de lectura: el requisito central del encargo
// ---------------------------------------------------------------------------
const BloquesLectura: React.FC<{ p: Lecturas }> = ({ p }) => {
  const { t } = useI18n();
  const bloques = [
    { icono: Eye, etiqueta: t('crispdm.que'), texto: p.que, color: 'text-sky-300', borde: 'border-sky-500/40' },
    { icono: BookOpen, etiqueta: t('crispdm.como'), texto: p.como, color: 'text-violet-300', borde: 'border-violet-500/40' },
    { icono: Lightbulb, etiqueta: t('crispdm.interpretacion'), texto: p.interpretacion, color: 'text-amber-300', borde: 'border-amber-500/40' },
  ];

  return (
    <div className="grid gap-2 md:grid-cols-3 mt-3">
      {bloques.map(b => {
        const Icono = b.icono;
        return (
          <div key={b.etiqueta} className={`rounded-lg border-l-2 ${b.borde} bg-slate-900/60 p-2.5`}>
            <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide ${b.color} mb-1`}>
              <Icono className="w-3 h-3 shrink-0" />
              {b.etiqueta}
            </div>
            <p className="text-[11px] leading-relaxed text-slate-300">{b.texto}</p>
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
const TarjetaFigura: React.FC<{ p: PiezaFigura }> = ({ p }) => {
  const { t } = useI18n();
  const [ampliada, setAmpliada] = useState(false);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-3.5">
      <header className="flex items-start gap-2 mb-2.5">
        <span className="mt-0.5 shrink-0 rounded-md bg-blue-600/20 p-1.5 text-blue-300">
          <ImageIcon className="w-3.5 h-3.5" />
        </span>
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-slate-100 leading-snug">
            {t('crispdm.figura')} {p.numero}. {p.titulo}
          </h4>
        </div>
      </header>

      {p.imagen && (
        <button
          type="button"
          onClick={() => setAmpliada(true)}
          className="block w-full rounded-lg bg-white p-2 ring-1 ring-slate-700 hover:ring-blue-500 transition"
          title={t('crispdm.ampliar')}
        >
          <img src={p.imagen} alt={p.titulo} className="w-full h-auto" loading="lazy" />
        </button>
      )}

      <BloquesLectura p={p} />

      {ampliada && p.imagen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6"
          onClick={() => setAmpliada(false)}
          role="dialog"
        >
          <img src={p.imagen} alt={p.titulo} className="max-h-full max-w-full rounded-lg bg-white p-3" />
        </div>
      )}
    </section>
  );
};

// ---------------------------------------------------------------------------
const TarjetaTabla: React.FC<{ p: PiezaTabla }> = ({ p }) => {
  const { t } = useI18n();
  const [todo, setTodo] = useState(false);
  const LIMITE = 8;
  const visibles = todo ? p.filas : p.filas.slice(0, LIMITE);
  const ocultas = p.filas.length - visibles.length;

  // Las columnas numéricas se alinean a la derecha para poder comparar cifras
  // de un vistazo, que es justo lo que se hace al leer una tabla de resultados.
  const esNumerica = useMemo(
    () => p.columnas.map((_, j) => p.filas.every(f => f[j] === '' || !Number.isNaN(Number(f[j])))),
    [p.columnas, p.filas]
  );

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-3.5">
      <header className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-start gap-2 min-w-0">
          <span className="mt-0.5 shrink-0 rounded-md bg-emerald-600/20 p-1.5 text-emerald-300">
            <TableIcon className="w-3.5 h-3.5" />
          </span>
          <h4 className="text-sm font-bold text-slate-100 leading-snug">
            {t('crispdm.tabla')} {p.numero}. {p.titulo}
          </h4>
        </div>
        {p.csv && (
          <a
            href={`/crispdm/tablas/${p.csv}`}
            download
            className="shrink-0 flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-400 hover:text-slate-100 hover:border-slate-500 transition"
          >
            <Download className="w-3 h-3" />
            CSV
          </a>
        )}
      </header>

      <div className="overflow-x-auto rounded-lg ring-1 ring-slate-800">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="bg-slate-800/70">
              {p.columnas.map(c => (
                <th key={c} className="px-2.5 py-1.5 text-left font-semibold text-slate-300 whitespace-nowrap">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibles.map((fila, i) => (
              <tr key={i} className={i % 2 ? 'bg-slate-900/40' : ''}>
                {fila.map((v, j) => (
                  <td
                    key={j}
                    className={`px-2.5 py-1.5 whitespace-nowrap ${
                      esNumerica[j] ? 'text-right tabular-nums text-slate-200' : 'text-slate-300'
                    }`}
                  >
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ocultas > 0 && (
        <button
          type="button"
          onClick={() => setTodo(true)}
          className="mt-1.5 flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300"
        >
          <ChevronDown className="w-3 h-3" />
          {t('crispdm.verFilas').replace('{n}', String(ocultas))}
        </button>
      )}

      <BloquesLectura p={p} />
    </section>
  );
};

// ---------------------------------------------------------------------------
// Ficha del conjunto de datos
// ---------------------------------------------------------------------------
// El color del papel es informacion, no adorno: separa de un vistazo lo que el
// modelo ve de lo que se excluyo a proposito, que es el nucleo del metodo.
const COLOR_PAPEL: Record<string, string> = {
  OBJETIVO: 'bg-amber-600/25 text-amber-200 ring-amber-500/40',
  predictor: 'bg-emerald-600/20 text-emerald-200 ring-emerald-500/40',
  derivada: 'bg-sky-600/20 text-sky-200 ring-sky-500/40',
  excluida: 'bg-rose-600/20 text-rose-200 ring-rose-500/40',
  descartada: 'bg-slate-700/40 text-slate-300 ring-slate-600/40',
  identificador: 'bg-slate-700/40 text-slate-300 ring-slate-600/40',
  indice: 'bg-slate-700/40 text-slate-300 ring-slate-600/40',
  'linea base': 'bg-violet-600/20 text-violet-200 ring-violet-500/40',
};

// El papel viaja sin tildes porque es la clave del mapa de color. La etiqueta
// visible se acentúa aquí, de modo que cambiar el texto no rompe el estilo.
const ETIQUETA_PAPEL: Record<string, string> = {
  OBJETIVO: 'objetivo',
  predictor: 'predictor',
  derivada: 'derivada',
  excluida: 'excluida',
  descartada: 'descartada',
  identificador: 'identificador',
  indice: 'índice',
  'linea base': 'línea base',
};

const FichaDataset: React.FC<{ d: Dataset }> = ({ d }) => {
  const { t } = useI18n();
  const [vista, setVista] = useState<'esquema' | 'estaciones' | 'muestra'>('esquema');

  const pestanas = [
    { id: 'esquema' as const, etiqueta: t('crispdm.ds.esquema'), n: d.esquema.length },
    { id: 'estaciones' as const, etiqueta: t('crispdm.ds.estaciones'), n: d.estaciones.length },
    { id: 'muestra' as const, etiqueta: t('crispdm.ds.muestra'), n: d.muestra.filas.length },
  ];

  const cifras = [
    { e: t('crispdm.ds.filas'), v: d.volumen.filas.toLocaleString('es-PE') },
    { e: t('crispdm.ds.columnas'), v: String(d.volumen.columnas) },
    { e: t('crispdm.ds.dias'), v: d.volumen.dias.toLocaleString('es-PE') },
    { e: t('crispdm.ds.anios'), v: String(d.volumen.anios) },
    { e: t('crispdm.ds.nulos'), v: String(d.volumen.nulos_totales) },
    { e: t('crispdm.ds.altitud'), v: `${d.volumen.elev_min}–${d.volumen.elev_max} m` },
  ];

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-3.5">
      <header className="flex items-start gap-2 mb-3">
        <span className="mt-0.5 shrink-0 rounded-md bg-cyan-600/20 p-1.5 text-cyan-300">
          <Database className="w-3.5 h-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-100">{t('crispdm.ds.titulo')}</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {d.fuente.nombre} · {d.fuente.modelo} · {d.volumen.periodo}
          </p>
        </div>
        <a
          href="/crispdm/muestra_dataset.csv"
          download
          className="shrink-0 flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-400 hover:text-slate-100 hover:border-slate-500 transition"
        >
          <Download className="w-3 h-3" />
          {t('crispdm.ds.descargar')}
        </a>
      </header>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
        {cifras.map(c => (
          <div key={c.e} className="rounded-lg bg-slate-950/50 ring-1 ring-slate-800 px-2.5 py-1.5">
            <div className="text-[9px] uppercase tracking-wide text-slate-500">{c.e}</div>
            <div className="text-xs font-bold text-slate-100 tabular-nums">{c.v}</div>
          </div>
        ))}
      </div>

      {/* La procedencia importa para que el estudio sea reproducible por el jurado */}
      <div className="rounded-lg bg-slate-950/40 ring-1 ring-slate-800 px-3 py-2 mb-3 space-y-1">
        <p className="text-[11px] text-slate-300">
          <span className="text-slate-500">{t('crispdm.ds.acceso')}: </span>
          {d.fuente.credenciales}
        </p>
        <p className="text-[11px] text-slate-300">
          <span className="text-slate-500">{t('crispdm.ds.licencia')}: </span>
          {d.fuente.licencia}
        </p>
        <pre className="mt-1.5 overflow-x-auto rounded bg-slate-950/70 px-2 py-1.5 text-[10px] text-sky-300 leading-relaxed">
          {d.fuente.consulta_ejemplo}
        </pre>
      </div>

      <div className="flex gap-1 mb-2.5 border-b border-slate-800">
        {pestanas.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => setVista(p.id)}
            className={`px-2.5 py-1.5 text-[11px] font-medium border-b-2 -mb-px transition ${
              vista === p.id
                ? 'border-cyan-400 text-cyan-200'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {p.etiqueta} <span className="text-slate-600">({p.n})</span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg ring-1 ring-slate-800">
        {vista === 'esquema' && (
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-slate-800/70 text-slate-300">
                <th className="px-2.5 py-1.5 text-left font-semibold">{t('crispdm.ds.columna')}</th>
                <th className="px-2.5 py-1.5 text-left font-semibold">{t('crispdm.ds.papel')}</th>
                <th className="px-2.5 py-1.5 text-left font-semibold">{t('crispdm.ds.unidad')}</th>
                <th className="px-2.5 py-1.5 text-right font-semibold">{t('crispdm.ds.rango')}</th>
                <th className="px-2.5 py-1.5 text-left font-semibold">{t('crispdm.ds.explicacion')}</th>
              </tr>
            </thead>
            <tbody>
              {d.esquema.map((f, i) => (
                <tr key={f.columna} className={i % 2 ? 'bg-slate-900/40' : ''}>
                  <td className="px-2.5 py-1.5 font-mono text-[10px] text-slate-200 whitespace-nowrap">{f.columna}</td>
                  <td className="px-2.5 py-1.5 whitespace-nowrap">
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ring-1 ${COLOR_PAPEL[f.papel] ?? COLOR_PAPEL.identificador}`}>
                      {ETIQUETA_PAPEL[f.papel] ?? f.papel}
                    </span>
                  </td>
                  <td className="px-2.5 py-1.5 text-slate-400 whitespace-nowrap">{f.unidad}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums text-slate-300 whitespace-nowrap">{f.rango}</td>
                  <td className="px-2.5 py-1.5 text-slate-400">{f.explicacion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {vista === 'estaciones' && (
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-slate-800/70 text-slate-300">
                {['codigo', 'nombre', 'subcuenca', 'lat', 'lon', 'elev_era5', 'registros', 'et0_media'].map(c => (
                  <th key={c} className="px-2.5 py-1.5 text-left font-semibold whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.estaciones.map((e, i) => (
                <tr key={e.codigo} className={i % 2 ? 'bg-slate-900/40' : ''}>
                  <td className="px-2.5 py-1.5 font-mono text-[10px] text-slate-200">{e.codigo}</td>
                  <td className="px-2.5 py-1.5 text-slate-300 whitespace-nowrap">{e.nombre}</td>
                  <td className="px-2.5 py-1.5 text-slate-400">{e.subcuenca}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums text-slate-300">{e.lat}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums text-slate-300">{e.lon}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums text-slate-200">{e.elev_era5}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums text-slate-400">{e.registros?.toLocaleString('es-PE')}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums text-slate-200">{e.et0_media}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {vista === 'muestra' && (
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-slate-800/70 text-slate-300">
                {d.muestra.columnas.map(c => (
                  <th key={c} className="px-2.5 py-1.5 text-left font-semibold whitespace-nowrap font-mono text-[10px]">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.muestra.filas.map((fila, i) => (
                <tr key={i} className={i % 2 ? 'bg-slate-900/40' : ''}>
                  {fila.map((v, j) => (
                    <td
                      key={j}
                      className={`px-2.5 py-1.5 whitespace-nowrap ${
                        Number.isNaN(Number(v))
                          ? 'text-slate-300'
                          : `text-right tabular-nums ${
                              d.muestra.columnas[j] === 'et0' ? 'text-amber-200 font-semibold' : 'text-slate-200'
                            }`
                      }`}
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Cada vista del dataset lleva la misma lectura que las piezas del
          informe: ninguna tabla queda sin explicar. */}
      {d.lecturas?.[vista] && <BloquesLectura p={d.lecturas[vista]} />}

      <p className="mt-2 text-[10px] text-slate-500 leading-relaxed">
        {t('crispdm.ds.nota')}
      </p>
    </section>
  );
};

// ---------------------------------------------------------------------------
export const CrispDmStudyPanel: React.FC = () => {
  const { t } = useI18n();
  const [doc, setDoc] = useState<Documento | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/crispdm/informe.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setDoc)
      .catch(e => setError(String(e)));
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-amber-700/50 bg-amber-950/30 p-5">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-amber-200">{t('crispdm.sinDatos')}</h3>
            <p className="text-xs text-amber-200/80 mt-1">{t('crispdm.sinDatosAyuda')}</p>
            <pre className="mt-2 rounded bg-slate-950/60 px-2.5 py-1.5 text-[11px] text-slate-400 overflow-x-auto">
              cd ml{'\n'}python run_pipeline.py{'\n'}python exportar_front.py
            </pre>
          </div>
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400 p-5">
        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
        {t('crispdm.cargando')}
      </div>
    );
  }

  const r = doc.resumen;
  const indicadores = [
    { etiqueta: t('crispdm.kpi.registros'), valor: doc.registros.toLocaleString('es-PE'), sufijo: '' },
    { etiqueta: t('crispdm.kpi.estaciones'), valor: String(doc.estaciones), sufijo: '' },
    { etiqueta: t('crispdm.kpi.rmse'), valor: r.rmse?.toFixed(3) ?? '—', sufijo: 'mm/día' },
    { etiqueta: t('crispdm.kpi.mejora'), valor: r.mejora_pct?.toFixed(1) ?? '—', sufijo: '%' },
    { etiqueta: t('crispdm.kpi.nse'), valor: r.nse?.toFixed(3) ?? '—', sufijo: '' },
  ];

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <header className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/40 p-4">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 shrink-0 rounded-lg bg-violet-600/20 p-2 text-violet-300">
            <BarChart3 className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-slate-100 leading-snug">{doc.titulo}</h1>
            <p className="text-xs text-slate-400 mt-0.5">{doc.subtitulo}</p>
            <p className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1.5">
              <Database className="w-3 h-3 shrink-0" />
              {doc.fuente} · {doc.periodo}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mt-3.5">
          {indicadores.map(k => (
            <div key={k.etiqueta} className="rounded-lg bg-slate-950/50 ring-1 ring-slate-800 px-3 py-2">
              <div className="text-[9px] uppercase tracking-wide text-slate-500">{k.etiqueta}</div>
              <div className="text-base font-bold text-slate-100 tabular-nums leading-tight">
                {k.valor}
                {k.sufijo && <span className="text-[10px] font-normal text-slate-400 ml-1">{k.sufijo}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* El sesgo es el hallazgo que más importa al balance hídrico, así que
            se destaca fuera de la rejilla de indicadores. */}
        {r.sesgo !== undefined && (
          <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-emerald-950/30 ring-1 ring-emerald-800/40 px-3 py-2">
            <TrendingDown className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-emerald-200/90 leading-relaxed">
              {t('crispdm.sesgo')
                .replace('{base}', r.sesgo_base.toFixed(3))
                .replace('{modelo}', r.sesgo.toFixed(3))
                .replace('{mm}', Math.abs((r.sesgo_base - r.sesgo) * 365).toFixed(0))}
            </p>
          </div>
        )}
      </header>

      {/* El conjunto de datos va antes que el analisis: primero se ve de donde
          salen las cifras, y solo despues que se hizo con ellas. */}
      {doc.dataset && <FichaDataset d={doc.dataset} />}

      {/* Fases con sus piezas */}
      {doc.piezas.map((p, i) => {
        if (p.tipo === 'fase') {
          return (
            <div key={`f${p.numero}-${i}`} className="pt-1">
              <div className="flex items-baseline gap-2.5 border-b border-slate-800 pb-1.5">
                <span className="rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  {t('crispdm.fase')} {p.numero}
                </span>
                <h2 className="text-sm font-bold text-slate-100">{p.titulo}</h2>
              </div>
              {p.proposito && <p className="text-[11px] italic text-slate-500 mt-1.5">{p.proposito}</p>}
              {p.texto && (
                <div className="mt-2 space-y-1.5">
                  {p.texto.split('\n\n').map((par, j) => (
                    <p
                      key={j}
                      className="text-[11px] leading-relaxed text-slate-300"
                      dangerouslySetInnerHTML={{
                        __html: par.replace(/\*\*(.+?)\*\*/g, '<strong class="text-slate-100">$1</strong>')
                                   .replace(/`(.+?)`/g, '<code class="rounded bg-slate-800 px-1 text-[10px] text-sky-300">$1</code>'),
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        }
        if (p.tipo === 'figura') return <TarjetaFigura key={`fig${p.numero}`} p={p} />;
        return <TarjetaTabla key={`tab${p.numero}`} p={p} />;
      })}
    </div>
  );
};
