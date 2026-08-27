/**
 * Header - Barra Superior de Navegación, Estado de Cuenca y Control de Sesión
 */

import React from 'react';
import { UserProfile, MonitoringStation } from '../types';
import { useTheme } from '../providers/ThemeProvider';
import { useI18n } from '../providers/I18nProvider';
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
  Sun,
  Moon,
  Languages,
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
  const { theme, toggleTheme } = useTheme();
  const { locale, toggleLocale, t } = useI18n();

  // Las etiquetas se resuelven por clave: el id de la pestaña es también la clave
  // de traducción, así no hay dos listas que mantener sincronizadas.
  const navItems: Array<{ id: string; icon: typeof Box }> = [
    { id: '3d_twin', icon: Box },
    { id: 'dashboard', icon: BarChart3 },
    { id: 'sat_early_warning', icon: BellRing },
    { id: 'scada_infra', icon: Cpu },
    { id: 'telemetry', icon: Radio },
    { id: 'hydro_enkf', icon: Activity },
    { id: 'hydrodynamics', icon: Compass },
    { id: 'allocation', icon: Scale },
    { id: 'hydrogeology', icon: Anchor },
    { id: 'calibration', icon: SlidersHorizontal },
    { id: 'heavy_metals', icon: FlaskConical },
    { id: 'eflow', icon: Droplets },
    { id: 'scenarios', icon: Sliders },
    { id: 'satellite', icon: Satellite },
    { id: 'ai_copilot', icon: Sparkles },
    { id: 'reports', icon: FileText },
  ];

  const renderTab = (item: { id: string; icon: typeof Box }) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => onSelectTab(item.id)}
        title={t(`nav.${item.id}.full`)}
        className={`px-2.5 py-1.5 rounded-lg text-[11px] xl:text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-all ${
          isActive
            ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/40 font-semibold'
            : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
        }`}
      >
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">{t(`nav.${item.id}`)}</span>
      </button>
    );
  };

  return (
    <header className="shrink-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80">
      <div className="w-full px-4 sm:px-6">
        {/* Fila 1: Identidad institucional, alertas y sesión */}
        <div className="flex items-center justify-between gap-4 h-14">
          {/* Logo y Título Institucional */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-tr from-blue-600 via-sky-500 to-emerald-400 p-0.5 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Waves className="w-5 h-5 text-sky-400" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm tracking-tight text-slate-100 whitespace-nowrap">
                  HYDROTWIN 3D
                </span>
                <span className="px-1.5 py-0.5 rounded bg-sky-950 border border-sky-800 text-[10px] font-mono text-sky-300 whitespace-nowrap">
                  {t('app.basin')}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-none mt-0.5 hidden md:block truncate">
                {t('app.subtitle')}
              </p>
            </div>
          </div>

          {/* Preferencias, Alertas y Perfil RBAC */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Selector de idioma */}
            <button
              onClick={toggleLocale}
              title={`${t('header.language')}: ${locale === 'es' ? 'Español' : 'English'}`}
              aria-label={t('header.language')}
              className="flex items-center gap-1.5 px-2 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 hover:bg-slate-800/80 transition-colors"
            >
              <Languages className="w-4 h-4" />
              <span className="text-[11px] font-bold tracking-wide uppercase">{locale}</span>
            </button>

            {/* Tema claro / oscuro */}
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? t('header.theme.toLight') : t('header.theme.toDark')}
              aria-label={theme === 'dark' ? t('header.theme.toLight') : t('header.theme.toDark')}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 hover:bg-slate-800/80 transition-colors"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-sky-400" />
              )}
            </button>

            {/* Indicador de Alertas */}
            <button
              onClick={() => onSelectTab('telemetry')}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors relative"
              title={`${alertCount} ${t('header.alerts')}`}
            >
              <Bell className="w-4 h-4" />
              {alertCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
                  {alertCount}
                </span>
              )}
            </button>

            {/* Perfil de Usuario y Cambio de Rol RBAC */}
            <button
              onClick={onOpenRBACModal}
              className="flex items-center gap-2.5 p-1.5 pr-3 bg-slate-900 hover:bg-slate-800/90 rounded-xl border border-slate-800 transition-all text-left"
            >
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-7 h-7 rounded-lg object-cover border border-slate-700 shrink-0"
              />
              <div className="hidden sm:block">
                <div className="text-xs font-bold text-slate-200 leading-tight whitespace-nowrap">
                  {currentUser.name}
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Shield className="w-2.5 h-2.5 text-blue-400" />
                  <span className="capitalize whitespace-nowrap">{currentUser.role.replace('_', ' ')}</span>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Fila 2: Navegación de módulos — ancho completo y con salto de línea,
            nunca desborda horizontalmente sea cual sea la resolución. */}
        <nav className="flex flex-wrap items-center justify-center gap-1 pb-2 pt-0.5 border-t border-slate-800/60">
          {navItems.map(renderTab)}
        </nav>
      </div>
    </header>
  );
};
