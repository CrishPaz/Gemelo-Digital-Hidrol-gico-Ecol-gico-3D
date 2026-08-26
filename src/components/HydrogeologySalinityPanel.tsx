/**
 * HydrogeologySalinityPanel.tsx - Módulo de Hidrogeología, Red Piezométrica,
 * Modelo de Cuña Salina (Ghyben-Herzberg) y Balance del Acuífero del Valle Santa Catalina.
 */

import React, { useState } from 'react';
import { GroundwaterWell, UserProfile } from '../types';
import { INITIAL_GROUNDWATER_WELLS, calculateSaltWedgeProfile } from '../data/hydrogeologyData';
import {
  Waves,
  Droplets,
  Gauge,
  Sliders,
  Activity,
  Layers,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Sparkles,
  RefreshCw,
  Compass,
  ArrowDown,
  Anchor,
  TrendingDown,
  Info,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from 'recharts';

interface HydrogeologySalinityPanelProps {
  currentUser?: UserProfile;
}

export const HydrogeologySalinityPanel: React.FC<HydrogeologySalinityPanelProps> = ({ currentUser }) => {
  const [wells, setWells] = useState<GroundwaterWell[]>(INITIAL_GROUNDWATER_WELLS);
  const [selectedWellId, setSelectedWellId] = useState<string>('well-01');

  // Factores de simulación del Acuífero
  const [pumpingFactor, setPumpingFactor] = useState<number>(1.35); // 1.0 = bombeo base, >1.0 = sobreexplotación
  const [rechargeFactor, setRechargeFactor] = useState<number>(0.85); // 1.0 = recarga normal, <1.0 = estiaje/sequía

  const selectedWell = wells.find(w => w.id === selectedWellId) || wells[0];

  // Perfil de la interfase agua dulce / salada (Ghyben-Herzberg)
  const saltWedgeData = calculateSaltWedgeProfile(pumpingFactor, rechargeFactor);

  // Balance general del acuífero (Hm³/año)
  const naturalRecharge = Number((28.5 * rechargeFactor).toFixed(1));
  const riverBedInfiltration = Number((34.2 * rechargeFactor).toFixed(1));
  const irrigationReturn = 18.0;
  const totalInflow = Number((naturalRecharge + riverBedInfiltration + irrigationReturn).toFixed(1));

  const agriculturalPumping = Number((48.0 * pumpingFactor).toFixed(1));
  const industrialPumping = Number((16.5 * pumpingFactor).toFixed(1));
  const domesticPumping = 22.0;
  const totalOutflow = Number((agriculturalPumping + industrialPumping + domesticPumping).toFixed(1));

  const netBalance = Number((totalInflow - totalOutflow).toFixed(1));
  const isDeficit = netBalance < 0;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Encabezado del Módulo Hidrogeológico */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Anchor className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-100">
              Hidrogeología & Modelo de Intrusión Marina (Cuña Salina)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Vigilancia del acuífero costero del Valle Santa Catalina, red piezométrica en tiempo real y ley de Ghyben-Herzberg para salinidad en pozos agrícolas.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <div className="px-3 py-1.5 bg-slate-900 rounded-lg text-center">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Balance Anual</div>
            <div
              className={`text-sm font-extrabold font-mono ${
                isDeficit ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              {netBalance > 0 ? `+${netBalance}` : netBalance} Hm³/año
            </div>
          </div>
          <div className="px-3 py-1.5 bg-slate-900 rounded-lg text-center">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Estado Acuífero</div>
            <div
              className={`text-xs font-extrabold uppercase ${
                isDeficit ? 'text-red-400 animate-pulse' : 'text-emerald-400'
              }`}
            >
              {isDeficit ? 'Sobreexplotado' : 'Equilibrio'}
            </div>
          </div>
        </div>
      </div>

      {/* Red Piezométrica y Pozos de Monitoreo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {wells.map(w => {
          const isSelected = w.id === selectedWellId;
          const isSevere = w.salinityRisk.includes('Severa');
          const isModerate = w.salinityRisk.includes('Moderada');

          return (
            <div
              key={w.id}
              onClick={() => setSelectedWellId(w.id)}
              className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                isSelected
                  ? 'bg-teal-950/40 border-teal-500 shadow-lg'
                  : 'bg-slate-900/80 border-slate-800 hover:bg-slate-850'
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>{w.code} • A {w.distanceToCoastKm} km del Mar</span>
                  <span
                    className={`px-1.5 py-0.2 rounded font-bold text-[9px] uppercase ${
                      isSevere
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : isModerate
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {w.salinityRisk}
                  </span>
                </div>

                <div className="text-xs font-bold text-slate-100 mt-1.5">{w.name}</div>
                <div className="text-[10px] text-slate-400">{w.sector}</div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Conductividad ($CE$):</span>
                  <strong
                    className={
                      w.electricalConductivityUsCm > 3000
                        ? 'text-red-400'
                        : w.electricalConductivityUsCm > 1500
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }
                  >
                    {w.electricalConductivityUsCm} µS/cm
                  </strong>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Nivel Freático:</span>
                  <span className="text-slate-200">-{w.waterTableDepthM} m</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-500">Aptitud Agrícola:</span>
                  <span className="text-slate-300 font-sans font-medium">{w.irrigationSuitability}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Controles de Escenarios Hidrogeológicos */}
      <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-teal-400" />
              Simulador de Interacción Río-Acuífero & Bombeo Agroindustrial
            </h3>
            <p className="text-xs text-slate-400">
              Modela la variación de la recarga fluvial y el régimen de bombeo sobre la posición de la cuña salina marina.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs font-semibold text-slate-300">
              <span>Intensidad de Bombeo Agrícola e Industrial:</span>
              <span className="font-mono text-amber-400 font-bold">{(pumpingFactor * 100).toFixed(0)}% (Base = 100%)</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.2"
              step="0.05"
              value={pumpingFactor}
              onChange={e => setPumpingFactor(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>Racionamiento (50%)</span>
              <span>Actual (135%)</span>
              <span>Sobreexplotación Crítica (220%)</span>
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs font-semibold text-slate-300">
              <span>Recarga e Infiltración del Lecho Fluvial:</span>
              <span className="font-mono text-teal-400 font-bold">{(rechargeFactor * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.3"
              max="2.0"
              step="0.05"
              value={rechargeFactor}
              onChange={e => setRechargeFactor(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>Sequía Extrema (30%)</span>
              <span>Régimen Normal (100%)</span>
              <span>Avenida FEN (200%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico de Perfil de la Cuña Salina (Ghyben-Herzberg) */}
      <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-400" />
              Perfil Hidrogeológico de la Cuña Salina (Ley de Ghyben-Herzberg: z = -40 · h_f)
            </h3>
            <p className="text-xs text-slate-400">
              Corte transversal desde el litoral costero hacia el interior del Valle de Santa Catalina (0 a 10 km).
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1 text-teal-400">
              <span className="w-3 h-0.5 bg-teal-400 inline-block"></span> Nivel Freático Dulce (msnm)
            </span>
            <span className="flex items-center gap-1 text-blue-500">
              <span className="w-3 h-0.5 bg-blue-500 inline-block"></span> Interfase Salina (m bnm)
            </span>
          </div>
        </div>

        <div className="h-72 w-full bg-slate-950 p-4 rounded-xl border border-slate-800">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={saltWedgeData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="distanceKm"
                stroke="#64748b"
                tick={{ fontSize: 11 }}
                unit=" km"
                label={{ value: 'Distancia tierra adentro desde la Costa (km)', position: 'insideBottom', offset: -12, fill: '#64748b', fontSize: 11 }}
              />
              <YAxis
                yAxisId="head"
                stroke="#2dd4bf"
                tick={{ fontSize: 11 }}
                unit=" m"
                domain={[0, 20]}
              />
              <YAxis
                yAxisId="depth"
                orientation="right"
                stroke="#3b82f6"
                tick={{ fontSize: 11 }}
                unit=" m"
                domain={[-120, 0]}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                formatter={(value: any, name: string) => [
                  name === 'Interfase Salina Marina' ? `${value} m bnm` : `${value} msnm`,
                  name,
                ]}
              />
              <ReferenceLine yAxisId="depth" y={0} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'Nivel del Mar (0.0 m)', fill: '#94a3b8', fontSize: 10 }} />
              <Line yAxisId="head" type="monotone" dataKey="waterTableHeadM" stroke="#2dd4bf" strokeWidth={2.5} dot={{ r: 4, fill: '#2dd4bf' }} name="Carga Hidráulica Dulce" />
              <Area yAxisId="depth" type="monotone" dataKey="saltInterfaceDepthM" fill="#1e3a8a40" stroke="#3b82f6" strokeWidth={2} name="Interfase Salina Marina" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Balance Hidrogeológico del Acuífero */}
      <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800">
        <h3 className="text-sm font-bold text-slate-100 mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          Balance Hidrológico Subterráneo Anual (Hm³/año)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
            <div className="text-emerald-400 font-bold uppercase text-[11px] mb-2 flex items-center justify-between">
              <span>Entradas y Recarga (+):</span>
              <span>+{totalInflow} Hm³/año</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>• Recarga Natural por Lluvias en Sierra:</span>
              <span className="font-bold">+{naturalRecharge} Hm³</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>• Infiltración del Lecho del Río Moche:</span>
              <span className="font-bold">+{riverBedInfiltration} Hm³</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>• Retorno de Riego Agrícola:</span>
              <span className="font-bold">+{irrigationReturn} Hm³</span>
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
            <div className="text-red-400 font-bold uppercase text-[11px] mb-2 flex items-center justify-between">
              <span>Salidas y Extracción Bombeo (-):</span>
              <span>-{totalOutflow} Hm³/año</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>• Extracción Riego Agrícola (Caña/Espárragos):</span>
              <span className="font-bold text-amber-400">-{agriculturalPumping} Hm³</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>• Extracción Industrial y Minera:</span>
              <span className="font-bold text-amber-400">-{industrialPumping} Hm³</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>• Bombeo Agua Poblacional (Sedalib):</span>
              <span className="font-bold text-sky-400">-{domesticPumping} Hm³</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
