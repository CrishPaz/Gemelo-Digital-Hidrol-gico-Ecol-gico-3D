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
import { useI18n } from '../providers/I18nProvider';

interface HydrogeologySalinityPanelProps {
  currentUser?: UserProfile;
}

/**
 * Los valores de `salinityRisk` e `irrigationSuitability` llegan en español desde
 * `hydrogeologyData`. Aquí sólo se traduce su presentación: la lógica de umbrales
 * sigue comparando contra el valor original del dato.
 */
const SALINITY_RISK_KEYS: Record<string, string> = {
  Normal: 'hgeo.risk.normal',
  Leve: 'hgeo.risk.mild',
  Moderada: 'hgeo.risk.moderate',
  'Severa (Intrusión)': 'hgeo.risk.severe',
};

const IRRIGATION_SUITABILITY_KEYS: Record<string, string> = {
  'Apto Sin Restricción': 'hgeo.suitability.unrestricted',
  'Apto con Drenaje': 'hgeo.suitability.drainage',
  'Restringido (Palto/Espárrago)': 'hgeo.suitability.restricted',
  'No Apto (Salinizado)': 'hgeo.suitability.unsuitable',
};

export const HydrogeologySalinityPanel: React.FC<HydrogeologySalinityPanelProps> = ({ currentUser }) => {
  const { t } = useI18n();
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
              {t('hgeo.title')}
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {t('hgeo.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <div className="px-3 py-1.5 bg-slate-900 rounded-lg text-center">
            <div className="text-[10px] text-slate-400 uppercase font-bold">{t('hgeo.kpi.annualBalance')}</div>
            <div
              className={`text-sm font-extrabold font-mono ${
                isDeficit ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              {netBalance > 0 ? `+${netBalance}` : netBalance} {t('hgeo.unit.hm3PerYear')}
            </div>
          </div>
          <div className="px-3 py-1.5 bg-slate-900 rounded-lg text-center">
            <div className="text-[10px] text-slate-400 uppercase font-bold">{t('hgeo.kpi.aquiferStatus')}</div>
            <div
              className={`text-xs font-extrabold uppercase ${
                isDeficit ? 'text-red-400 animate-pulse' : 'text-emerald-400'
              }`}
            >
              {isDeficit ? t('hgeo.status.overexploited') : t('hgeo.status.equilibrium')}
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
                  <span>{w.code} • {t('hgeo.well.distancePrefix')} {w.distanceToCoastKm} km {t('hgeo.well.distanceSuffix')}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded font-bold text-[9px] uppercase ${
                      isSevere
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : isModerate
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {t(SALINITY_RISK_KEYS[w.salinityRisk] ?? w.salinityRisk)}
                  </span>
                </div>

                <div className="text-xs font-bold text-slate-100 mt-1.5">{w.name}</div>
                <div className="text-[10px] text-slate-400">{w.sector}</div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('hgeo.well.conductivity')}</span>
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
                  <span className="text-slate-400">{t('hgeo.well.waterTable')}</span>
                  <span className="text-slate-200">-{w.waterTableDepthM} m</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-500">{t('hgeo.well.suitability')}</span>
                  <span className="text-slate-300 font-sans font-medium">
                    {t(IRRIGATION_SUITABILITY_KEYS[w.irrigationSuitability] ?? w.irrigationSuitability)}
                  </span>
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
              {t('hgeo.sim.title')}
            </h3>
            <p className="text-xs text-slate-400">
              {t('hgeo.sim.subtitle')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs font-semibold text-slate-300">
              <span>{t('hgeo.sim.pumping.label')}</span>
              <span className="font-mono text-amber-400 font-bold">
                {(pumpingFactor * 100).toFixed(0)}% {t('hgeo.sim.pumping.baseline')}
              </span>
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
              <span>{t('hgeo.sim.pumping.min')}</span>
              <span>{t('hgeo.sim.pumping.mid')}</span>
              <span>{t('hgeo.sim.pumping.max')}</span>
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs font-semibold text-slate-300">
              <span>{t('hgeo.sim.recharge.label')}</span>
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
              <span>{t('hgeo.sim.recharge.min')}</span>
              <span>{t('hgeo.sim.recharge.mid')}</span>
              <span>{t('hgeo.sim.recharge.max')}</span>
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
              {t('hgeo.wedge.title')}
            </h3>
            <p className="text-xs text-slate-400">
              {t('hgeo.wedge.subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1 text-teal-400">
              <span className="w-3 h-0.5 bg-teal-400 inline-block"></span> {t('hgeo.wedge.legend.fresh')}
            </span>
            <span className="flex items-center gap-1 text-blue-500">
              <span className="w-3 h-0.5 bg-blue-500 inline-block"></span> {t('hgeo.wedge.legend.salt')}
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
                label={{ value: t('hgeo.wedge.axis.distance'), position: 'insideBottom', offset: -12, fill: '#64748b', fontSize: 11 }}
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
                  name === t('hgeo.wedge.series.interface')
                    ? `${value} ${t('hgeo.wedge.unit.mbsl')}`
                    : `${value} ${t('hgeo.wedge.unit.masl')}`,
                  name,
                ]}
              />
              <ReferenceLine yAxisId="depth" y={0} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: t('hgeo.wedge.seaLevel'), fill: '#94a3b8', fontSize: 10 }} />
              <Line yAxisId="head" type="monotone" dataKey="waterTableHeadM" stroke="#2dd4bf" strokeWidth={2.5} dot={{ r: 4, fill: '#2dd4bf' }} name={t('hgeo.wedge.series.head')} />
              <Area yAxisId="depth" type="monotone" dataKey="saltInterfaceDepthM" fill="#1e3a8a40" stroke="#3b82f6" strokeWidth={2} name={t('hgeo.wedge.series.interface')} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Balance Hidrogeológico del Acuífero */}
      <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800">
        <h3 className="text-sm font-bold text-slate-100 mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          {t('hgeo.balance.title')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
            <div className="text-emerald-400 font-bold uppercase text-[11px] mb-2 flex items-center justify-between">
              <span>{t('hgeo.balance.inflows')}</span>
              <span>+{totalInflow} {t('hgeo.unit.hm3PerYear')}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>• {t('hgeo.balance.naturalRecharge')}</span>
              <span className="font-bold">+{naturalRecharge} Hm³</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>• {t('hgeo.balance.riverInfiltration')}</span>
              <span className="font-bold">+{riverBedInfiltration} Hm³</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>• {t('hgeo.balance.irrigationReturn')}</span>
              <span className="font-bold">+{irrigationReturn} Hm³</span>
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
            <div className="text-red-400 font-bold uppercase text-[11px] mb-2 flex items-center justify-between">
              <span>{t('hgeo.balance.outflows')}</span>
              <span>-{totalOutflow} {t('hgeo.unit.hm3PerYear')}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>• {t('hgeo.balance.agriPumping')}</span>
              <span className="font-bold text-amber-400">-{agriculturalPumping} Hm³</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>• {t('hgeo.balance.industrialPumping')}</span>
              <span className="font-bold text-amber-400">-{industrialPumping} Hm³</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>• {t('hgeo.balance.domesticPumping')}</span>
              <span className="font-bold text-sky-400">-{domesticPumping} Hm³</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
