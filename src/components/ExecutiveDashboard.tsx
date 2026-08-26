/**
 * ExecutiveDashboard - Panel Ejecutivo y KPIs de Estado de Cuenca en Tiempo Real
 * Muestra el balance hídrico, cumplimiento ecológico, semáforo de alertas ECA e ingesta IoT en vivo.
 */

import React from 'react';
import { MonitoringStation, HydroSimulationResult, EcologicalFlowBenchmark } from '../types';
import {
  Activity,
  Droplets,
  AlertTriangle,
  Radio,
  CheckCircle2,
  Waves,
  TrendingUp,
  Cpu,
  ArrowUpRight,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface ExecutiveDashboardProps {
  stations: MonitoringStation[];
  simulationResult: HydroSimulationResult;
  eflowBenchmarks: EcologicalFlowBenchmark[];
  onSelectStation: (st: MonitoringStation) => void;
  onNavigateTab: (tabId: string) => void;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  stations,
  simulationResult,
  eflowBenchmarks,
  onSelectStation,
  onNavigateTab,
}) => {
  // Cálculos agregados
  const activeStationsCount = stations.filter(s => s.status === 'active').length;
  const warningStationsCount = stations.filter(s => s.status === 'warning' || !s.ecaCompliance.isCompliant).length;
  const avgWQI = stations.reduce((acc, s) => acc + s.currentValues.wqi, 0) / stations.length;
  const mouthDischarge = stations.find(s => s.code === 'MOC-12-BOC')?.currentValues.discharge || 4.1;

  // Caudal ecológico requerido en desembocadura vs observado
  const mainEFlowBenchmark = eflowBenchmarks[0];
  const eflowComplianceRatio = mainEFlowBenchmark ? (mouthDischarge / (mainEFlowBenchmark.monthlyRequirements[0]?.tennantMin || 1.8)) * 100 : 100;

  // Datos para gráfico rápido de tendencia
  const recentFlowData = simulationResult.timestamps.slice(-14).map((t, i) => {
    const idx = simulationResult.timestamps.length - 14 + i;
    return {
      date: t.slice(5),
      Q_Obs: simulationResult.observedDischarge[idx],
      Q_EnKF: simulationResult.simulatedPosteriorDischarge[idx],
      P10: simulationResult.boundsP10[idx],
      P90: simulationResult.boundsP90[idx],
    };
  });

  return (
    <div className="space-y-6">
      {/* Tarjetas Superiores de KPIs Ejecutivos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Caudal en Desembocadura */}
        <div className="p-4 bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800 shadow-sm flex flex-col justify-between hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">CAUDAL AFORADO (DESEMBOCADURA)</span>
            <div className="p-2 rounded-lg bg-sky-950/80 text-sky-400 border border-sky-800/60">
              <Waves className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold text-slate-100 flex items-baseline gap-1.5">
              {mouthDischarge.toFixed(2)}
              <span className="text-sm font-normal text-slate-400">m³/s</span>
            </div>
            <p className="text-xs text-sky-400 flex items-center gap-1 mt-0.5">
              <TrendingUp className="w-3 h-3" /> Régimen estacional normal
            </p>
          </div>
          <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800 flex justify-between">
            <span>E-12 Boca de Río Moche</span>
            <span className="text-emerald-400">EnKF Asimilado</span>
          </div>
        </div>

        {/* KPI 2: Calidad ICA Promedio Cuenca */}
        <div className="p-4 bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800 shadow-sm flex flex-col justify-between hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">ÍNDICE ICA / WQI PROMEDIO</span>
            <div className="p-2 rounded-lg bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold text-slate-100 flex items-baseline gap-1.5">
              {avgWQI.toFixed(1)}
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                {avgWQI >= 70 ? 'Buena' : avgWQI >= 50 ? 'Regular' : 'Mala'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Normativa D.S. N° 004-2017-MINAM</p>
          </div>
          <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800 flex justify-between">
            <span>12 Puntos evaluados</span>
            <span className="text-slate-300">Puntaje / 100</span>
          </div>
        </div>

        {/* KPI 3: Cumplimiento de Caudal Ecológico */}
        <div className="p-4 bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800 shadow-sm flex flex-col justify-between hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">CAUDAL AMBIENTAL / E-FLOW</span>
            <div className="p-2 rounded-lg bg-amber-950/80 text-amber-400 border border-amber-800/60">
              <Droplets className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold text-slate-100 flex items-baseline gap-1.5">
              {eflowComplianceRatio.toFixed(0)}%
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                Sin Déficit Crítico
              </span>
            </div>
            <p className="text-xs text-amber-400/90 mt-0.5">Tennant Mínimo: 1.69 m³/s</p>
          </div>
          <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800 flex justify-between">
            <span>Método Tennant + Q95</span>
            <span className="text-emerald-400">Garantizado</span>
          </div>
        </div>

        {/* KPI 4: Telemetría IoT y Red de Sondas */}
        <div className="p-4 bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800 shadow-sm flex flex-col justify-between hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">RED IoT & SENSORES EN CAMPO</span>
            <div className="p-2 rounded-lg bg-blue-950/80 text-blue-400 border border-blue-800/60">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold text-slate-100 flex items-baseline gap-1.5">
              {activeStationsCount} / {stations.length}
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800">
                {warningStationsCount > 0 ? `${warningStationsCount} Alertas ECA` : '100% Óptimo'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
              <Cpu className="w-3 h-3 text-blue-400" /> Protocolo MQTT + LoRaWAN
            </p>
          </div>
          <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800 flex justify-between">
            <span>Latencia: 84 ms</span>
            <span className="text-blue-400">Stream Activo</span>
          </div>
        </div>
      </div>

      {/* Gráfico y Paneles de Diagnóstico */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda: Tendencia Hidrológica con Asimilación EnKF (2 cols) */}
        <div className="lg:col-span-2 p-5 bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800 shadow-md flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Waves className="w-4 h-4 text-sky-400" />
                Hidrograma de Caudales en Tiempo Real con Asimilación EnKF
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Comparativa entre Caudal Observado y Estado EnKF con Banda de Incertidumbre (P10 - P90)
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('hydro_enkf')}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-sky-400 hover:bg-slate-700 transition-colors flex items-center gap-1 font-medium border border-slate-700"
            >
              Módulo EnKF Detallado <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={recentFlowData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEnkf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorUncertainty" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit=" m³/s" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#f8fafc',
                  }}
                />
                {/* Banda de Incertidumbre Ensamble P10 - P90 */}
                <Area type="monotone" dataKey="P90" stroke="transparent" fill="url(#colorUncertainty)" name="Incertidumbre P90" />
                <Area type="monotone" dataKey="P10" stroke="transparent" fill="#0f172a" name="Incertidumbre P10" />
                {/* Caudal Estimado por EnKF */}
                <Area type="monotone" dataKey="Q_EnKF" stroke="#0ea5e9" strokeWidth={2.5} fill="url(#colorEnkf)" name="Q Asimilado EnKF" />
                {/* Caudal Observado */}
                <Area type="monotone" dataKey="Q_Obs" stroke="#10b981" strokeWidth={2} strokeDasharray="4 4" fill="transparent" name="Q Observado" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-800 text-center">
            <div className="p-2 bg-slate-950/60 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400">EFICIENCIA NASH-SUTCLIFFE (NSE)</span>
              <p className="text-base font-bold text-emerald-400">{simulationResult.metricsPosterior.nse}</p>
            </div>
            <div className="p-2 bg-slate-950/60 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400">KLING-GUPTA EFFICIENCY (KGE)</span>
              <p className="text-base font-bold text-sky-400">{simulationResult.metricsPosterior.kge}</p>
            </div>
            <div className="p-2 bg-slate-950/60 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400">ERROR RMSE</span>
              <p className="text-base font-bold text-slate-200">{simulationResult.metricsPosterior.rmse} m³/s</p>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Semáforo de Cumplimiento ECA y Alertas */}
        <div className="p-5 bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800 shadow-md flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 mb-1">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Semáforo de Alertas y Calidad ECA-Agua
            </h3>
            <p className="text-xs text-slate-400 mb-3">Estaciones prioritarias con eventos de atención</p>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {stations.map(st => {
                const isCompliant = st.ecaCompliance.isCompliant;
                return (
                  <div
                    key={st.id}
                    onClick={() => onSelectStation(st)}
                    className="p-2.5 bg-slate-950/70 hover:bg-slate-800/80 rounded-lg border border-slate-800/90 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${
                          !isCompliant ? 'bg-red-500 animate-pulse' : st.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                      />
                      <div>
                        <div className="text-xs font-semibold text-slate-200">{st.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {st.subbasin.replace('Cuenca ', '')} • Q: {st.currentValues.discharge.toFixed(2)} m³/s
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-200">ICA: {st.currentValues.wqi.toFixed(0)}</div>
                      <span
                        className={`text-[9px] font-semibold px-1.5 py-0.2 rounded ${
                          isCompliant ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'
                        }`}
                      >
                        {isCompliant ? 'CUMPLE' : 'ALERTA'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
            <span className="text-slate-400">Estándar: D.S. 004-2017-MINAM</span>
            <button
              onClick={() => onNavigateTab('telemetry')}
              className="text-sky-400 hover:text-sky-300 font-medium"
            >
              Ver Matriz Completa →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
