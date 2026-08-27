/**
 * EcologicalFlowPanel - Evaluación de Caudales Ecológicos y Ambientales
 * Métodos:
 * 1. Hidrológico: Tennant (Montana), Curva de Duración de Caudales (Q90, Q95), 7Q10.
 * 2. Hidráulico: Curva de Perímetro Mojado (Wetted Perimeter Inflection Point).
 * 3. Monitor de Balance y Alertas de Déficit Ecológico.
 */

import React, { useState } from 'react';
import { EcologicalFlowBenchmark, MonitoringStation, HydroSimulationResult } from '../types';
import {
  calculateFlowDurationCurve,
  calculateWettedPerimeterCurve,
  calculateTennantFlows,
} from '../services/eflowEngine';
import {
  Droplets,
  Layers,
  ShieldCheck,
  AlertTriangle,
  Activity,
  ArrowRight,
  TrendingDown,
  Info,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { useI18n } from '../providers/I18nProvider';

interface EcologicalFlowPanelProps {
  benchmarks: EcologicalFlowBenchmark[];
  stations: MonitoringStation[];
  simulationResult: HydroSimulationResult;
}

export const EcologicalFlowPanel: React.FC<EcologicalFlowPanelProps> = ({
  benchmarks,
  stations,
  simulationResult,
}) => {
  const { t } = useI18n();

  const [selectedBenchmark, setSelectedBenchmark] = useState<EcologicalFlowBenchmark>(benchmarks[0]);
  const [isHighFlowSeason, setIsHighFlowSeason] = useState<boolean>(false);

  // 1. Curva de Duración de Caudales (FDC)
  const fdcData = calculateFlowDurationCurve(simulationResult.simulatedPosteriorDischarge);

  // 2. Curva Hidráulica de Perímetro Mojado
  const { curve: wettedPerimeterCurve, inflectionQ } = calculateWettedPerimeterCurve(8.0, 1.5, 0.015, 0.038);

  // 3. Distribución mensual de Tennant
  const tennantLevels = calculateTennantFlows(selectedBenchmark.meanAnnualFlow, isHighFlowSeason);

  const monthlyChartData = selectedBenchmark.monthlyRequirements.map(m => ({
    month: m.month,
    Tennant_Optimo: m.tennantOptimum,
    Tennant_Minimo: m.tennantMin,
    Q95_Excedencia: m.q95,
    Perimetro_Mojado: m.wettedPerimeterCriticalQ,
  }));

  return (
    <div className="space-y-6">
      {/* Selector de Estación de Control Ecológico */}
      <div className="p-4 bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Droplets className="w-4 h-4 text-emerald-400" />
            {t('eflow.title')}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('eflow.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 font-medium">{t('eflow.station.label')}:</label>
          <select
            value={selectedBenchmark.stationId}
            onChange={e => {
              const found = benchmarks.find(b => b.stationId === e.target.value);
              if (found) setSelectedBenchmark(found);
            }}
            className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            {benchmarks.map(b => (
              <option key={b.stationId} value={b.stationId}>
                {b.stationName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid: FDC y Perímetro Mojado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Curva de Duración de Caudales (FDC) */}
        <div className="p-5 bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800 shadow-md space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                {t('eflow.fdc.title')}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {t('eflow.fdc.subtitle')}
              </p>
            </div>
            <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 text-xs font-mono">
              Q95: {fdcData.find(d => d.exceedanceProbability === 95)?.discharge || 1.85} m³/s
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={fdcData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="exceedanceProbability" stroke="#64748b" fontSize={11} unit="%" />
                <YAxis stroke="#64748b" fontSize={11} unit=" m³/s" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#f8fafc',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="discharge"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  name={t('eflow.fdc.series')}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="text-xs text-slate-400 pt-2 border-t border-slate-800 flex justify-between">
            <span>{t('eflow.fdc.q50')}: <strong>6.40 m³/s</strong></span>
            <span className="text-emerald-400">{t('eflow.fdc.q95eco')}: <strong>1.85 m³/s</strong></span>
          </div>
        </div>

        {/* Método Hidráulico: Perímetro Mojado */}
        <div className="p-5 bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800 shadow-md space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                {t('eflow.wetted.title')}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {t('eflow.wetted.subtitle')}
              </p>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 text-xs font-mono">
              {t('eflow.wetted.inflection')}: {inflectionQ.toFixed(2)} m³/s
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={wettedPerimeterCurve.slice(0, 30)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="discharge" stroke="#64748b" fontSize={11} unit=" m³/s" />
                <YAxis stroke="#64748b" fontSize={11} unit=" m" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#f8fafc',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="wettedPerimeter"
                  stroke="#38bdf8"
                  strokeWidth={2.5}
                  dot={false}
                  name={t('eflow.wetted.series')}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="text-xs text-slate-400 pt-2 border-t border-slate-800 flex justify-between">
            <span>{t('eflow.wetted.bedWidth')}: <strong>8.0 m</strong></span>
            <span className="text-sky-400">{t('eflow.wetted.habitatThreshold')}: <strong>{inflectionQ.toFixed(2)} m³/s</strong></span>
          </div>
        </div>
      </div>

      {/* Requerimientos Mensuales: Tennant vs Q95 */}
      <div className="p-5 bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800 shadow-md space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              {t('eflow.monthly.title')} ({selectedBenchmark.stationName})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('eflow.monthly.subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsHighFlowSeason(false)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                !isHighFlowSeason ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              {t('eflow.season.low')}
            </button>
            <button
              onClick={() => setIsHighFlowSeason(true)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                isHighFlowSeason ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              {t('eflow.season.high')}
            </button>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} unit=" m³/s" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#f8fafc',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Bar dataKey="Tennant_Optimo" fill="#059669" name={t('eflow.series.tennantOptimum')} />
              <Bar dataKey="Tennant_Minimo" fill="#10b981" name={t('eflow.series.tennantMinimum')} />
              <Bar dataKey="Q95_Excedencia" fill="#0ea5e9" name={t('eflow.series.q95')} />
              <Bar dataKey="Perimetro_Mojado" fill="#f59e0b" name={t('eflow.series.wettedCritical')} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
