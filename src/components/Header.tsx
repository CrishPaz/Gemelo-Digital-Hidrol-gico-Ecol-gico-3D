/**
 * Header - Barra Superior de Navegación, Estado de Cuenca y Control de Sesión
 */

import React from 'react';
import { UserProfile, MonitoringStation } from '../types';
import {
  Waves,
  Shield,
  Bell,
  BellRing,
  Activity,
  Box,
  Sliders,
  Droplets,
  HelpCircle,
  Satellite,
  FileText,
  Radio,
  BarChart3,
  Compass,
  Scale,
  FlaskConical,
  Sparkles,
  Cpu,
  Anchor,
  SlidersHorizontal,
} from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  currentUser: UserProfile;
  onOpenRBACModal: () => void;
  stations: MonitoringStation[];
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  currentUser,
  onOpenRBACModal,
  stations,
}) => {
  const alertCount = stations.filter(s => !s.ecaCompliance.isCompliant || s.status === 'warning').length;

  const navItems = [
    { id: '3d_twin', label: 'Gemelo 3D', icon: Box },
    { id: 'dashboard', label: 'Panel Ejecutivo', icon: BarChart3 },
    { id: 'sat_early_warning', label: 'Alerta Temprana SAT', icon: BellRing },
    { id: 'scada_infra', label: 'SCADA & Dam-Break', icon: Cpu },
    { id: 'telemetry', label: 'Telemetría IoT & ECA', icon: Radio },
    { id: 'hydro_enkf', label: 'Hidrología & EnKF', icon: Activity },
    { id: 'hydrodynamics', label: 'Hidráulica & Inundación', icon: Compass },
    { id: 'allocation', label: 'Balance & Asignación', icon: Scale },
    { id: 'hydrogeology', label: 'Hidrogeología & Salinidad', icon: Anchor },
    { id: 'calibration', label: 'Calibración SCE-UA', icon: SlidersHorizontal },
    { id: 'heavy_metals', label: 'Metales & DAM', icon: FlaskConical },
    { id: 'eflow', label: 'Caudal Ecológico', icon: Droplets },
    { id: 'scenarios', label: 'Escenarios What-If', icon: Sliders },
    { id: 'satellite', label: 'Teledetección', icon: Satellite },
    { id: 'ai_copilot', label: 'Copiloto IA', icon: Sparkles },
    { id: 'reports', label: 'Informes & Auditoría', icon: FileText },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo y Título Institucional */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-sky-500 to-emerald-400 p-0.5 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Waves className="w-5 h-5 text-sky-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm tracking-tight text-slate-100">
                  HYDROTWIN 3D
                </span>
                <span className="px-1.5 py-0.2 rounded bg-sky-950 border border-sky-800 text-[10px] font-mono text-sky-300">
                  RÍO MOCHE
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-none mt-0.5 hidden sm:block">
                Gemelo Digital Hidrológico-Ecológico • Asimilación IoT & Satelital
              </p>
            </div>
          </div>

          {/* Navegación por Pestañas */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Estado de Alertas y Perfil RBAC */}
          <div className="flex items-center gap-3">
            {/* Indicador de Alertas */}
            <div className="relative">
              <button
                onClick={() => onSelectTab('telemetry')}
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors relative"
                title={`${alertCount} alertas activas`}
              >
                <Bell className="w-4 h-4" />
                {alertCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
                    {alertCount}
                  </span>
                )}
              </button>
            </div>

            {/* Perfil de Usuario y Cambio de Rol RBAC */}
            <button
              onClick={onOpenRBACModal}
              className="flex items-center gap-2.5 p-1.5 pr-3 bg-slate-900 hover:bg-slate-800/90 rounded-xl border border-slate-800 transition-all text-left"
            >
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-7 h-7 rounded-lg object-cover border border-slate-700"
              />
              <div className="hidden sm:block">
                <div className="text-xs font-bold text-slate-200 leading-tight">
                  {currentUser.name}
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Shield className="w-2.5 h-2.5 text-blue-400" />
                  <span className="capitalize">{currentUser.role.replace('_', ' ')}</span>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Barra de Navegación Móvil (Scrollable) */}
        <div className="lg:hidden flex items-center gap-1 overflow-x-auto py-2 border-t border-slate-800/60 no-scrollbar">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-900/60 border border-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
