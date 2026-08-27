/**
 * HydraulicInfrastructureSCADAPanel.tsx - Fase de Telecontrol SCADA,
 * Operación de Compuertas de Bocatomas y Simulación de Rotura de Presa de Relaves (Dam-Break Shorey).
 */

import React, { useState } from 'react';
import { HydraulicStructureSCADA, DamBreakSimulationPoint, UserProfile } from '../types';
import { INITIAL_SCADA_STRUCTURES, calculateDamBreakWave } from '../data/scadaData';
import {
  Sliders,
  Radio,
  SlidersHorizontal,
  AlertOctagon,
  ShieldAlert,
  Flame,
  Waves,
  Droplets,
  Activity,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Gauge,
  Cpu,
  Power,
  ChevronRight,
  ShieldCheck,
  Building,
  Info,
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
import { useI18n } from '../providers/I18nProvider';

interface HydraulicInfrastructureSCADAPanelProps {
  currentUser?: UserProfile;
}

export const HydraulicInfrastructureSCADAPanel: React.FC<HydraulicInfrastructureSCADAPanelProps> = ({ currentUser }) => {
  const { t } = useI18n();

  const [structures, setStructures] = useState<HydraulicStructureSCADA[]>(INITIAL_SCADA_STRUCTURES);
  const [selectedStructureId, setSelectedStructureId] = useState<string>('scada-bocatoma-menocucho');

  // Parámetros del Simulador Dam-Break (Rotura de Presa de Relaves Shorey)
  const [breachWidthM, setBreachWidthM] = useState<number>(35);
  const [breachDepthM, setBreachDepthM] = useState<number>(12);
  const [waterStorageHm3, setWaterStorageHm3] = useState<number>(4.8);
  const [isSimulatingDamBreak, setIsSimulatingDamBreak] = useState<boolean>(false);

  const selectedStructure = structures.find(s => s.id === selectedStructureId) || structures[0];

  // Cálculo dinámico de la onda de rotura
  const damBreakPoints: DamBreakSimulationPoint[] = calculateDamBreakWave(breachWidthM, breachDepthM, waterStorageHm3);

  // Manejador de cambio de apertura de compuertas
  const handleGateOpeningChange = (structureId: string, gateId: string, newOpening: number) => {
    setStructures(prev =>
      prev.map(st => {
        if (st.id === structureId) {
          const updatedGates = st.gates.map(g => {
            if (g.gateId === gateId) {
              const maxFlow = g.gateType === 'radial' ? 16.0 : 6.0;
              const calculatedFlow = Number(((newOpening / 100) * maxFlow).toFixed(2));
              return { ...g, openingPercent: newOpening, flowPassingM3s: calculatedFlow };
            }
            return g;
          });
          const totalOutflow = Number(updatedGates.reduce((acc, g) => acc + g.flowPassingM3s, 0).toFixed(2));
          return { ...st, gates: updatedGates, outflowM3s: totalOutflow };
        }
        return st;
      })
    );
  };

  const damBreakChartData = damBreakPoints.map(p => ({
    km: p.distanceFromDamKm,
    zona: p.impactZone.split('/')[0].trim(),
    tiempoMin: p.arrivalTimeMinutes,
    caudalPico: p.peakFlowM3s,
    tiranteLodo: p.floodWaveDepthM,
    velocidad: p.flowVelocityMs,
    plomoPb: p.heavyMetalsConcentrationMgL,
  }));

  const maxPeakFlow = Math.max(...damBreakPoints.map(p => p.peakFlowM3s));

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Encabezado del Módulo SCADA & Dam-Break */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Cpu className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-100">
              {t('scada.title')}
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {t('scada.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <div className="px-3 py-1.5 bg-slate-900 rounded-lg text-center">
            <div className="text-[10px] text-slate-400 uppercase font-bold">{t('scada.stat.structures')}</div>
            <div className="text-sm font-extrabold text-sky-400 font-mono">{structures.length} {t('scada.stat.nodes')}</div>
          </div>
          <div className="px-3 py-1.5 bg-slate-900 rounded-lg text-center">
            <div className="text-[10px] text-slate-400 uppercase font-bold">{t('scada.stat.plcLink')}</div>
            <div className="text-sm font-extrabold text-emerald-400 font-mono flex items-center gap-1 justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              98.7%
            </div>
          </div>
        </div>
      </div>

      {/* Selector de Estructuras SCADA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {structures.map(st => {
          const isSelected = st.id === selectedStructureId;
          const isEmergency = st.status === 'emergencia';
          const isAlert = st.status === 'alerta';

          return (
            <button
              key={st.id}
              onClick={() => setSelectedStructureId(st.id)}
              className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                isSelected
                  ? 'bg-sky-950/40 border-sky-500 shadow-md'
                  : 'bg-slate-900/80 border-slate-800 hover:bg-slate-850'
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>Km {st.locationKm}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded font-bold uppercase text-[9px] ${
                      isEmergency
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : isAlert
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {st.status}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-100 mt-1">{st.name}</div>
                <div className="text-[10px] text-slate-400">{st.subbasin}</div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">{t('scada.card.waterLevel')}: <strong className="text-slate-200">{st.waterLevelM} m</strong></span>
                <span className="text-slate-400">{t('scada.card.outflow')}: <strong className="text-sky-400">{st.outflowM3s} m³/s</strong></span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tablero de Maniobra y Control de Compuertas de la Estructura Seleccionada */}
      <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Gauge className="w-4 h-4 text-sky-400" />
              {t('scada.control.title')}: {selectedStructure.name}
            </h3>
            <p className="text-xs text-slate-400">
              {t('scada.control.subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400">{t('scada.control.sediment')}:</span>
            <div className="flex items-center gap-1.5">
              <div className="w-20 bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    selectedStructure.sedimentDepositionPercent > 70
                      ? 'bg-red-500'
                      : selectedStructure.sedimentDepositionPercent > 40
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${selectedStructure.sedimentDepositionPercent}%` }}
                />
              </div>
              <span className="font-bold text-slate-200">{selectedStructure.sedimentDepositionPercent}%</span>
            </div>
          </div>
        </div>

        {/* Sliders de Accionamiento de Compuertas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {selectedStructure.gates.map(gate => (
            <div
              key={gate.gateId}
              className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-400 font-mono">{gate.gateId}</div>
                  <div className="text-xs font-bold text-slate-200">{gate.gateName}</div>
                </div>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300 border border-slate-700">
                  {t('scada.gate.type')} {gate.gateType.toUpperCase()}
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">{t('scada.gate.opening')}:</span>
                  <span className="text-sky-400 font-bold">{gate.openingPercent}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={gate.openingPercent}
                  disabled={!gate.remoteControlEnabled}
                  onChange={e =>
                    handleGateOpeningChange(selectedStructure.id, gate.gateId, parseInt(e.target.value))
                  }
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500 disabled:opacity-40"
                />
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">{t('scada.gate.dischargeReleased')}:</span>
                <span className="text-emerald-400 font-bold">{gate.flowPassingM3s} m³/s</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MÓDULO DE SIMULACIÓN DE ROTURA DE PRESA DE RELAVES (DAM-BREAK) */}
      <div className="bg-slate-900/90 p-5 rounded-2xl border border-red-900/40 shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                <AlertOctagon className="w-5 h-5" />
              </span>
              <h3 className="text-base font-bold text-slate-100">
                {t('scada.dambreak.title')}
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {t('scada.dambreak.subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSimulatingDamBreak(!isSimulatingDamBreak)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 ${
                isSimulatingDamBreak
                  ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              <Play className="w-4 h-4" />
              {isSimulatingDamBreak ? t('scada.dambreak.running') : t('scada.dambreak.run')}
            </button>
          </div>
        </div>

        {/* Controles de Parámetros de Brecha Geotécnica */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs font-semibold text-slate-300">
              <span>{t('scada.breach.width')}:</span>
              <span className="font-mono text-red-400 font-bold">{breachWidthM} m</span>
            </div>
            <input
              type="range"
              min="10"
              max="80"
              step="5"
              value={breachWidthM}
              onChange={e => setBreachWidthM(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
            />
            <div className="text-[10px] text-slate-500">{t('scada.breach.widthHint')}</div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs font-semibold text-slate-300">
              <span>{t('scada.breach.depth')}:</span>
              <span className="font-mono text-amber-400 font-bold">{breachDepthM} m</span>
            </div>
            <input
              type="range"
              min="5"
              max="20"
              step="1"
              value={breachDepthM}
              onChange={e => setBreachDepthM(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <div className="text-[10px] text-slate-500">{t('scada.breach.depthHint')}: 16.0 m</div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs font-semibold text-slate-300">
              <span>{t('scada.breach.volume')}:</span>
              <span className="font-mono text-sky-400 font-bold">{waterStorageHm3} Hm³</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="12.0"
              step="0.5"
              value={waterStorageHm3}
              onChange={e => setWaterStorageHm3(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
            />
            <div className="text-[10px] text-slate-500">{t('scada.breach.volumeHint')}: 6.2 Hm³</div>
          </div>
        </div>

        {/* Gráfico de Propagación de la Onda de Lodo & Tiempos de Llegada */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <Waves className="w-4 h-4 text-red-400" />
                {t('scada.chart.title')}
              </h4>
              <p className="text-[10px] text-slate-400">
                {t('scada.chart.maxOutflow')}: <strong className="text-red-400 font-mono">{maxPeakFlow.toFixed(1)} m³/s</strong>
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-red-400">
                <span className="w-3 h-0.5 bg-red-400 inline-block"></span> {t('scada.chart.legend.peakFlow')}
              </span>
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="w-3 h-0.5 bg-amber-400 inline-block"></span> {t('scada.chart.legend.mudDepth')}
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={damBreakChartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="km"
                  stroke="#64748b"
                  tick={{ fontSize: 11 }}
                  unit=" km"
                  label={{ value: t('scada.chart.xLabel'), position: 'insideBottom', offset: -12, fill: '#64748b', fontSize: 11 }}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#ef4444"
                  tick={{ fontSize: 11 }}
                  unit=" m³/s"
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#f59e0b"
                  tick={{ fontSize: 11 }}
                  unit=" m"
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                  formatter={(value: any, name: string) => [
                    name === t('scada.series.mudDepth') ? `${value} m` : `${value} m³/s`,
                    name,
                  ]}
                />
                <Area yAxisId="left" type="monotone" dataKey="caudalPico" fill="#ef444420" stroke="#ef4444" strokeWidth={2.5} name={t('scada.series.peakFlow')} />
                <Line yAxisId="right" type="monotone" dataKey="tiranteLodo" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4, fill: '#f59e0b' }} name={t('scada.series.mudDepth')} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tabla de Tiempos de Evacuación y Afectación aguas abajo */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono">
              <tr>
                <th className="p-3">{t('scada.table.distance')}</th>
                <th className="p-3">{t('scada.table.affected')}</th>
                <th className="p-3">{t('scada.table.arrival')}</th>
                <th className="p-3">{t('scada.table.peakFlow')}</th>
                <th className="p-3">{t('scada.table.mudDepth')}</th>
                <th className="p-3">{t('scada.table.suspendedLead')}</th>
                <th className="p-3">{t('scada.table.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {damBreakPoints.map(pt => (
                <tr key={pt.distanceFromDamKm} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3 font-bold text-sky-400">+{pt.distanceFromDamKm} km</td>
                  <td className="p-3 font-sans font-bold text-slate-200">{pt.impactZone}</td>
                  <td className="p-3 font-bold text-amber-400">
                    {pt.arrivalTimeMinutes === 0 ? `0 min (${t('scada.table.immediate')})` : `${pt.arrivalTimeMinutes} min (${(pt.arrivalTimeMinutes / 60).toFixed(1)} h)`}
                  </td>
                  <td className="p-3 font-bold text-red-400">{pt.peakFlowM3s.toFixed(1)}</td>
                  <td className="p-3 font-bold text-amber-300">{pt.floodWaveDepthM.toFixed(2)} m</td>
                  <td className="p-3 font-bold text-slate-300">{pt.heavyMetalsConcentrationMgL.toFixed(1)} mg/L</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        pt.status === 'Pico de Inundación'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : pt.status === 'Onda de Detritos'
                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                          : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
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
    </div>
  );
};
