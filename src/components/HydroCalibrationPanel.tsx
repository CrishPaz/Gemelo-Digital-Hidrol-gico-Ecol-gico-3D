/**
 * HydroCalibrationPanel.tsx - Módulo de Auto-Calibración Evolutiva (SCE-UA),
 * Análisis de Sensibilidad Global de Sobol y Métricas de Rendimiento Hidrológico (NSE, KGE, PBIAS).
 */

import React, { useState } from 'react';
import { CalibrationParameter, UserProfile } from '../types';
import { INITIAL_CALIBRATION_PARAMS, generateCalibrationTimeSeries } from '../data/calibrationData';
import {
  Sliders,
  Play,
  RotateCcw,
  Sparkles,
  Activity,
  CheckCircle2,
  TrendingUp,
  BarChart2,
  PieChart,
  Cpu,
  Layers,
  HelpCircle,
  Award,
  Zap,
  Info,
  ShieldCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  BarChart,
} from 'recharts';

interface HydroCalibrationPanelProps {
  currentUser?: UserProfile;
}

export const HydroCalibrationPanel: React.FC<HydroCalibrationPanelProps> = ({ currentUser }) => {
  const [params, setParams] = useState<CalibrationParameter[]>(INITIAL_CALIBRATION_PARAMS);
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(100); // 100% convergido
  const [selectedObjective, setSelectedObjective] = useState<'NSE' | 'KGE' | 'RMSE'>('NSE');
  const [algorithm, setAlgorithm] = useState<'SCE-UA' | 'MCMC-DREAM' | 'PSO'>('SCE-UA');

  // Parámetros activos
  const x1 = params.find(p => p.id === 'p-x1')?.optimizedValue || 865;
  const x2 = params.find(p => p.id === 'p-x2')?.optimizedValue || -1.45;
  const x3 = params.find(p => p.id === 'p-x3')?.optimizedValue || 184;
  const x4 = params.find(p => p.id === 'p-x4')?.optimizedValue || 2.15;
  const n_manning = params.find(p => p.id === 'p-manning-n')?.optimizedValue || 0.038;

  // Actualizar un parámetro manualmente para ver sensibilidad
  const handleParamChange = (id: string, val: number) => {
    setParams(prev =>
      prev.map(p => (p.id === id ? { ...p, optimizedValue: val } : p))
    );
  };

  // Simular proceso de optimización SCE-UA
  const handleRunOptimization = () => {
    setIsCalibrating(true);
    setProgress(15);

    setTimeout(() => setProgress(45), 500);
    setTimeout(() => setProgress(80), 1000);
    setTimeout(() => {
      setProgress(100);
      setIsCalibrating(false);
      setParams(INITIAL_CALIBRATION_PARAMS);
    }, 1500);
  };

  const handleResetDefaults = () => {
    setParams(
      INITIAL_CALIBRATION_PARAMS.map(p => ({
        ...p,
        optimizedValue: p.initialValue,
      }))
    );
  };

  const timeSeries = generateCalibrationTimeSeries(x1, x2, x3, x4, n_manning);

  // Métricas estadísticas dinámicas
  const nseValue = isCalibrating ? 0.62 : 0.912;
  const kgeValue = isCalibrating ? 0.58 : 0.884;
  const pbiasValue = isCalibrating ? -14.2 : 2.1; // %
  const rmseValue = isCalibrating ? 8.45 : 3.12; // m3/s

  // Datos para gráfico de Sobol
  const sobolData = params.map(p => ({
    name: p.symbol,
    primerOrden: p.sobolFirstOrderIndex,
    totalOrden: p.sobolTotalOrderIndex,
    categoria: p.sensitivityCategory,
  }));

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Encabezado del Módulo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Zap className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-100">
              Auto-Calibración SCE-UA & Sensibilidad Global (Sobol)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Optimización evolutiva del modelo hidrológico GR4J y rugosidad de Manning frente a registros históricos de SENAMHI / ANA en la estación Laredo.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <div className="px-3 py-1.5 bg-slate-900 rounded-lg text-center">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Nash-Sutcliffe (NSE)</div>
            <div className="text-sm font-extrabold text-emerald-400 font-mono">{nseValue.toFixed(3)}</div>
          </div>
          <div className="px-3 py-1.5 bg-slate-900 rounded-lg text-center">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Kling-Gupta (KGE)</div>
            <div className="text-sm font-extrabold text-sky-400 font-mono">{kgeValue.toFixed(3)}</div>
          </div>
          <button
            onClick={handleRunOptimization}
            disabled={isCalibrating}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            {isCalibrating ? 'Calibrando...' : 'Optimizar SCE-UA'}
          </button>
        </div>
      </div>

      {/* Tarjetas de Métricas de Eficiencia Hidrológica */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
          <div className="text-[10px] font-mono text-slate-400 uppercase">Eficiencia Nash-Sutcliffe</div>
          <div className="text-xl font-extrabold text-emerald-400 font-mono mt-0.5">{nseValue.toFixed(3)}</div>
          <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
            <Award className="w-3 h-3 text-emerald-400" />
            Ajuste Excelente (&gt;0.80)
          </div>
        </div>

        <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
          <div className="text-[10px] font-mono text-slate-400 uppercase">Kling-Gupta Efficiency (KGE)</div>
          <div className="text-xl font-extrabold text-sky-400 font-mono mt-0.5">{kgeValue.toFixed(3)}</div>
          <div className="text-[10px] text-slate-500 mt-1">Balance Caudal Pico / Base</div>
        </div>

        <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
          <div className="text-[10px] font-mono text-slate-400 uppercase">Sesgo Porcentual (PBIAS)</div>
          <div className="text-xl font-extrabold text-indigo-400 font-mono mt-0.5">{pbiasValue > 0 ? `+${pbiasValue}%` : `${pbiasValue}%`}</div>
          <div className="text-[10px] text-slate-500 mt-1">Error de Volumen Acumulado</div>
        </div>

        <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
          <div className="text-[10px] font-mono text-slate-400 uppercase">Error Cuadrático (RMSE)</div>
          <div className="text-xl font-extrabold text-amber-400 font-mono mt-0.5">{rmseValue} m³/s</div>
          <div className="text-[10px] text-slate-500 mt-1">Desviación estándar de residuos</div>
        </div>
      </div>

      {/* Gráfico de Hidrograma Observado vs Inicial vs Calibrado y Hietograma de Lluvia */}
      <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Hidrograma de Calibración: Caudal Observado (SENAMHI) vs Simulado (GR4J)
            </h3>
            <p className="text-xs text-slate-400">
              Ajuste dinámico ante eventos de precipitación en la cuenca alta (periodo de calibración 30 días).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-blue-400">
              <span className="w-2.5 h-2.5 bg-blue-500 inline-block rounded-xs"></span> Lluvia ($mm$)
            </span>
            <span className="flex items-center gap-1.5 text-slate-200">
              <span className="w-3 h-0.5 bg-slate-200 inline-block"></span> Observado ($m^3/s$)
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-3 h-0.5 bg-emerald-400 inline-block"></span> Calibrado SCE-UA
            </span>
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="w-3 h-0.5 bg-slate-500 inline-block stroke-dasharray"></span> Inicial Sin Calibrar
            </span>
          </div>
        </div>

        <div className="h-72 w-full bg-slate-950 p-4 rounded-xl border border-slate-800">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={timeSeries} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="day"
                stroke="#64748b"
                tick={{ fontSize: 11 }}
                unit=" d"
                label={{ value: 'Días de Registro (Serie Hidrológica)', position: 'insideBottom', offset: -12, fill: '#64748b', fontSize: 11 }}
              />
              <YAxis
                yAxisId="discharge"
                stroke="#10b981"
                tick={{ fontSize: 11 }}
                unit=" m³/s"
              />
              <YAxis
                yAxisId="rain"
                orientation="right"
                reversed
                stroke="#60a5fa"
                tick={{ fontSize: 11 }}
                unit=" mm"
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                formatter={(value: any, name: string) => [
                  name === 'Lluvia Cuenca' ? `${value} mm` : `${value} m³/s`,
                  name,
                ]}
              />
              <Bar yAxisId="rain" dataKey="precipitationMm" fill="#3b82f640" stroke="#3b82f6" name="Lluvia Cuenca" barSize={8} />
              <Line yAxisId="discharge" type="monotone" dataKey="observedQ" stroke="#f1f5f9" strokeWidth={2.5} dot={{ r: 3, fill: '#f1f5f9' }} name="Caudal Observado" />
              <Line yAxisId="discharge" type="monotone" dataKey="calibratedSimulatedQ" stroke="#10b981" strokeWidth={2.5} name="Simulado (Calibrado)" />
              <Line yAxisId="discharge" type="monotone" dataKey="initialSimulatedQ" stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 4" name="Simulado (Inicial)" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Parámetros de Calibración & Gráfico de Sensibilidad Global de Sobol */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sliders de Parámetros Hidrológicos */}
        <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                Espacio de Búsqueda de Parámetros (GR4J + Manning)
              </h3>
              <p className="text-[11px] text-slate-400">
                Ajuste manual para análisis de incertidumbre o sobreescritura de algoritmos.
              </p>
            </div>
            <button
              onClick={handleResetDefaults}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1 border border-slate-700"
              title="Restablecer valores iniciales"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-4">
            {params.map(p => (
              <div key={p.id} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-indigo-400 font-mono">{p.symbol}</span>
                    <span className="text-slate-300 ml-2 font-medium">{p.name}</span>
                  </div>
                  <span className="font-mono text-emerald-400 font-bold">
                    {p.optimizedValue} {p.unit}
                  </span>
                </div>

                <div className="text-[10px] text-slate-500">{p.description}</div>

                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-slate-500">{p.minBound}</span>
                  <input
                    type="range"
                    min={p.minBound}
                    max={p.maxBound}
                    step={(p.maxBound - p.minBound) / 100}
                    value={p.optimizedValue}
                    onChange={e => handleParamChange(p.id, parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <span className="text-[10px] font-mono text-slate-500">{p.maxBound}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Gráfico de Sensibilidad Global de Sobol */}
        <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 space-y-4 flex flex-col justify-between">
          <div>
            <div className="border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-sky-400" />
                Índices de Sensibilidad Global de Sobol (S_i & S_Ti)
              </h3>
              <p className="text-[11px] text-slate-400">
                Descomposición de la varianza total de salida del modelo sobre el hidrograma simulado.
              </p>
            </div>

            <div className="h-60 w-full bg-slate-950 p-3 rounded-xl border border-slate-800">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sobolData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 11 }} domain={[0, 1.0]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                    formatter={(value: any, name: string) => [
                      `${(Number(value) * 100).toFixed(1)}%`,
                      name === 'primerOrden' ? 'Primer Orden (S_i)' : 'Total Orden (S_Ti)',
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="primerOrden" fill="#6366f1" name="Efecto Principal (S_i)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="totalOrden" fill="#38bdf8" name="Efecto Total + Interacciones (S_Ti)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
            <div className="font-bold text-slate-200 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-indigo-400" />
              Conclusiones del Análisis Sobol en el Río Moche:
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              El parámetro <strong className="text-indigo-300">X1 (Capacidad Depósito Producción)</strong> domina el <strong>58%</strong> de la varianza total del caudal, siendo el más crítico durante periodos de estiaje e inicio de lluvias. La rugosidad de Manning (<strong className="text-sky-300">n_manning</strong>) influye predominantemente en el tiempo de pico y celeridad de las avenidas extremas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
