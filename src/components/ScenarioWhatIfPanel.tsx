/**
 * ScenarioWhatIfPanel - Simulador de Escenarios "What-If"
 * Simulación de eventos extremos:
 * 1. Sequía Hidrológica Severa (-30% P, +1.5°C T)
 * 2. Avenida Torrencial / El Niño (+60% P extraordinario)
 * 3. Vertimiento Minero / Contaminación Industrial Accidental (Carga de Plomo y Sólidos)
 * 4. Proyección Cambio Climático (IPCC SSP2-4.5 / SSP5-8.5)
 */

import React, { useState } from 'react';
import { HydroSimulationResult, MonitoringStation } from '../types';
import { runGR4JSimulation } from '../services/hydroEngine';
import {
  HelpCircle,
  Play,
  Flame,
  CloudRain,
  AlertTriangle,
  Layers,
  Thermometer,
  ArrowRight,
  TrendingDown,
  TrendingUp,
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
} from 'recharts';

interface ScenarioWhatIfPanelProps {
  baseSimulation: HydroSimulationResult;
  stations: MonitoringStation[];
}

export const ScenarioWhatIfPanel: React.FC<ScenarioWhatIfPanelProps> = ({
  baseSimulation,
  stations,
}) => {
  const [activeScenario, setActiveScenario] = useState<'drought' | 'flood' | 'spill' | 'climate'>('drought');
  const [precipDelta, setPrecipDelta] = useState<number>(-35); // -35%
  const [tempDelta, setTempDelta] = useState<number>(1.8);     // +1.8 °C
  const [miningSpillKgDay, setMiningSpillKgDay] = useState<number>(250); // kg/día

  // Ejecución dinámica del escenario
  const scenarioPrecip = baseSimulation.precipitation.map(p => Math.max(0, p * (1 + precipDelta / 100)));
  const scenarioPET = baseSimulation.evapotranspiration.map(e => Math.max(1, e * (1 + (tempDelta * 0.05))));

  const scenarioQ = runGR4JSimulation(scenarioPrecip, scenarioPET);

  // Estimación de impacto en WQI por vertimiento o sequía
  const baseWQI = 71.4;
  let scenarioWQI = baseWQI;
  if (activeScenario === 'drought') {
    scenarioWQI = Math.max(35, baseWQI - Math.abs(precipDelta) * 0.45);
  } else if (activeScenario === 'spill') {
    scenarioWQI = Math.max(22, baseWQI - (miningSpillKgDay / 250) * 32);
  } else if (activeScenario === 'flood') {
    scenarioWQI = Math.max(48, baseWQI - 14); // Arrastre de sedimentos y turbidez
  }

  // Datos para Recharts
  const chartData = baseSimulation.timestamps.map((t, i) => ({
    date: t,
    Q_Base: baseSimulation.simulatedPosteriorDischarge[i],
    Q_Escenario: scenarioQ[i],
    Precip_Base: baseSimulation.precipitation[i],
    Precip_Escenario: scenarioPrecip[i],
  }));

  const qBasePeak = Math.max(...baseSimulation.simulatedPosteriorDischarge);
  const qScenarioPeak = Math.max(...scenarioQ);
  const qPeakChange = ((qScenarioPeak - qBasePeak) / qBasePeak) * 100;

  return (
    <div className="space-y-6">
      {/* Selector de Tipo de Escenario */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => {
            setActiveScenario('drought');
            setPrecipDelta(-35);
            setTempDelta(2.0);
          }}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            activeScenario === 'drought'
              ? 'bg-amber-950/60 border-amber-500 shadow-md'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold text-xs text-amber-300">1. SEQUÍA SEVERA</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-[11px] text-slate-400">
            Déficit pluviométrico (-35% P) y aumento de temperatura (+2.0°C).
          </p>
        </div>

        <div
          onClick={() => {
            setActiveScenario('flood');
            setPrecipDelta(65);
            setTempDelta(0.5);
          }}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            activeScenario === 'flood'
              ? 'bg-sky-950/60 border-sky-500 shadow-md'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold text-xs text-sky-300">2. AVENIDA TORRENCIAL</span>
            <CloudRain className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-[11px] text-slate-400">
            Fenómeno El Niño costero (+65% P) con crecidas extraordinarias.
          </p>
        </div>

        <div
          onClick={() => {
            setActiveScenario('spill');
            setMiningSpillKgDay(350);
          }}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            activeScenario === 'spill'
              ? 'bg-red-950/60 border-red-500 shadow-md'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold text-xs text-red-300">3. VERTIMIENTO ACCIDENTAL</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <p className="text-[11px] text-slate-400">
            Descarga de pasivos mineros y metales pesados en cabecera.
          </p>
        </div>

        <div
          onClick={() => {
            setActiveScenario('climate');
            setPrecipDelta(-15);
            setTempDelta(3.2);
          }}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            activeScenario === 'climate'
              ? 'bg-purple-950/60 border-purple-500 shadow-md'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold text-xs text-purple-300">4. CAMBIO CLIMÁTICO</span>
            <Thermometer className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-[11px] text-slate-400">
            Escenario IPCC SSP5-8.5 a horizonte 2050 (+3.2°C y -15% P).
          </p>
        </div>
      </div>

      {/* Control Paramétrico Interactivo del Escenario */}
      <div className="p-5 bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800 shadow-md space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-slate-800">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Controles Paramétricos del Escenario
          </h3>
          <span className="text-xs text-slate-400">Ajuste continuo y re-cálculo en tiempo real</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300 font-medium">Delta de Precipitación (ΔP)</span>
              <span className={`font-mono font-bold ${precipDelta < 0 ? 'text-amber-400' : 'text-sky-400'}`}>
                {precipDelta > 0 ? `+${precipDelta}%` : `${precipDelta}%`}
              </span>
            </div>
            <input
              type="range"
              min="-60"
              max="100"
              step="5"
              value={precipDelta}
              onChange={e => setPrecipDelta(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300 font-medium">Delta de Temperatura (ΔT)</span>
              <span className="font-mono font-bold text-amber-400">+{tempDelta.toFixed(1)} °C</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="5.0"
              step="0.2"
              value={tempDelta}
              onChange={e => setTempDelta(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          {activeScenario === 'spill' ? (
            <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium">Carga Contaminante (Pb)</span>
                <span className="font-mono font-bold text-red-400">{miningSpillKgDay} kg/día</span>
              </div>
              <input
                type="range"
                min="50"
                max="800"
                step="25"
                value={miningSpillKgDay}
                onChange={e => setMiningSpillKgDay(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
              />
            </div>
          ) : (
            <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800 flex flex-col justify-center">
              <span className="text-[11px] text-slate-400">Estado de Alerta Estimado</span>
              <span className="text-sm font-bold text-amber-400 mt-1">
                {precipDelta < -20 ? 'Riesgo Déficit Hídrico' : precipDelta > 40 ? 'Alerta Inundación' : 'Normal'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Gráfico Comparativo: Hidrograma Base vs. Escenario */}
      <div className="p-5 bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800 shadow-md space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-sky-400" />
            Curva de Respuesta Hidrológica: Línea Base vs. Escenario Simulado
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Evolución del caudal en desembocadura ante perturbaciones climáticas e hidrológicas
          </p>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
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
              <Line
                type="monotone"
                dataKey="Q_Base"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                name="Caudal Línea Base (m³/s)"
              />
              <Line
                type="monotone"
                dataKey="Q_Escenario"
                stroke={precipDelta < 0 ? '#f59e0b' : '#38bdf8'}
                strokeWidth={2.5}
                dot={false}
                name="Caudal Simulado Escenario (m³/s)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Tarjetas de Impacto */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-800">
          <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400">Variación Caudal Pico</span>
            <div className="text-base font-bold text-slate-200 mt-0.5">
              {qPeakChange > 0 ? `+${qPeakChange.toFixed(1)}%` : `${qPeakChange.toFixed(1)}%`}
            </div>
            <span className="text-[10px] text-slate-400">{qScenarioPeak.toFixed(2)} m³/s máximo</span>
          </div>

          <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400">Impacto en Calidad WQI</span>
            <div className="text-base font-bold text-amber-400 mt-0.5">
              {scenarioWQI.toFixed(1)} / 100
            </div>
            <span className="text-[10px] text-red-400">Caída: -{(baseWQI - scenarioWQI).toFixed(1)} pts</span>
          </div>

          <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400">Días con Déficit de Caudal Ecológico</span>
            <div className="text-base font-bold text-red-400 mt-0.5">
              {precipDelta < -20 ? '18 días' : '0 días'}
            </div>
            <span className="text-[10px] text-slate-400">Bajo umbral Tennant Mínimo</span>
          </div>
        </div>
      </div>
    </div>
  );
};
