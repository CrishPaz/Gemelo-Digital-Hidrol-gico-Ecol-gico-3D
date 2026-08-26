/**
 * HydroEnKFPanel - Modelado Hidrológico GR4J y Asimilación Secuencial EnKF
 * Permite ejecutar el filtro de Kalman por ensambles (N=50), comparar estados
 * a priori vs. a posteriori, y cuantificar la reducción de incertidumbre (P10-P90).
 */

import React, { useState } from 'react';
import { HydroSimulationResult } from '../types';
import { GR4JParameters, DEFAULT_MOCHE_GR4J_PARAMS } from '../services/hydroEngine';
import { EnKFConfig, DEFAULT_ENKF_CONFIG, runEnKFAssimilation } from '../services/enkfEngine';
import {
  Waves,
  Sliders,
  Play,
  RotateCcw,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import {
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface HydroEnKFPanelProps {
  simulationResult: HydroSimulationResult;
  onUpdateSimulation: (newRes: HydroSimulationResult) => void;
}

export const HydroEnKFPanel: React.FC<HydroEnKFPanelProps> = ({
  simulationResult,
  onUpdateSimulation,
}) => {
  const [params, setParams] = useState<GR4JParameters>(DEFAULT_MOCHE_GR4J_PARAMS);
  const [enkfConfig, setEnkfConfig] = useState<EnKFConfig>(DEFAULT_ENKF_CONFIG);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [showUncertaintyBands, setShowUncertaintyBands] = useState<boolean>(true);

  // Ejecutar nuevo ciclo de asimilación
  const handleRunEnKF = () => {
    setIsSimulating(true);
    setTimeout(() => {
      const newRes = runEnKFAssimilation(
        simulationResult.timestamps,
        simulationResult.precipitation,
        simulationResult.evapotranspiration,
        simulationResult.observedDischarge,
        params,
        enkfConfig
      );
      onUpdateSimulation(newRes);
      setIsSimulating(false);
    }, 400);
  };

  // Restaurar parámetros calibrados de la Cuenca del Moche
  const handleResetDefaults = () => {
    setParams(DEFAULT_MOCHE_GR4J_PARAMS);
    setEnkfConfig(DEFAULT_ENKF_CONFIG);
  };

  // Preparación de datos para Recharts
  const chartData = simulationResult.timestamps.map((t, i) => ({
    date: t,
    Precipitation: simulationResult.precipitation[i],
    Observed: simulationResult.observedDischarge[i],
    Prior_Sim: simulationResult.simulatedPriorDischarge[i],
    EnKF_Post: simulationResult.simulatedPosteriorDischarge[i],
    P10: simulationResult.boundsP10[i],
    P90: simulationResult.boundsP90[i],
  }));

  const mPrior = simulationResult.metricsPrior;
  const mPost = simulationResult.metricsPosterior;

  return (
    <div className="space-y-6">
      {/* Panel de Parámetros Hidrológicos y EnKF */}
      <div className="p-5 bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800 shadow-md space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-sky-400" />
              Configuración del Modelo Hidrológico GR4J y Asimilador EnKF
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Ajuste dinámico de parámetros físicos de suelo, ruteo y ensambles estocásticos
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetDefaults}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Calibración Moche
            </button>
            <button
              onClick={handleRunEnKF}
              disabled={isSimulating}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-900/40 transition-all disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {isSimulating ? 'Asimilando...' : 'Ejecutar Ciclo EnKF'}
            </button>
          </div>
        </div>

        {/* Sliders de Parámetros GR4J */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          {/* X1: Capacidad Producción */}
          <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300 font-medium">X1 (Capacidad Suelo S)</span>
              <span className="font-mono text-sky-400">{params.x1.toFixed(1)} mm</span>
            </div>
            <input
              type="range"
              min="100"
              max="1200"
              step="10"
              value={params.x1}
              onChange={e => setParams({ ...params, x1: Number(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="text-[10px] text-slate-500">Rango: 100 - 1200 mm</span>
          </div>

          {/* X2: Intercambio Subterráneo */}
          <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300 font-medium">X2 (Intercambio F)</span>
              <span className="font-mono text-sky-400">{params.x2.toFixed(2)} mm/d</span>
            </div>
            <input
              type="range"
              min="-4.0"
              max="4.0"
              step="0.05"
              value={params.x2}
              onChange={e => setParams({ ...params, x2: Number(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="text-[10px] text-slate-500">Rango: -4.0 a +4.0 mm/d</span>
          </div>

          {/* X3: Reservorio Ruteo */}
          <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300 font-medium">X3 (Ruteo R)</span>
              <span className="font-mono text-sky-400">{params.x3.toFixed(1)} mm</span>
            </div>
            <input
              type="range"
              min="20"
              max="350"
              step="5"
              value={params.x3}
              onChange={e => setParams({ ...params, x3: Number(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="text-[10px] text-slate-500">Rango: 20 - 350 mm</span>
          </div>

          {/* X4: Tiempo Base UH1 */}
          <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300 font-medium">X4 (Tiempo Base UH)</span>
              <span className="font-mono text-sky-400">{params.x4.toFixed(2)} días</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="4.0"
              step="0.05"
              value={params.x4}
              onChange={e => setParams({ ...params, x4: Number(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="text-[10px] text-slate-500">Rango: 0.5 - 4.0 días</span>
          </div>
        </div>

        {/* Configuración EnKF */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between p-2.5 bg-slate-950/50 rounded-lg border border-slate-800 text-xs">
            <span className="text-slate-400">Tamaño del Ensamble:</span>
            <span className="font-bold text-slate-200">N = {enkfConfig.ensembleSize} miembros</span>
          </div>
          <div className="flex items-center justify-between p-2.5 bg-slate-950/50 rounded-lg border border-slate-800 text-xs">
            <span className="text-slate-400">Ruido Precipitación (σ_P):</span>
            <span className="font-bold text-slate-200">{(enkfConfig.precipErrorCoeffVar * 100).toFixed(0)}% Log-Normal</span>
          </div>
          <div className="flex items-center justify-between p-2.5 bg-slate-950/50 rounded-lg border border-slate-800 text-xs">
            <span className="text-slate-400">Error Observación (σ_obs):</span>
            <span className="font-bold text-slate-200">{(enkfConfig.obsErrorCoeffVar * 100).toFixed(0)}% Gaussiano</span>
          </div>
        </div>
      </div>

      {/* Gráfico Principal de Hidrograma y Asimilación EnKF */}
      <div className="p-5 bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800 shadow-md space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Waves className="w-4 h-4 text-emerald-400" />
              Hidrograma de Asimilación EnKF: Observado vs. A Priori vs. A Posteriori
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Evaluación hidrológica continua con cuantificación de incertidumbre (P10 - P90)
            </p>
          </div>

          <button
            onClick={() => setShowUncertaintyBands(!showUncertaintyBands)}
            className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
              showUncertaintyBands
                ? 'bg-blue-950/70 text-blue-300 border-blue-600/50'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {showUncertaintyBands ? 'Ocultar Banda P10-P90' : 'Mostrar Banda P10-P90'}
          </button>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 15, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
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
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />

              {/* Banda de Incertidumbre Ensamble */}
              {showUncertaintyBands && (
                <>
                  <Area
                    type="monotone"
                    dataKey="P90"
                    stroke="transparent"
                    fill="#94a3b8"
                    fillOpacity={0.25}
                    name="Percentil P90"
                  />
                  <Area
                    type="monotone"
                    dataKey="P10"
                    stroke="transparent"
                    fill="#0f172a"
                    name="Percentil P10"
                  />
                </>
              )}

              {/* Simulación A Priori (Open Loop) */}
              <Line
                type="monotone"
                dataKey="Prior_Sim"
                stroke="#f59e0b"
                strokeWidth={1.8}
                strokeDasharray="4 4"
                dot={false}
                name="Modelo A Priori (Sin Asimilación)"
              />

              {/* Simulación A Posteriori (EnKF) */}
              <Line
                type="monotone"
                dataKey="EnKF_Post"
                stroke="#0ea5e9"
                strokeWidth={2.4}
                dot={false}
                name="Asimilado EnKF (A Posteriori)"
              />

              {/* Caudal Observado / Aforado */}
              <Line
                type="monotone"
                dataKey="Observed"
                stroke="#10b981"
                strokeWidth={2.2}
                dot={{ r: 2 }}
                name="Caudal Observado (IoT / Aforos)"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Tabla Comparativa de Rendimiento Estadístico (Metrics Scorecard) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800">
          <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400">NSE (Nash-Sutcliffe)</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-lg font-bold text-emerald-400">{mPost.nse}</span>
              <span className="text-xs text-slate-400 font-mono">previo: {mPrior.nse}</span>
            </div>
            <span className="text-[10px] text-emerald-400">Mejora: +{((mPost.nse - mPrior.nse) * 100).toFixed(1)}%</span>
          </div>

          <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400">KGE (Kling-Gupta)</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-lg font-bold text-sky-400">{mPost.kge}</span>
              <span className="text-xs text-slate-400 font-mono">previo: {mPrior.kge}</span>
            </div>
            <span className="text-[10px] text-sky-400">Mejora: +{((mPost.kge - mPrior.kge) * 100).toFixed(1)}%</span>
          </div>

          <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400">RMSE (Error Cuadrático)</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-lg font-bold text-slate-200">{mPost.rmse}</span>
              <span className="text-xs text-slate-400 font-mono">m³/s</span>
            </div>
            <span className="text-[10px] text-emerald-400">Reducción: -{(((mPrior.rmse - mPost.rmse) / mPrior.rmse) * 100).toFixed(1)}%</span>
          </div>

          <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400">PBIAS (Sesgo Porcentual)</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-lg font-bold text-slate-200">{mPost.pbias}%</span>
              <span className="text-xs text-slate-400 font-mono">previo: {mPrior.pbias}%</span>
            </div>
            <span className="text-[10px] text-emerald-400">Sesgo casi nulo</span>
          </div>
        </div>
      </div>
    </div>
  );
};
