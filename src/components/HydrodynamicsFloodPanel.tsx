/**
 * HydrodynamicsFloodPanel.tsx - Fase de Hidráulica Fluvial 1D, Tránsito de Avenidas
 * y Modelado de Riesgo de Inundación en el Río Moche.
 */

import React, { useState } from 'react';
import { RiverCrossSection, FloodReturnPeriodSimulation } from '../types';
import { MOCHE_RIVER_CROSS_SECTIONS, MOCHE_FLOOD_SCENARIOS } from '../data/mocheHydroData';
import { computeHydraulicProfile } from '../services/hydrodynamicsEngine';
import {
  Waves,
  AlertTriangle,
  Layers,
  Gauge,
  Compass,
  ArrowRight,
  TrendingDown,
  ShieldAlert,
  Info,
  ChevronRight,
  Droplet,
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
} from 'recharts';

export const HydrodynamicsFloodPanel: React.FC = () => {
  const [inflowQ, setInflowQ] = useState<number>(6.5);
  const [manningMultiplier, setManningMultiplier] = useState<number>(1.0);
  const [selectedScenarioTr, setSelectedScenarioTr] = useState<number>(25);
  const [selectedSectionKm, setSelectedSectionKm] = useState<number>(84);

  const sections: RiverCrossSection[] = computeHydraulicProfile(inflowQ, manningMultiplier);
  const selectedSection = sections.find(s => s.km === selectedSectionKm) || sections[0];
  const activeScenario: FloodReturnPeriodSimulation =
    MOCHE_FLOOD_SCENARIOS.find(s => s.returnPeriodYears === selectedScenarioTr) || MOCHE_FLOOD_SCENARIOS[1];

  // Datos para el gráfico de perfil longitudinal (cota de fondo, corona de ribera y lámina de agua)
  const chartData = sections.map(s => ({
    km: s.km,
    nombre: s.name.split('/')[0].trim(),
    fondo: s.bedElevationM,
    agua: s.waterLevelM,
    ribera: s.bankElevationM,
    tirante: s.waterDepthM,
    velocidad: s.flowVelocityMs,
    froude: s.froudeNumber,
    desbordado: s.isOverbankFlooded,
    bordoLibre: s.freeboardM,
  }));

  const floodedSectionsCount = sections.filter(s => s.isOverbankFlooded).length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Encabezado del Módulo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Waves className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-100">
              Hidráulica Fluvial 1D & Tránsito de Inundaciones
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Perfil longitudinal gradualmente variado (Saint-Venant / Manning), número de Froude y zonificación de riesgo de desborde (Km 0 a 102).
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <div className="px-3 py-1.5 bg-slate-900 rounded-lg text-center">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Caudal Cabecera</div>
            <div className="text-sm font-extrabold text-sky-400 font-mono">{inflowQ.toFixed(1)} m³/s</div>
          </div>
          <div className="px-3 py-1.5 bg-slate-900 rounded-lg text-center">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Tramos Desbordados</div>
            <div className={`text-sm font-extrabold font-mono ${floodedSectionsCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {floodedSectionsCount} / {sections.length}
            </div>
          </div>
        </div>
      </div>

      {/* Controles de Simulación Hidráulica */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Control de Caudal en Cabecera */}
        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
            <span className="flex items-center gap-1.5">
              <Droplet className="w-4 h-4 text-sky-400" />
              Caudal de Entrada (Q_in):
            </span>
            <span className="font-mono text-sky-400 font-bold">{inflowQ.toFixed(1)} m³/s</span>
          </div>
          <input
            type="range"
            min="0.8"
            max="180.0"
            step="0.5"
            value={inflowQ}
            onChange={e => setInflowQ(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-2">
            <span>Estiaje (0.8 m³/s)</span>
            <span>Medio (6.5 m³/s)</span>
            <span>Avenida (180 m³/s)</span>
          </div>
        </div>

        {/* Control de Rugosidad de Manning (Vegetación / Azolvamiento) */}
        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
            <span className="flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-amber-400" />
              Factor Rugosidad ($n$ Manning):
            </span>
            <span className="font-mono text-amber-400 font-bold">{(manningMultiplier * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0.7"
            max="1.8"
            step="0.05"
            value={manningMultiplier}
            onChange={e => setManningMultiplier(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-2">
            <span>Cauce Limpio (70%)</span>
            <span>Base (100%)</span>
            <span>Azolvado/Malezas (180%)</span>
          </div>
        </div>

        {/* Selector de Periodo de Retorno de Inundación (Tr) */}
        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            Escenario de Inundación ($Tr$):
          </div>
          <div className="grid grid-cols-5 gap-1">
            {[10, 25, 50, 100, 500].map(tr => (
              <button
                key={tr}
                onClick={() => {
                  setSelectedScenarioTr(tr);
                  const sc = MOCHE_FLOOD_SCENARIOS.find(s => s.returnPeriodYears === tr);
                  if (sc) setInflowQ(sc.peakDischargeM3s * 0.4); // Calibración de caudal
                }}
                className={`py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${
                  selectedScenarioTr === tr
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                {tr}a
              </button>
            ))}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 truncate">
            {selectedScenarioTr === 500 ? 'FEN 1997-98 / 2017 Extremo' : `Avenida ordinaria Tr = ${selectedScenarioTr} años`}
          </div>
        </div>
      </div>

      {/* Gráfico del Perfil Longitudinal Hidráulico */}
      <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Compass className="w-4 h-4 text-sky-400" />
              Perfil Longitudinal del Río Moche (Cotas s.n.m. vs Kilometraje)
            </h3>
            <p className="text-[11px] text-slate-400">
              Desnivel total de 3,980 m a lo largo de 102 km desde Quiruvilca hasta el Océano Pacífico.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-sky-400">
              <span className="w-3 h-0.5 bg-sky-400 inline-block"></span> Lámina de Agua
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-3 h-0.5 bg-amber-400 inline-block"></span> Corona de Ribera
            </span>
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="w-3 h-0.5 bg-slate-500 inline-block"></span> Fondo de Cauce
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="km"
                stroke="#64748b"
                tick={{ fontSize: 11 }}
                unit=" km"
                label={{ value: 'Progresiva Fluvial (km)', position: 'insideBottom', offset: -12, fill: '#64748b', fontSize: 11 }}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fontSize: 11 }}
                domain={[0, 4200]}
                unit=" m"
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                formatter={(value: any, name: string) => [`${value} m s.n.m.`, name]}
              />
              <Area type="monotone" dataKey="fondo" fill="#1e293b" stroke="#475569" name="Fondo de Cauce" fillOpacity={0.4} />
              <Line type="monotone" dataKey="ribera" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 3 }} name="Corona de Ribera" />
              <Line type="monotone" dataKey="agua" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 4, fill: '#38bdf8' }} name="Lámina de Agua" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detalle Hidráulico por Sección Transversal & Evaluación de Escenario Tr */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Selector de Sección y Parámetros Hidráulicos */}
        <div className="lg:col-span-2 bg-slate-900/90 p-5 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              Sección Transversal de Control
            </h3>
            <span className="text-xs text-slate-400 font-mono">Km {selectedSection.km}</span>
          </div>

          {/* Selector de Puntos de Control */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
            {sections.map(s => (
              <button
                key={s.km}
                onClick={() => setSelectedSectionKm(s.km)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  selectedSectionKm === s.km
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Km {s.km}</span>
                <span className="text-[10px] opacity-75 truncate max-w-[100px]">{s.name.split('/')[0]}</span>
              </button>
            ))}
          </div>

          {/* Matriz de Parámetros Hidráulicos de la Sección */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/80 p-4 rounded-xl border border-slate-800/80">
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-medium">Tirante Hidráulico ($y$)</div>
              <div className="text-base font-extrabold text-sky-400 font-mono mt-0.5">{selectedSection.waterDepthM} m</div>
              <div className="text-[10px] text-slate-500">Cota {selectedSection.waterLevelM} m</div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-medium">Velocidad Media ($v$)</div>
              <div className="text-base font-extrabold text-emerald-400 font-mono mt-0.5">{selectedSection.flowVelocityMs} m/s</div>
              <div className="text-[10px] text-slate-500">Espejo {selectedSection.topWidthM} m</div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-medium">Número de Froude ($Fr$)</div>
              <div className="text-base font-extrabold text-amber-400 font-mono mt-0.5">{selectedSection.froudeNumber}</div>
              <div className="text-[10px] text-slate-500">
                {selectedSection.froudeNumber < 1 ? 'Flujo Subcrítico' : 'Flujo Supercrítico'}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-medium">Bordo Libre ($FB$)</div>
              <div className={`text-base font-extrabold font-mono mt-0.5 ${selectedSection.freeboardM <= 0 ? 'text-red-400' : 'text-slate-200'}`}>
                {selectedSection.freeboardM} m
              </div>
              <div className={`text-[10px] font-bold ${selectedSection.isOverbankFlooded ? 'text-red-400' : 'text-emerald-400'}`}>
                {selectedSection.isOverbankFlooded ? '¡Desbordamiento!' : 'Margen Seguro'}
              </div>
            </div>
          </div>

          {/* Tabla Comparativa de Todas las Secciones */}
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono">
                <tr>
                  <th className="p-2.5">Progresiva</th>
                  <th className="p-2.5">Sector / Localidad</th>
                  <th className="p-2.5">Caudal ($m^3/s$)</th>
                  <th className="p-2.5">Tirante ($m$)</th>
                  <th className="p-2.5">Velocidad ($m/s$)</th>
                  <th className="p-2.5">Bordo Libre</th>
                  <th className="p-2.5">Riesgo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {sections.map(s => (
                  <tr
                    key={s.km}
                    onClick={() => setSelectedSectionKm(s.km)}
                    className={`cursor-pointer hover:bg-slate-800/50 transition-colors ${
                      selectedSectionKm === s.km ? 'bg-blue-950/40 font-semibold text-white' : 'text-slate-300'
                    }`}
                  >
                    <td className="p-2.5 font-bold text-sky-400">Km {s.km}</td>
                    <td className="p-2.5 font-sans truncate max-w-[140px]">{s.name}</td>
                    <td className="p-2.5">{s.dischargeM3s.toFixed(2)}</td>
                    <td className="p-2.5">{s.waterDepthM.toFixed(2)}</td>
                    <td className="p-2.5">{s.flowVelocityMs.toFixed(2)}</td>
                    <td className={`p-2.5 font-bold ${s.freeboardM <= 0 ? 'text-red-400' : 'text-slate-400'}`}>
                      {s.freeboardM.toFixed(2)} m
                    </td>
                    <td className="p-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          s.floodRiskLevel === 'Extremo'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : s.floodRiskLevel === 'Alto'
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                            : s.floodRiskLevel === 'Moderado'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {s.floodRiskLevel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Panel de Impacto del Escenario de Inundación */}
        <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="p-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                <AlertTriangle className="w-4 h-4" />
              </span>
              <h3 className="text-sm font-bold text-slate-100">
                Impacto Avenida Tr = {activeScenario.returnPeriodYears} años
              </h3>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-medium">Caudal Pico Estimado</div>
                <div className="text-xl font-extrabold text-red-400 font-mono mt-0.5">
                  {activeScenario.peakDischargeM3s} m³/s
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-medium">Área Inundable Total</div>
                  <div className="text-sm font-bold text-slate-200 font-mono mt-0.5">
                    {activeScenario.totalFloodedAreaHa} ha
                  </div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-medium">Población en Riesgo</div>
                  <div className="text-sm font-bold text-orange-400 font-mono mt-0.5">
                    {activeScenario.vulnerableInhabitants.toLocaleString()} hab.
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-medium mb-1.5">Puntos Críticos de Desborde:</div>
                <div className="space-y-1">
                  {activeScenario.criticalPoints.map((pt, i) => (
                    <div key={i} className="text-xs text-slate-300 flex items-center gap-1.5">
                      <ChevronRight className="w-3 h-3 text-red-400 flex-shrink-0" />
                      <span className="truncate">{pt}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Rutas de Evacuación COER:</span>
              <span className={`font-bold ${activeScenario.evacuationRoutesActive ? 'text-red-400' : 'text-slate-500'}`}>
                {activeScenario.evacuationRoutesActive ? 'ACTIVAS' : 'En Espera'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
