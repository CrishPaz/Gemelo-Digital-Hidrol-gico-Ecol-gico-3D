/**
 * WaterAllocationPanel.tsx - Fase de Balance Hídrico, Asignación de Recursos Hídricos
 * y Derechos de Uso de Agua (Ley N° 29338) en la Cuenca del Río Moche.
 */

import React, { useState } from 'react';
import { WaterDemandSector, MonthlyWaterBalance } from '../types';
import { MOCHE_WATER_DEMAND_SECTORS, MOCHE_MONTHLY_WATER_BALANCE } from '../data/mocheHydroData';
import { optimizeWaterAllocation } from '../services/hydrodynamicsEngine';
import {
  Droplets,
  Scale,
  Building2,
  Trees,
  Factory,
  ShieldCheck,
  AlertCircle,
  TrendingDown,
  Sliders,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Line,
  ComposedChart,
} from 'recharts';

export const WaterAllocationPanel: React.FC = () => {
  const [riverDischargeM3s, setRiverDischargeM3s] = useState<number>(8.5);
  const [selectedMonth, setSelectedMonth] = useState<string>('Marzo');

  // Cálculo de asignación optimizada según Ley 29338
  const allocatedSectors = optimizeWaterAllocation(riverDischargeM3s, MOCHE_WATER_DEMAND_SECTORS);

  const totalRequested = allocatedSectors.reduce((acc, s) => acc + s.requestedFlowM3s, 0);
  const totalAllocated = allocatedSectors.reduce((acc, s) => acc + s.allocatedFlowM3s, 0);
  const globalSatisfaction = Number(((totalAllocated / totalRequested) * 100).toFixed(1));

  // Datos para el gráfico mensualizado
  const monthlyChartData = MOCHE_MONTHLY_WATER_BALANCE.map(m => ({
    mes: m.month.slice(0, 3),
    nombreCompleto: m.month,
    oferta: m.riverInflowHm3,
    reservaEcologica: m.ecologicalReserveHm3,
    poblacional: m.poblacionalDemandHm3,
    agricola: m.agricolaDemandHm3,
    industrial: m.industrialDemandHm3,
    demandaTotal: m.totalDemandHm3,
    estres: m.waterStressIndexPercent,
  }));

  const activeMonthData = MOCHE_MONTHLY_WATER_BALANCE.find(m => m.month === selectedMonth) || MOCHE_MONTHLY_WATER_BALANCE[2];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Encabezado del Módulo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Scale className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-100">
              Balance Hídrico & Asignación de Derechos de Agua
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Distribución multisectorial según prelación de la Ley de Recursos Hídricos N° 29338 (1° Ecológico, 2° Poblacional, 3° Agrario, 4° Industrial).
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <div className="px-3 py-1.5 bg-slate-900 rounded-lg text-center">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Oferta Fluvial</div>
            <div className="text-sm font-extrabold text-emerald-400 font-mono">{riverDischargeM3s.toFixed(2)} m³/s</div>
          </div>
          <div className="px-3 py-1.5 bg-slate-900 rounded-lg text-center">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Cobertura Demanda</div>
            <div className={`text-sm font-extrabold font-mono ${globalSatisfaction >= 90 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {globalSatisfaction}%
            </div>
          </div>
        </div>
      </div>

      {/* Control Interactivo de Caudal Disponible y Resumen de Asignación */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Slider de Caudal Fluvial */}
        <div className="lg:col-span-2 bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
            <span className="flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-emerald-400" />
              Simular Caudal Natural Disponible (Q_disp):
            </span>
            <span className="font-mono text-emerald-400 font-bold">{riverDischargeM3s.toFixed(2)} m³/s</span>
          </div>
          <input
            type="range"
            min="1.2"
            max="25.0"
            step="0.1"
            value={riverDischargeM3s}
            onChange={e => setRiverDischargeM3s(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-2">
            <span>Estiaje Severo (1.2 m³/s)</span>
            <span>Promedio Anual (8.5 m³/s)</span>
            <span>Avenida Húmeda (25.0 m³/s)</span>
          </div>
        </div>

        {/* Tarjeta de Demanda vs Asignado */}
        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="text-[10px] text-slate-400 uppercase font-bold">Balance Global Instantáneo</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-extrabold text-slate-100 font-mono">{totalAllocated.toFixed(2)}</span>
            <span className="text-xs text-slate-400">/ {totalRequested.toFixed(2)} m³/s</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                globalSatisfaction >= 90 ? 'bg-emerald-500' : globalSatisfaction >= 70 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(100, globalSatisfaction)}%` }}
            />
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Déficit total: {(totalRequested - totalAllocated).toFixed(2)} m³/s
          </div>
        </div>

        {/* Estado del Caudal Ecológico */}
        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            Prioridad 1: Reserva Ecológica
          </div>
          <div className="text-xl font-extrabold text-emerald-400 font-mono mt-1">
            {allocatedSectors[0].allocatedFlowM3s.toFixed(2)} m³/s
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            100% garantizado con máxima prelación jurídica.
          </div>
        </div>
      </div>

      {/* Gráfico de Balance Hídrico Mensualizado */}
      <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Droplets className="w-4 h-4 text-emerald-400" />
              Balance de Oferta vs Demandas Mensualizadas ($Hm^3/mes$)
            </h3>
            <p className="text-[11px] text-slate-400">
              Comparativa estacional de régimen pluvial andino frente a demandas consuntivas.
            </p>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
            {MOCHE_MONTHLY_WATER_BALANCE.map(m => (
              <button
                key={m.month}
                onClick={() => setSelectedMonth(m.month)}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                  selectedMonth === m.month
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {m.month.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthlyChartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="mes" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} unit=" Hm³" />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                formatter={(value: any, name: string) => [`${value} Hm³`, name]}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Bar dataKey="poblacional" stackId="a" fill="#38bdf8" name="Urbano / Poblacional" />
              <Bar dataKey="agricola" stackId="a" fill="#10b981" name="Riego Agrícola" />
              <Bar dataKey="industrial" stackId="a" fill="#f59e0b" name="Industrial / Minero" />
              <Bar dataKey="reservaEcologica" stackId="a" fill="#06b6d4" name="Reserva Ecológica" />
              <Line type="monotone" dataKey="oferta" stroke="#ec4899" strokeWidth={3} dot={{ r: 4 }} name="Oferta Fluvial Total" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabla de Concesiones y Estado de Compuertas por Sector */}
      <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Scale className="w-4 h-4 text-blue-400" />
            Matriz de Asignación por Bloque de Riego & Concesión ANA
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            Mes Seleccionado: <strong className="text-emerald-400">{selectedMonth}</strong> ({activeMonthData.status})
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono">
              <tr>
                <th className="p-3">Prioridad</th>
                <th className="p-3">Sector / Concesionario</th>
                <th className="p-3">Categoría</th>
                <th className="p-3">Bocatoma / Captación</th>
                <th className="p-3">Demanda ($m^3/s$)</th>
                <th className="p-3">Asignado ($m^3/s$)</th>
                <th className="p-3">Cobertura</th>
                <th className="p-3">Compuerta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {allocatedSectors.map(sec => {
                const isPoblacional = sec.category === 'poblacional';
                const isEcologico = sec.category === 'ecologico';
                const isAgricola = sec.category === 'agricola';

                return (
                  <tr key={sec.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3">
                      <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-200 font-bold flex items-center justify-center text-[11px]">
                        {sec.priorityRank}°
                      </span>
                    </td>
                    <td className="p-3 font-sans">
                      <div className="font-bold text-slate-200">{sec.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{sec.concessionCode}</div>
                    </td>
                    <td className="p-3 font-sans">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          isEcologico
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                            : isPoblacional
                            ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                            : isAgricola
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {sec.category.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3 font-sans text-slate-300">
                      <div>{sec.intakeName}</div>
                      <div className="text-[10px] text-slate-500">Km {sec.intakeKm}</div>
                    </td>
                    <td className="p-3 font-bold text-slate-300">{sec.requestedFlowM3s.toFixed(2)}</td>
                    <td className="p-3 font-bold text-emerald-400">{sec.allocatedFlowM3s.toFixed(2)}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              sec.satisfactionRatePercent === 100
                                ? 'bg-emerald-500'
                                : sec.satisfactionRatePercent >= 75
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${sec.satisfactionRatePercent}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold">{sec.satisfactionRatePercent}%</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          sec.gateStatus === '100% Abierta'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : sec.gateStatus === '75% Regulada'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : sec.gateStatus === '50% Restringida'
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}
                      >
                        {sec.gateStatus}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
