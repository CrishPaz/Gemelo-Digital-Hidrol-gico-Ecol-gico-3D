/**
 * HeavyMetalsTransportPanel.tsx - Fase de Transporte y Dispersión de Metales Pesados,
 * Drenaje Ácido de Mina (DAM) y Capacidad de Asimilación (TMDL) en el Río Moche.
 */

import React, { useState } from 'react';
import { ContaminantDispersionPoint } from '../types';
import { simulateHeavyMetalsTransport } from '../services/hydrodynamicsEngine';
import {
  Skull,
  FlaskConical,
  ShieldCheck,
  AlertTriangle,
  Activity,
  Sliders,
  ChevronRight,
  TrendingDown,
  Info,
  CheckCircle2,
  Atom,
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

export const HeavyMetalsTransportPanel: React.FC = () => {
  const [remediationEfficiency, setRemediationEfficiency] = useState<number>(0);
  const [dilutionMultiplier, setDilutionMultiplier] = useState<number>(1.0);
  const [selectedPointKm, setSelectedPointKm] = useState<number>(0);

  const points: ContaminantDispersionPoint[] = simulateHeavyMetalsTransport(
    remediationEfficiency,
    dilutionMultiplier
  );

  const selectedPoint = points.find(p => p.km === selectedPointKm) || points[0];

  const chartData = points.map(p => ({
    km: p.km,
    nombre: p.locationName.split('/')[0].trim(),
    plomo: p.leadPb_mgL,
    arsenico: p.arsenicAs_mgL,
    cadmio: p.cadmiumCd_mgL,
    hierro: p.ironFe_mgL,
    ph: p.ph,
    wqi: p.wqi,
    carga: p.currentPollutantLoadKgDay,
    tmdl: p.tmdlCapacityKgDay,
  }));

  const criticalPointsCount = points.filter(p => p.status === 'Superación Crítica ECA').length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Encabezado del Módulo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
              <FlaskConical className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-100">
              Transporte de Metales Pesados & Drenaje Ácido (DAM)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Modelo advectivo-dispersivo 1D de Plomo ($Pb$), Arsénico ($As$), Cadmio ($Cd$) y pH desde los pasivos de Quiruvilca frente a los ECA-Agua D.S. N° 004-2017-MINAM.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <div className="px-3 py-1.5 bg-slate-900 rounded-lg text-center">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Puntos Críticos ECA</div>
            <div className={`text-sm font-extrabold font-mono ${criticalPointsCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {criticalPointsCount} / {points.length}
            </div>
          </div>
          <div className="px-3 py-1.5 bg-slate-900 rounded-lg text-center">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Eficiencia Tratamiento</div>
            <div className="text-sm font-extrabold text-sky-400 font-mono">{remediationEfficiency}%</div>
          </div>
        </div>
      </div>

      {/* Controles del Simulador de Remediación Química */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Slider de Neutralización / Tratamiento de Pasivos Mineros */}
        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
            <span className="flex items-center gap-1.5">
              <Atom className="w-4 h-4 text-sky-400" />
              Neutralización Química en Cabecera (Lechada de Cal Ca(OH)₂):
            </span>
            <span className="font-mono text-sky-400 font-bold">{remediationEfficiency}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={remediationEfficiency}
            onChange={e => setRemediationEfficiency(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-2">
            <span>Sin Tratamiento (Línea Base DAM)</span>
            <span>Remediación Avanzada (100%)</span>
          </div>
        </div>

        {/* Slider de Dilución por Caudal Fluvial */}
        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
            <span className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-400" />
              Efecto de Dilución Hidrológica (Avenida / Afluentes):
            </span>
            <span className="font-mono text-emerald-400 font-bold">{dilutionMultiplier.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="3.0"
            step="0.1"
            value={dilutionMultiplier}
            onChange={e => setDilutionMultiplier(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-2">
            <span>Estiaje Severo (0.5x)</span>
            <span>Caudal Medio (1.0x)</span>
            <span>Dilución Húmeda (3.0x)</span>
          </div>
        </div>
      </div>

      {/* Gráfico Longitudinal de Concentración de Plomo & Arsénico vs ECA */}
      <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-red-400" />
              Perfil Longitudinal de Metales Pesados (mg/L vs Progresiva Fluvial)
            </h3>
            <p className="text-[11px] text-slate-400">
              Límites normativos D.S. N° 004-2017-MINAM: ECA Cat. 3 Riego ($Pb \le 0.05$ mg/L) y ECA Cat. 4 Ecosistemas ($Pb \le 0.0025$ mg/L).
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-red-400">
              <span className="w-3 h-0.5 bg-red-400 inline-block"></span> Plomo ($Pb$)
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-3 h-0.5 bg-amber-400 inline-block"></span> Arsénico ($As$)
            </span>
            <span className="flex items-center gap-1.5 text-sky-400">
              <span className="w-3 h-0.5 bg-sky-400 inline-block"></span> pH Fluvial
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="km"
                stroke="#64748b"
                tick={{ fontSize: 11 }}
                unit=" km"
                label={{ value: 'Progresiva Fluvial (km)', position: 'insideBottom', offset: -12, fill: '#64748b', fontSize: 11 }}
              />
              <YAxis
                yAxisId="left"
                stroke="#ef4444"
                tick={{ fontSize: 11 }}
                domain={[0, 0.25]}
                unit=" mg/L"
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#38bdf8"
                tick={{ fontSize: 11 }}
                domain={[2, 9]}
                unit=" pH"
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                formatter={(value: any, name: string) => [
                  name === 'pH Fluvial' ? `${value} unidades` : `${value} mg/L`,
                  name,
                ]}
              />
              <ReferenceLine yAxisId="left" y={0.05} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'ECA Cat. 3 (0.05)', fill: '#f59e0b', fontSize: 10 }} />
              <Line yAxisId="left" type="monotone" dataKey="plomo" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4, fill: '#ef4444' }} name="Plomo (Pb)" />
              <Line yAxisId="left" type="monotone" dataKey="arsenico" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} name="Arsénico (As)" />
              <Line yAxisId="right" type="monotone" dataKey="ph" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3, fill: '#38bdf8' }} name="pH Fluvial" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detalle por Punto de Control y Capacidad de Asimilación TMDL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tabla Detallada de Concentraciones de Metales */}
        <div className="lg:col-span-2 bg-slate-900/90 p-5 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-blue-400" />
              Monitoreo Hidrogeoquímico por Tramo
            </h3>
            <span className="text-xs text-slate-400 font-mono">Km {selectedPoint.km}</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono">
                <tr>
                  <th className="p-2.5">Progresiva</th>
                  <th className="p-2.5">Estación / Tramo</th>
                  <th className="p-2.5">Pb ($mg/L$)</th>
                  <th className="p-2.5">As ($mg/L$)</th>
                  <th className="p-2.5">pH</th>
                  <th className="p-2.5">WQI</th>
                  <th className="p-2.5">Estado ECA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {points.map(pt => (
                  <tr
                    key={pt.km}
                    onClick={() => setSelectedPointKm(pt.km)}
                    className={`cursor-pointer hover:bg-slate-800/50 transition-colors ${
                      selectedPointKm === pt.km ? 'bg-blue-950/40 font-semibold text-white' : 'text-slate-300'
                    }`}
                  >
                    <td className="p-2.5 font-bold text-sky-400">Km {pt.km}</td>
                    <td className="p-2.5 font-sans truncate max-w-[140px]">{pt.locationName}</td>
                    <td className={`p-2.5 font-bold ${pt.leadPb_mgL > 0.05 ? 'text-red-400' : 'text-slate-300'}`}>
                      {pt.leadPb_mgL.toFixed(3)}
                    </td>
                    <td className={`p-2.5 font-bold ${pt.arsenicAs_mgL > 0.1 ? 'text-amber-400' : 'text-slate-300'}`}>
                      {pt.arsenicAs_mgL.toFixed(3)}
                    </td>
                    <td className={`p-2.5 ${pt.ph < 6.5 ? 'text-orange-400 font-bold' : 'text-slate-300'}`}>
                      {pt.ph.toFixed(1)}
                    </td>
                    <td className="p-2.5 font-bold text-sky-400">{pt.wqi.toFixed(1)}</td>
                    <td className="p-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          pt.status === 'Superación Crítica ECA'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : pt.status === 'Alerta Leve'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {pt.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Diagnóstico del Punto Seleccionado & Capacidad de Carga TMDL */}
        <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="p-1 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <Info className="w-4 h-4" />
              </span>
              <h3 className="text-sm font-bold text-slate-100">
                Diagnóstico Tramo Km {selectedPoint.km}
              </h3>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-medium">{selectedPoint.locationName}</div>
                <div className="text-base font-bold text-slate-200 mt-0.5">{selectedPoint.subbasin}</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-medium">Plomo ($Pb$)</div>
                  <div className={`text-base font-extrabold font-mono mt-0.5 ${selectedPoint.leadPb_mgL > 0.05 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {selectedPoint.leadPb_mgL.toFixed(3)} mg/L
                  </div>
                  <div className="text-[10px] text-slate-500">Límite ECA: 0.05</div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-medium">pH del Agua</div>
                  <div className={`text-base font-extrabold font-mono mt-0.5 ${selectedPoint.ph < 6.5 ? 'text-red-400' : 'text-sky-400'}`}>
                    {selectedPoint.ph.toFixed(1)}
                  </div>
                  <div className="text-[10px] text-slate-500">Rango ECA: 6.5 - 8.5</div>
                </div>
              </div>

              {/* Capacidad TMDL */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-medium">Carga Diaria vs Capacidad TMDL:</div>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-base font-extrabold font-mono text-slate-100">
                    {selectedPoint.currentPollutantLoadKgDay.toFixed(1)} kg/día
                  </span>
                  <span className="text-xs text-slate-400">
                    Cap. Asimilación: {selectedPoint.tmdlCapacityKgDay.toFixed(1)} kg/día
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      selectedPoint.currentPollutantLoadKgDay > selectedPoint.tmdlCapacityKgDay ? 'bg-red-500' : 'bg-emerald-500'
                    }`}
                    style={{
                      width: `${Math.min(100, (selectedPoint.currentPollutantLoadKgDay / selectedPoint.tmdlCapacityKgDay) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80">
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <span>Planta de neutralización Shorey reduce en un 88% la carga de relaves.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
