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

interface Documento {
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
