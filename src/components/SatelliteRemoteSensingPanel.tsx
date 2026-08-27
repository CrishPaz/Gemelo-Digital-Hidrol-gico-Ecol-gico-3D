/**
 * SatelliteRemoteSensingPanel - Teledetección y Productos Satelitales
 * Ingesta e índices bio-ópticos de Sentinel-2 L2A (NDWI, MNDWI, Clorofila-a, Turbidez Nechad)
 * y Precipitación Satelital GPM IMERG (Early/Late Run).
 */

import React, { useState } from 'react';
import { SatelliteLayerData } from '../types';
import { calculateSatelliteWaterIndices } from '../services/waterQualityEngine';
import { useI18n } from '../providers/I18nProvider';
import {
  Layers,
  Sparkles,
  Satellite,
  Droplets,
  CloudSun,
  Eye,
  CheckCircle2,
  ExternalLink,
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

export const SatelliteRemoteSensingPanel: React.FC = () => {
  const { t } = useI18n();
  const [selectedSensor, setSelectedSensor] = useState<'Sentinel-2' | 'GPM_IMERG'>('Sentinel-2');

  // Muestra de reflectancias espectrales en un tramo fluvial (Río Moche - Simbal)
  const spectralReflectance = {
    green: 0.12,    // B3 (560 nm)
    red: 0.08,      // B4 (665 nm)
    redEdge: 0.14,  // B5 (705 nm)
    nir: 0.05,      // B8 (842 nm)
    swir: 0.02,     // B11 (1610 nm)
  };

  const bioIndices = calculateSatelliteWaterIndices(
    spectralReflectance.green,
    spectralReflectance.red,
    spectralReflectance.redEdge,
    spectralReflectance.nir,
    spectralReflectance.swir
  );

  // Comparativa GPM IMERG vs Pluviómetros in-situ
  const gpmComparisonData = [
    { day: `${t('sat.chart.day')} 1`, GPM_Satelital: 2.1, Pluviometro_InSitu: 1.8 },
    { day: `${t('sat.chart.day')} 2`, GPM_Satelital: 0.0, Pluviometro_InSitu: 0.0 },
    { day: `${t('sat.chart.day')} 3`, GPM_Satelital: 8.4, Pluviometro_InSitu: 9.2 },
    { day: `${t('sat.chart.day')} 4`, GPM_Satelital: 14.2, Pluviometro_InSitu: 15.6 },
    { day: `${t('sat.chart.day')} 5`, GPM_Satelital: 4.8, Pluviometro_InSitu: 4.2 },
    { day: `${t('sat.chart.day')} 6`, GPM_Satelital: 0.5, Pluviometro_InSitu: 0.0 },
    { day: `${t('sat.chart.day')} 7`, GPM_Satelital: 0.0, Pluviometro_InSitu: 0.0 },
  ];

  return (
    <div className="space-y-6">
      {/* Selector de Sensor Satelital */}
      <div className="p-4 bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Satellite className="w-4 h-4 text-sky-400" />
            {t('sat.title')}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('sat.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-lg text-xs">
          <button
            onClick={() => setSelectedSensor('Sentinel-2')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              selectedSensor === 'Sentinel-2' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t('sat.sensor.s2')}
          </button>
          <button
            onClick={() => setSelectedSensor('GPM_IMERG')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              selectedSensor === 'GPM_IMERG' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t('sat.sensor.gpm')}
          </button>
        </div>
      </div>

      {selectedSensor === 'Sentinel-2' ? (
        <div className="space-y-6">
          {/* Tarjetas de Índices Espectrales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800">
              <span className="text-xs font-semibold text-slate-400">NDWI (McFeeters)</span>
              <div className="text-2xl font-bold text-sky-400 my-1">{bioIndices.ndwi}</div>
              <p className="text-[11px] text-slate-400">{t('sat.index.ndwi.desc')}</p>
            </div>

            <div className="p-4 bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800">
              <span className="text-xs font-semibold text-slate-400">{t('sat.index.mndwi.label')}</span>
              <div className="text-2xl font-bold text-blue-400 my-1">{bioIndices.mndwi}</div>
              <p className="text-[11px] text-slate-400">{t('sat.index.mndwi.desc')}</p>
            </div>

            <div className="p-4 bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800">
              <span className="text-xs font-semibold text-slate-400">{t('sat.index.chla.label')}</span>
              <div className="text-2xl font-bold text-emerald-400 my-1">{bioIndices.chlorophyllAUgL} <span className="text-xs text-slate-400 font-normal">µg/L</span></div>
              <p className="text-[11px] text-slate-400">{t('sat.index.chla.desc')}</p>
            </div>

            <div className="p-4 bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800">
              <span className="text-xs font-semibold text-slate-400">{t('sat.index.turbidity.label')}</span>
              <div className="text-2xl font-bold text-amber-400 my-1">{bioIndices.turbidityNTU} <span className="text-xs text-slate-400 font-normal">NTU</span></div>
              <p className="text-[11px] text-slate-400">{t('sat.index.turbidity.desc')}</p>
            </div>
          </div>

          {/* Ficha de Metadatos STAC del Mosaico */}
          <div className="p-5 bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              {t('sat.metadata.title')}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-300">
              <div className="p-2.5 bg-slate-950/70 rounded-lg border border-slate-800">
                <span className="text-slate-500">{t('sat.metadata.mission')}</span>
                <p className="font-semibold text-slate-200 mt-0.5">Sentinel-2B MSI</p>
              </div>
              <div className="p-2.5 bg-slate-950/70 rounded-lg border border-slate-800">
                <span className="text-slate-500">{t('sat.metadata.level')}</span>
                <p className="font-semibold text-slate-200 mt-0.5">Level-2A (BOA Reflectance)</p>
              </div>
              <div className="p-2.5 bg-slate-950/70 rounded-lg border border-slate-800">
                <span className="text-slate-500">{t('sat.metadata.cloud')}</span>
                <p className="font-semibold text-emerald-400 mt-0.5">4.2% ({t('sat.metadata.valid')})</p>
              </div>
              <div className="p-2.5 bg-slate-950/70 rounded-lg border border-slate-800">
                <span className="text-slate-500">{t('sat.metadata.resolution')}</span>
                <p className="font-semibold text-sky-400 mt-0.5">10 m / 20 m</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-5 bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-100">
              {t('sat.gpm.title')}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('sat.gpm.subtitle')}
            </p>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={gpmComparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} unit=" mm" />
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
                  dataKey="GPM_Satelital"
                  stroke="#38bdf8"
                  strokeWidth={2.2}
                  name={t('sat.gpm.series.satellite')}
                />
                <Line
                  type="monotone"
                  dataKey="Pluviometro_InSitu"
                  stroke="#10b981"
                  strokeWidth={2.2}
                  name={t('sat.gpm.series.gauge')}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
