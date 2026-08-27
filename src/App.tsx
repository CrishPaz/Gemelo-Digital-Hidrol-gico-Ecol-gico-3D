/**
 * App.tsx - Gemelo Digital Hidrológico-Ecológico de la Cuenca del Río Moche
 * Integración central de visualización 3D (Three.js), asimilación de datos (GR4J + EnKF),
 * telemetría IoT, caudales ecológicos, teledetección satelital, simulador "What-If" y reportes.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  MonitoringStation,
  HydroSimulationResult,
  EcologicalFlowBenchmark,
  UserProfile,
  AuditLogEntry,
} from './types';
import {
  MOCHE_BASIN_STATIONS,
  MOCHE_ECOLOGICAL_FLOW_BENCHMARKS,
  INITIAL_USERS,
  INITIAL_AUDIT_LOGS,
} from './data/mocheBasinData';
import { runEnKFAssimilation, DEFAULT_ENKF_CONFIG } from './services/enkfEngine';
import { DEFAULT_MOCHE_GR4J_PARAMS } from './services/hydroEngine';
import { Header } from './components/Header';
import { DigitalTwin3D } from './components/DigitalTwin3D';
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import { IoTTelemetryPanel } from './components/IoTTelemetryPanel';
import { HydroEnKFPanel } from './components/HydroEnKFPanel';
import { EcologicalFlowPanel } from './components/EcologicalFlowPanel';
import { ScenarioWhatIfPanel } from './components/ScenarioWhatIfPanel';
import { SatelliteRemoteSensingPanel } from './components/SatelliteRemoteSensingPanel';
import { ReportsAndAuditPanel } from './components/ReportsAndAuditPanel';
import { HydrodynamicsFloodPanel } from './components/HydrodynamicsFloodPanel';
import { WaterAllocationPanel } from './components/WaterAllocationPanel';
import { HeavyMetalsTransportPanel } from './components/HeavyMetalsTransportPanel';
import { AICopilotPanel } from './components/AICopilotPanel';
import { EarlyWarningSystemPanel } from './components/EarlyWarningSystemPanel';
import { HydraulicInfrastructureSCADAPanel } from './components/HydraulicInfrastructureSCADAPanel';
import { HydrogeologySalinityPanel } from './components/HydrogeologySalinityPanel';
import { HydroCalibrationPanel } from './components/HydroCalibrationPanel';
import { RBACUserModal } from './components/RBACUserModal';
import { useBasinGeodata } from './hooks/useBasinGeodata';
import { useI18n } from './providers/I18nProvider';

export default function App() {
  const { t } = useI18n();

  // Estado de navegación
  const [activeTab, setActiveTab] = useState<string>('3d_twin');

  // Estado de Capa 3D Activa
  const [active3DLayer, setActive3DLayer] = useState<'elevation' | 'wqi' | 'ndwi' | 'discharge' | 'flood' | 'heavy_metals'>('elevation');

  // Estado del usuario activo (RBAC)
  const [currentUser, setCurrentUser] = useState<UserProfile>(INITIAL_USERS[1]); // Gestor de Cuenca
  const [isRBACModalOpen, setIsRBACModalOpen] = useState<boolean>(false);

  // Estado de Estaciones de Monitoreo
  const [stations, setStations] = useState<MonitoringStation[]>(MOCHE_BASIN_STATIONS);
  const [selectedStation, setSelectedStation] = useState<MonitoringStation>(MOCHE_BASIN_STATIONS[0]);

  // Estado de Caudales Ecológicos
  const [eflowBenchmarks] = useState<EcologicalFlowBenchmark[]>(MOCHE_ECOLOGICAL_FLOW_BENCHMARKS);

  // Estado de Auditoría
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);

  // Generación de serie temporal sintética inicial de 60 días para la cuenca del Moche
  const generateInitialSimulation = (): HydroSimulationResult => {
    const timestamps: string[] = [];
    const precipitation: number[] = [];
    const evapotranspiration: number[] = [];
    const observedDischarge: number[] = [];

    const now = new Date();
    for (let i = 59; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      timestamps.push(d.toISOString().split('T')[0]);

      // Régimen estacional con eventos de lluvia en cuenca alta
      const isRainyDay = i > 15 && i < 35;
      const p = isRainyDay ? Math.max(0, Math.sin(i * 0.4) * 22 + Math.random() * 12) : Math.random() * 2.5;
      const pet = 3.5 + Math.sin(i * 0.1) * 0.8 + Math.random() * 0.3;

      precipitation.push(Number(p.toFixed(1)));
      evapotranspiration.push(Number(pet.toFixed(1)));

      // Caudal observado con ruido natural
      const qObsBase = 2.2 + (p * 0.6) + Math.sin(i * 0.15) * 1.5 + (Math.random() - 0.5) * 0.4;
      observedDischarge.push(Math.max(0.8, Number(qObsBase.toFixed(2))));
    }

    return runEnKFAssimilation(
      timestamps,
      precipitation,
      evapotranspiration,
      observedDischarge,
      DEFAULT_MOCHE_GR4J_PARAMS,
      DEFAULT_ENKF_CONFIG
    );
  };

  const [simulationResult, setSimulationResult] = useState<HydroSimulationResult>(generateInitialSimulation);

  // Función para simular ingesta de un nuevo paquete IoT en tiempo real
  const handleSimulateNewPacket = () => {
    setStations(prev =>
      prev.map(st => {
        const deltaQ = (Math.random() - 0.48) * 0.25;
        const newQ = Math.max(0.2, Number((st.currentValues.discharge + deltaQ).toFixed(2)));
        const deltaWQI = (Math.random() - 0.5) * 2;
        const newWQI = Math.min(100, Math.max(20, Number((st.currentValues.wqi + deltaWQI).toFixed(1))));

        return {
          ...st,
          currentValues: {
            ...st.currentValues,
            discharge: newQ,
            wqi: newWQI,
            turbidity: Math.max(1, Number((st.currentValues.turbidity + (Math.random() - 0.5) * 1.5).toFixed(1))),
            do: Math.max(2, Number((st.currentValues.do + (Math.random() - 0.5) * 0.2).toFixed(1))),
          },
          lastTelemetryTimestamp: new Date().toISOString(),
        };
      })
    );

    // Registro en auditoría
    const newLog: AuditLogEntry = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      userId: currentUser.id,
      userName: currentUser.name,
      role: currentUser.role,
      action: 'INGEST_IOT_PACKET',
      module: 'IoT Telemetría',
      details: 'Ingesta de ráfaga de telemetría MQTT (12 sondas multiparamétricas)',
    };
    setAuditLogs(prev => [newLog, ...prev.slice(0, 49)]);
  };

  // Simulación periódica suave de telemetría en segundo plano (cada 12 segundos)
  useEffect(() => {
    const interval = setInterval(() => {
      handleSimulateNewPacket();
    }, 12000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Selección de estación interactiva
  const handleSelectStation = (st: MonitoringStation) => {
    setSelectedStation(st);
  };

  // Geodatos reales de la cuenca (DEM SRTM/Copernicus, hidrografía OSM, clima Open-Meteo).
  // Los puntos se derivan de las coordenadas fijas de las estaciones, no de sus lecturas,
  // para que la telemetría simulada cada 12 s no vuelva a disparar la descarga.
  const stationPoints = useMemo(
    () => MOCHE_BASIN_STATIONS.map(st => ({ lat: st.coordinates.lat, lon: st.coordinates.lng })),
    []
  );
  const geodata = useBasinGeodata(stationPoints);

  // Pestañas que deben encajar exactamente en el viewport, sin desplazamiento
  const isFullBleedTab = activeTab === '3d_twin';

  return (
    <div className="h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Barra de Navegación Superior */}
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        currentUser={currentUser}
        onOpenRBACModal={() => setIsRBACModalOpen(true)}
        stations={stations}
      />

      {/* Contenido Principal: ocupa la altura restante del viewport.
          El Gemelo 3D se ajusta al alto disponible; el resto de módulos,
          al ser tableros densos, desplazan solo su propio contenedor. */}
      <main
        className={`flex-1 min-h-0 w-full ${
          isFullBleedTab ? 'overflow-hidden' : 'overflow-y-auto app-scroll'
        }`}
      >
        <div
          className={`w-full max-w-[1800px] mx-auto px-4 sm:px-6 ${
            isFullBleedTab ? 'h-full py-3 flex flex-col gap-3' : 'py-5 space-y-6'
          }`}
        >
        {activeTab === '3d_twin' && (
          <div className="flex flex-col flex-1 min-h-0 gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div>
                <h1 className="text-base font-bold text-slate-100">{t('twin.title')}</h1>
                <p className="text-xs text-slate-400">{t('twin.subtitle')}</p>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{stations.length} {t('twin.nodes')}</span>
              </div>
            </div>

            {/* Escenario 3D Interactivo */}
            <DigitalTwin3D
              stations={stations}
              selectedStation={selectedStation}
              onSelectStation={handleSelectStation}
              activeLayer={active3DLayer}
              onLayerChange={setActive3DLayer}
              geodata={geodata}
            />
          </div>
        )}

        {activeTab === 'dashboard' && (
          <ExecutiveDashboard
            stations={stations}
            simulationResult={simulationResult}
            eflowBenchmarks={eflowBenchmarks}
            onSelectStation={handleSelectStation}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'sat_early_warning' && (
          <EarlyWarningSystemPanel
            currentUser={currentUser}
          />
        )}

        {activeTab === 'scada_infra' && (
          <HydraulicInfrastructureSCADAPanel
            currentUser={currentUser}
          />
        )}

        {activeTab === 'telemetry' && (
          <IoTTelemetryPanel
            stations={stations}
            selectedStation={selectedStation}
            onSelectStation={handleSelectStation}
            onSimulateNewPacket={handleSimulateNewPacket}
          />
        )}

        {activeTab === 'hydro_enkf' && (
          <HydroEnKFPanel
            simulationResult={simulationResult}
            onUpdateSimulation={setSimulationResult}
          />
        )}

        {activeTab === 'hydrodynamics' && (
          <HydrodynamicsFloodPanel />
        )}

        {activeTab === 'allocation' && (
          <WaterAllocationPanel />
        )}

        {activeTab === 'hydrogeology' && (
          <HydrogeologySalinityPanel
            currentUser={currentUser}
          />
        )}

        {activeTab === 'calibration' && (
          <HydroCalibrationPanel
            currentUser={currentUser}
          />
        )}

        {activeTab === 'heavy_metals' && (
          <HeavyMetalsTransportPanel />
        )}

        {activeTab === 'eflow' && (
          <EcologicalFlowPanel
            benchmarks={eflowBenchmarks}
            stations={stations}
            simulationResult={simulationResult}
          />
        )}

        {activeTab === 'scenarios' && (
          <ScenarioWhatIfPanel
            baseSimulation={simulationResult}
            stations={stations}
          />
        )}

        {activeTab === 'satellite' && (
          <SatelliteRemoteSensingPanel />
        )}

        {activeTab === 'ai_copilot' && (
          <AICopilotPanel
            currentUser={currentUser}
            stations={stations}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsAndAuditPanel
            stations={stations}
            simulationResult={simulationResult}
            eflowBenchmarks={eflowBenchmarks}
            currentUser={currentUser}
            auditLogs={auditLogs}
          />
        )}
        </div>
      </main>

      {/* Modal de Gestión de Roles RBAC */}
      <RBACUserModal
        isOpen={isRBACModalOpen}
        onClose={() => setIsRBACModalOpen(false)}
        currentUser={currentUser}
        onSelectUser={setCurrentUser}
      />
    </div>
  );
}
