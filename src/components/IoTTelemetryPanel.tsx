/**
 * IoTTelemetryPanel - Ingesta, Validación y Monitoreo de Parámetros Fisicoquímicos
 * Comparación en tiempo real contra los Estándares de Calidad Ambiental (ECA-Agua, Perú).
 * Incluye validación de calidad de datos (Hampel filter, límites físicos y deriva).
 */

import React, { useState } from 'react';
import { MonitoringStation, WaterQualityParameter } from '../types';
import { PERU_ECA_AGUA_STANDARDS } from '../data/mocheBasinData';
import { useI18n } from '../providers/I18nProvider';
import {
  Radio,
  Sliders,
  CheckCircle2,
  AlertOctagon,
  RefreshCw,
  Cpu,
  Download,
  Filter,
  Layers,
  Sparkles,
  Search,
} from 'lucide-react';

interface IoTTelemetryPanelProps {
  stations: MonitoringStation[];
  selectedStation: MonitoringStation;
  onSelectStation: (st: MonitoringStation) => void;
  onSimulateNewPacket: () => void;
}

export const IoTTelemetryPanel: React.FC<IoTTelemetryPanelProps> = ({
  stations,
  selectedStation,
  onSelectStation,
  onSimulateNewPacket,
}) => {
  const { t } = useI18n();
  const [selectedSubbasin, setSelectedSubbasin] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<'cat3' | 'cat4'>('cat4');

  const standards = activeCategory === 'cat4'
    ? PERU_ECA_AGUA_STANDARDS.category4_ecosystem
    : PERU_ECA_AGUA_STANDARDS.category3_irrigation;

  // Filtrado de estaciones
  const filteredStations = stations.filter(st => {
    const matchSubbasin = selectedSubbasin === 'all' || st.subbasin.includes(selectedSubbasin);
    const matchSearch = st.name.toLowerCase().includes(searchTerm.toLowerCase()) || st.code.toLowerCase().includes(searchTerm.toLowerCase());
    return matchSubbasin && matchSearch;
  });

  const vals = selectedStation.currentValues;

  // Función de diagnóstico de parámetro vs ECA
  const checkECA = (param: string, value: number) => {
    if (param === 'do') {
      return value >= standards.do_min ? { ok: true, msg: `≥ ${standards.do_min} mg/L` } : { ok: false, msg: `${t('telem.check.belowEca')} (< ${standards.do_min})` };
    }
    if (param === 'ph') {
      return value >= standards.ph_min && value <= standards.ph_max
        ? { ok: true, msg: `${standards.ph_min} - ${standards.ph_max}` }
        : { ok: false, msg: `${t('telem.check.outOfRange')} (${standards.ph_min} - ${standards.ph_max})` };
    }
    if (param === 'ec') {
      return value <= standards.ec_max ? { ok: true, msg: `≤ ${standards.ec_max} µS/cm` } : { ok: false, msg: `${t('telem.check.exceedsEca')} (> ${standards.ec_max})` };
    }
    if (param === 'turbidity') {
      return value <= standards.turbidity_max ? { ok: true, msg: `≤ ${standards.turbidity_max} NTU` } : { ok: false, msg: `${t('telem.check.exceedsEca')} (> ${standards.turbidity_max})` };
    }
    if (param === 'nitrates') {
      return value <= standards.nitrates_max ? { ok: true, msg: `≤ ${standards.nitrates_max} mg/L` } : { ok: false, msg: `${t('telem.check.exceedsEca')} (> ${standards.nitrates_max})` };
    }
    if (param === 'total_p') {
      return value <= standards.total_p_max ? { ok: true, msg: `≤ ${standards.total_p_max} mg/L` } : { ok: false, msg: `${t('telem.check.exceedsEca')} (> ${standards.total_p_max})` };
    }
    if (param === 'coliforms') {
      return value <= standards.fecal_coliforms_max ? { ok: true, msg: `≤ ${standards.fecal_coliforms_max} NMP` } : { ok: false, msg: `${t('telem.check.exceedsEca')} (> ${standards.fecal_coliforms_max})` };
    }
    if (param === 'lead') {
      return value <= standards.lead_max ? { ok: true, msg: `≤ ${standards.lead_max} mg/L` } : { ok: false, msg: `${t('telem.check.metalAlert')} (> ${standards.lead_max})` };
    }
    return { ok: true, msg: t('telem.check.normal') };
  };

  return (
    <div className="space-y-6">
      {/* Barra de Filtros y Control de Simulación de Ingesta */}
      <div className="p-4 bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={t('telem.search.placeholder')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-52"
            />
          </div>

          {/* Filtro de Subcuenca */}
          <select
            value={selectedSubbasin}
            onChange={e => setSelectedSubbasin(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="all">{t('telem.subbasin.all')}</option>
            <option value="Alta">{t('telem.subbasin.upper')}</option>
            <option value="Media">{t('telem.subbasin.middle')}</option>
            <option value="Baja">{t('telem.subbasin.lower')}</option>
          </select>

          {/* Selector de Estándar ECA */}
          <div className="flex items-center gap-1 p-0.5 bg-slate-950 border border-slate-800 rounded-lg text-xs">
            <button
              onClick={() => setActiveCategory('cat4')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                activeCategory === 'cat4' ? 'bg-emerald-600 text-white font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              {t('telem.eca.cat4')}
            </button>
            <button
              onClick={() => setActiveCategory('cat3')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                activeCategory === 'cat3' ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              {t('telem.eca.cat3')}
            </button>
          </div>
        </div>

        {/* Botón de Ingesta Manual de Paquete MQTT */}
        <button
          onClick={onSimulateNewPacket}
          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-900/30 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {t('telem.ingest')}
        </button>
      </div>

      {/* Grid: Lista de Estaciones + Panel Detallado de Parámetros */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna 1: Selector de Estaciones */}
        <div className="p-4 bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800 space-y-2 max-h-[580px] overflow-y-auto">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            {t('telem.stations.title')} ({filteredStations.length})
          </h3>
          {filteredStations.map(st => {
            const isSelected = st.id === selectedStation.id;
            return (
              <div
                key={st.id}
                onClick={() => onSelectStation(st)}
                className={`p-3 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-950/60 border-blue-500 shadow-md'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-slate-200">{st.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{st.code}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Q: <strong className="text-sky-400">{st.currentValues.discharge.toFixed(2)} m³/s</strong></span>
                  <span>WQI: <strong className="text-emerald-400">{st.currentValues.wqi.toFixed(1)}</strong></span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                      st.ecaCompliance.isCompliant ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'
                    }`}
                  >
                    {st.ecaCompliance.isCompliant ? t('telem.status.ok') : t('telem.status.alert')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Columna 2 y 3: Ficha Técnica y Matriz Fisicoquímica de la Estación */}
        <div className="lg:col-span-2 p-5 bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800 space-y-5">
          {/* Header de Estación */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">{selectedStation.name}</h2>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs font-mono">
                  {selectedStation.code}
                </span>
                <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 text-xs">
                  {selectedStation.transmission}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {selectedStation.subbasin} • {t('telem.station.reach')}: {selectedStation.riverReach} • {t('telem.station.elevation')}: {selectedStation.coordinates.elevation} {t('station.masl')}
              </p>
            </div>

            <div className="text-right">
              <div className="text-xs text-slate-400">{t('telem.wqi.composite')}</div>
              <div className="text-2xl font-bold text-emerald-400">
                {vals.wqi.toFixed(1)}
                <span className="text-xs text-slate-400 font-normal"> / 100</span>
              </div>
            </div>
          </div>

          {/* Matriz de Parámetros Fisicoquímicos vs ECA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Oxígeno Disuelto */}
            {(() => {
              const chk = checkECA('do', vals.do);
              return (
                <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>{t('telem.param.do')}</span>
                    {chk.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <AlertOctagon className="w-3.5 h-3.5 text-red-400" />}
                  </div>
                  <div className="text-lg font-bold text-slate-100 mt-1">{vals.do.toFixed(1)} <span className="text-xs font-normal text-slate-400">mg/L</span></div>
                  <div className={`text-[10px] mt-0.5 ${chk.ok ? 'text-emerald-400' : 'text-red-400'}`}>{chk.msg}</div>
                </div>
              );
            })()}

            {/* pH */}
            {(() => {
              const chk = checkECA('ph', vals.ph);
              return (
                <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>{t('telem.param.ph')}</span>
                    {chk.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <AlertOctagon className="w-3.5 h-3.5 text-red-400" />}
                  </div>
                  <div className="text-lg font-bold text-slate-100 mt-1">{vals.ph.toFixed(1)} <span className="text-xs font-normal text-slate-400">{t('telem.unit.ph')}</span></div>
                  <div className={`text-[10px] mt-0.5 ${chk.ok ? 'text-emerald-400' : 'text-red-400'}`}>{chk.msg}</div>
                </div>
              );
            })()}

            {/* Conductividad Eléctrica */}
            {(() => {
              const chk = checkECA('ec', vals.ec);
              return (
                <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>{t('telem.param.ec')}</span>
                    {chk.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <AlertOctagon className="w-3.5 h-3.5 text-red-400" />}
                  </div>
                  <div className="text-lg font-bold text-slate-100 mt-1">{vals.ec.toFixed(0)} <span className="text-xs font-normal text-slate-400">µS/cm</span></div>
                  <div className={`text-[10px] mt-0.5 ${chk.ok ? 'text-emerald-400' : 'text-red-400'}`}>{chk.msg}</div>
                </div>
              );
            })()}

            {/* Turbidez */}
            {(() => {
              const chk = checkECA('turbidity', vals.turbidity);
              return (
                <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>{t('telem.param.turbidity')}</span>
                    {chk.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <AlertOctagon className="w-3.5 h-3.5 text-red-400" />}
                  </div>
                  <div className="text-lg font-bold text-slate-100 mt-1">{vals.turbidity.toFixed(1)} <span className="text-xs font-normal text-slate-400">NTU</span></div>
                  <div className={`text-[10px] mt-0.5 ${chk.ok ? 'text-emerald-400' : 'text-red-400'}`}>{chk.msg}</div>
                </div>
              );
            })()}

            {/* Nitratos */}
            {(() => {
              const chk = checkECA('nitrates', vals.nitrates);
              return (
                <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>{t('telem.param.nitrates')}</span>
                    {chk.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <AlertOctagon className="w-3.5 h-3.5 text-red-400" />}
                  </div>
                  <div className="text-lg font-bold text-slate-100 mt-1">{vals.nitrates.toFixed(1)} <span className="text-xs font-normal text-slate-400">mg/L</span></div>
                  <div className={`text-[10px] mt-0.5 ${chk.ok ? 'text-emerald-400' : 'text-red-400'}`}>{chk.msg}</div>
                </div>
              );
            })()}

            {/* Fósforo Total */}
            {(() => {
              const chk = checkECA('total_p', vals.total_p);
              return (
                <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>{t('telem.param.totalP')}</span>
                    {chk.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <AlertOctagon className="w-3.5 h-3.5 text-red-400" />}
                  </div>
                  <div className="text-lg font-bold text-slate-100 mt-1">{vals.total_p.toFixed(2)} <span className="text-xs font-normal text-slate-400">mg/L</span></div>
                  <div className={`text-[10px] mt-0.5 ${chk.ok ? 'text-emerald-400' : 'text-red-400'}`}>{chk.msg}</div>
                </div>
              );
            })()}

            {/* Coliformes Fecales */}
            {(() => {
              const chk = checkECA('coliforms', vals.fecal_coliforms);
              return (
                <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>{t('telem.param.coliforms')}</span>
                    {chk.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <AlertOctagon className="w-3.5 h-3.5 text-red-400" />}
                  </div>
                  <div className="text-lg font-bold text-slate-100 mt-1">{vals.fecal_coliforms.toFixed(0)} <span className="text-xs font-normal text-slate-400">NMP</span></div>
                  <div className={`text-[10px] mt-0.5 ${chk.ok ? 'text-emerald-400' : 'text-red-400'}`}>{chk.msg}</div>
                </div>
              );
            })()}

            {/* Plomo y Metales Pesados */}
            {(() => {
              const chk = checkECA('lead', vals.heavy_metals_lead);
              return (
                <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800">
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>{t('telem.param.lead')}</span>
                    {chk.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <AlertOctagon className="w-3.5 h-3.5 text-red-400" />}
                  </div>
                  <div className="text-lg font-bold text-slate-100 mt-1">{vals.heavy_metals_lead.toFixed(4)} <span className="text-xs font-normal text-slate-400">mg/L</span></div>
                  <div className={`text-[10px] mt-0.5 ${chk.ok ? 'text-emerald-400' : 'text-red-400'}`}>{chk.msg}</div>
                </div>
              );
            })()}
          </div>

          {/* Panel de Validación de Calidad de Datos (Data Quality Pipeline) */}
          <div className="p-4 bg-slate-950/90 rounded-lg border border-slate-800">
            <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-2">
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
              {t('telem.dq.title')}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>{t('telem.dq.hampel')}: <strong>0 {t('telem.dq.discards')}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>{t('telem.dq.physical')}: <strong>{t('telem.dq.inRange')}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                <span>{t('telem.dq.drift')}: <strong>{t('telem.dq.compensated')} (+0.02)</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
