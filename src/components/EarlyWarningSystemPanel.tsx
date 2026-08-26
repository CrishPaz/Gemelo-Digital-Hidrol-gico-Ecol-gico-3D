/**
 * EarlyWarningSystemPanel.tsx - Fase de Sistema de Alerta Temprana (SAT),
 * Protocolo CAP v1.2 (OASIS / INDECI / COER), Red de Sirenas Acústicas y Difusión Multi-Canal.
 */

import React, { useState } from 'react';
import { EarlyWarningThreshold, CAPAlertBroadcast, AcousticSirenNode, UserProfile } from '../types';
import { INITIAL_SAT_THRESHOLDS, INITIAL_ACOUSTIC_SIRENS, INITIAL_CAP_ALERTS } from '../data/satData';
import {
  BellRing,
  ShieldAlert,
  Radio,
  Send,
  Volume2,
  VolumeX,
  Smartphone,
  Landmark,
  Wifi,
  Activity,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  FileCode2,
  Share2,
  Sparkles,
  Sliders,
  RefreshCw,
  PlusCircle,
  Eye,
  TowerControl,
} from 'lucide-react';

interface EarlyWarningSystemPanelProps {
  currentUser?: UserProfile;
}

export const EarlyWarningSystemPanel: React.FC<EarlyWarningSystemPanelProps> = ({ currentUser }) => {
  const [thresholds, setThresholds] = useState<EarlyWarningThreshold[]>(INITIAL_SAT_THRESHOLDS);
  const [sirens, setSirens] = useState<AcousticSirenNode[]>(INITIAL_ACOUSTIC_SIRENS);
  const [capAlerts, setCapAlerts] = useState<CAPAlertBroadcast[]>(INITIAL_CAP_ALERTS);
  const [selectedAlert, setSelectedAlert] = useState<CAPAlertBroadcast | null>(INITIAL_CAP_ALERTS[0]);
  const [isCreatingAlert, setIsCreatingAlert] = useState<boolean>(false);
  const [capXmlView, setCapXmlView] = useState<boolean>(false);

  // Formulario de Nueva Alerta CAP
  const [newHeadline, setNewHeadline] = useState<string>('ALERTA ROJA: Desborde Inminente del Río Moche en Laredo');
  const [newEvent, setNewEvent] = useState<string>('Desborde Fluvial / Crecida Extraordinaria');
  const [newSeverity, setNewSeverity] = useState<'Extreme' | 'Severe' | 'Moderate' | 'Minor'>('Extreme');
  const [newArea, setNewArea] = useState<string>('Sector Campiña de Moche, Laredo, Curva de Sun');
  const [newDesc, setNewDesc] = useState<string>('Caudal en estación Laredo supera 145 m³/s. Nivel de agua sobrepasa la cota de corona de ribera.');
  const [newInstruction, setNewInstruction] = useState<string>('Evacuar de inmediato hacia zonas altas designadas (Cerro Blanco / Mirador Laredo) y activar comités distritales INDECI.');
  const [targetPop, setTargetPop] = useState<number>(42000);
  const [channels, setChannels] = useState<('SMS_CellBroadcast' | 'COER_INDECI_Link' | 'Acoustic_Sirens' | 'Radio_FM_VHF')[]>([
    'SMS_CellBroadcast',
    'COER_INDECI_Link',
    'Acoustic_Sirens',
  ]);

  // Disparo manual o test de sirena acústica
  const handleToggleSirenState = (sirenId: string) => {
    setSirens(prev =>
      prev.map(s => {
        if (s.id === sirenId) {
          const nextState =
            s.state === 'Silencioso (Standby)'
              ? 'Evacuación Inmediata (115dB)'
              : s.state === 'Evacuación Inmediata (115dB)'
              ? 'Pre-Alerta Sonora'
              : 'Silencioso (Standby)';
          return { ...s, state: nextState };
        }
        return s;
      })
    );
  };

  // Crear y emitir boletín CAP
  const handleBroadcastAlert = () => {
    const newCap: CAPAlertBroadcast = {
      identifier: `CAP-PE-COERLL-${new Date().getFullYear()}-08-${Math.floor(1000 + Math.random() * 9000)}`,
      sender: currentUser?.email || 'sat-operador@regionlalibertad.gob.pe',
      sentTime: new Date().toISOString(),
      status: 'Actual',
      msgType: 'Alert',
      scope: 'Public',
      category: 'Met',
      urgency: 'Immediate',
      severity: newSeverity,
      certainty: 'Observed',
      event: newEvent,
      headline: newHeadline,
      description: newDesc,
      instruction: newInstruction,
      areaDesc: newArea,
      targetPopulation: targetPop,
      disseminationChannels: channels,
      statusDelivery: 'Emitido y Difundido',
    };

    setCapAlerts([newCap, ...capAlerts]);
    setSelectedAlert(newCap);
    setIsCreatingAlert(false);

    // Si se incluyeron sirenas, activar automáticamente sirenas en zonas bajas
    if (channels.includes('Acoustic_Sirens')) {
      setSirens(prev =>
        prev.map(s => (s.locationKm < 25 ? { ...s, state: 'Evacuación Inmediata (115dB)' } : s))
      );
    }
  };

  const generateCAPXML = (alert: CAPAlertBroadcast) => {
    return `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>${alert.identifier}</identifier>
  <sender>${alert.sender}</sender>
  <sent>${alert.sentTime}</sent>
  <status>${alert.status}</status>
  <msgType>${alert.msgType}</msgType>
  <scope>${alert.scope}</scope>
  <info>
    <category>${alert.category}</category>
    <event>${alert.event}</event>
    <urgency>${alert.urgency}</urgency>
    <severity>${alert.severity}</severity>
    <certainty>${alert.certainty}</certainty>
    <headline>${alert.headline}</headline>
    <description>${alert.description}</description>
    <instruction>${alert.instruction}</instruction>
    <area>
      <areaDesc>${alert.areaDesc}</areaDesc>
    </area>
  </info>
</alert>`;
  };

  const redAlertsCount = thresholds.filter(t => t.currentAlertLevel === 'ROJO').length;
  const orangeAlertsCount = thresholds.filter(t => t.currentAlertLevel === 'NARANJA').length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Encabezado del Módulo SAT */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
              <BellRing className="w-5 h-5 animate-pulse" />
            </span>
            <h2 className="text-xl font-bold text-slate-100">
              Sistema de Alerta Temprana (SAT) & Protocolo CAP v1.2
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Plataforma de alerta temprana multisectorial (COER La Libertad, INDECI, ANA, SENAMHI). Difusión Cell Broadcast (SMS), sirenas acústicas 115dB y radio VHF.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <div className="px-3 py-1.5 bg-slate-900 rounded-lg text-center">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Umbrales Rojos</div>
            <div className="text-sm font-extrabold text-red-400 font-mono">{redAlertsCount}</div>
          </div>
          <div className="px-3 py-1.5 bg-slate-900 rounded-lg text-center">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Umbrales Naranjas</div>
            <div className="text-sm font-extrabold text-amber-400 font-mono">{orangeAlertsCount}</div>
          </div>
          <button
            onClick={() => setIsCreatingAlert(true)}
            className="px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            Emitir Alerta CAP
          </button>
        </div>
      </div>

      {/* Matriz de Umbrales de Disparo Hidro-Ecológicos */}
      <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Matriz de Umbrales de Disparo en Tiempo Real (Trigger Matrix)
            </h3>
            <p className="text-[11px] text-slate-400">
              Gradientes hidrológicos y químicos para activación de alertas automáticas.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">6 Puntos de Control SAT</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {thresholds.map(th => {
            const isRed = th.currentAlertLevel === 'ROJO';
            const isOrange = th.currentAlertLevel === 'NARANJA';
            const isYellow = th.currentAlertLevel === 'AMARILLO';

            return (
              <div
                key={th.id}
                className={`p-4 rounded-xl border transition-all ${
                  isRed
                    ? 'bg-red-950/30 border-red-500/40'
                    : isOrange
                    ? 'bg-amber-950/30 border-amber-500/40'
                    : isYellow
                    ? 'bg-yellow-950/20 border-yellow-500/30'
                    : 'bg-slate-950/80 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-mono">Km {th.stationKm} • {th.stationName}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                      isRed
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                        : isOrange
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : isYellow
                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    }`}
                  >
                    {th.currentAlertLevel}
                  </span>
                </div>

                <div className="font-bold text-xs text-slate-200 mt-2">{th.name}</div>

                <div className="flex items-baseline justify-between mt-3">
                  <div className="text-xl font-extrabold font-mono text-slate-100">
                    {th.currentValue} <span className="text-xs text-slate-400">{th.unit}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Límite Rojo: {th.redLimit} {th.unit}
                  </div>
                </div>

                {/* Barra de Umbral Visual */}
                <div className="w-full bg-slate-800 h-2 rounded-full mt-2 overflow-hidden flex">
                  <div className="bg-emerald-500 h-full" style={{ width: '35%' }} title="Verde" />
                  <div className="bg-yellow-500 h-full" style={{ width: '25%' }} title="Amarillo" />
                  <div className="bg-amber-500 h-full" style={{ width: '20%' }} title="Naranja" />
                  <div className="bg-red-500 h-full" style={{ width: '20%' }} title="Rojo" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Red de Sirenas Acústicas de Alta Potencia (115 dB) */}
      <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <TowerControl className="w-4 h-4 text-sky-400" />
              Red de Alerta Acústica de Evacuación Ribereña (Sirenas 115 dB)
            </h3>
            <p className="text-[11px] text-slate-400">
              Nodos de activación remota por radioenlace VHF y satélite para notificación directa a poblaciones sin cobertura móvil.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">5 Nodos Teledirigidos</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {sirens.map(s => {
            const isBlaring = s.state.includes('115dB');
            const isPreAlert = s.state.includes('Pre-Alerta');

            return (
              <div
                key={s.id}
                className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                  isBlaring
                    ? 'bg-red-950/40 border-red-500/50 shadow-lg shadow-red-500/10'
                    : isPreAlert
                    ? 'bg-amber-950/30 border-amber-500/40'
                    : 'bg-slate-950/80 border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>Km {s.locationKm}</span>
                    <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                      <Wifi className="w-3 h-3" />
                      {s.telemetryLink.split(' ')[0]}
                    </span>
                  </div>

                  <div className="font-bold text-xs text-slate-200 mt-1">{s.name}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{s.zone}</div>

                  <div className="mt-2 text-[11px] font-mono text-slate-300">
                    Pob. Cobertura: <strong className="text-sky-400">{s.populationCovered.toLocaleString()} hab</strong>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/80">
                  <div className="text-[10px] font-mono mb-2 flex items-center justify-between">
                    <span className="text-slate-500">Estado:</span>
                    <span
                      className={`font-bold ${
                        isBlaring ? 'text-red-400 animate-pulse' : isPreAlert ? 'text-amber-400' : 'text-slate-400'
                      }`}
                    >
                      {s.state.split(' ')[0]}
                    </span>
                  </div>

                  <button
                    onClick={() => handleToggleSirenState(s.id)}
                    className={`w-full py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                      isBlaring
                        ? 'bg-red-600 hover:bg-red-500 text-white'
                        : isPreAlert
                        ? 'bg-amber-600 hover:bg-amber-500 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    {isBlaring ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    {isBlaring ? 'Silenciar Sirena' : 'Activar Alarma Sonora'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Visor y Emisor de Boletines CAP v1.2 (OASIS) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Historial de Boletines CAP */}
        <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Share2 className="w-4 h-4 text-blue-400" />
              Boletines CAP Emitidos
            </h3>
            <span className="text-xs text-slate-400 font-mono">{capAlerts.length} Registros</span>
          </div>

          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {capAlerts.map(alert => (
              <div
                key={alert.identifier}
                onClick={() => setSelectedAlert(alert)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedAlert?.identifier === alert.identifier
                    ? 'bg-blue-950/40 border-blue-500/50'
                    : 'bg-slate-950/80 border-slate-800 hover:bg-slate-850'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>{alert.identifier}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded font-bold uppercase ${
                      alert.severity === 'Extreme'
                        ? 'bg-red-500/20 text-red-400'
                        : alert.severity === 'Severe'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}
                  >
                    {alert.severity}
                  </span>
                </div>
                <div className="font-bold text-xs text-slate-200 mt-1 line-clamp-1">{alert.headline}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{alert.areaDesc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Detalle del Boletín CAP Seleccionado */}
        <div className="lg:col-span-2 bg-slate-900/90 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
          {selectedAlert ? (
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Boletín Oficial de Emergencia</span>
                  <h3 className="text-base font-bold text-slate-100">{selectedAlert.headline}</h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCapXmlView(!capXmlView)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 border border-slate-700"
                  >
                    <FileCode2 className="w-3.5 h-3.5 text-sky-400" />
                    {capXmlView ? 'Ver Formato Humano' : 'Ver Estándar CAP-XML'}
                  </button>
                </div>
              </div>

              {capXmlView ? (
                <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-[300px]">
                  {generateCAPXML(selectedAlert)}
                </pre>
              ) : (
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase">Severidad</div>
                      <div className="text-xs font-bold text-red-400 mt-0.5">{selectedAlert.severity}</div>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase">Urgencia</div>
                      <div className="text-xs font-bold text-amber-400 mt-0.5">{selectedAlert.urgency}</div>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase">Certeza</div>
                      <div className="text-xs font-bold text-emerald-400 mt-0.5">{selectedAlert.certainty}</div>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase">Población Meta</div>
                      <div className="text-xs font-bold text-sky-400 mt-0.5">{selectedAlert.targetPopulation.toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Descripción de la Amenaza:</div>
                      <p className="text-slate-300 mt-0.5">{selectedAlert.description}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-900">
                      <div className="text-[10px] text-emerald-400 font-bold uppercase">Instrucciones de Protección a la Población:</div>
                      <p className="text-emerald-300 font-medium mt-0.5">{selectedAlert.instruction}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-900">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Zona de Cobertura Georreferenciada:</div>
                      <p className="text-slate-300 font-mono text-[11px] mt-0.5">{selectedAlert.areaDesc}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Canales Despachados:</span>
                    {selectedAlert.disseminationChannels.map((ch, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-slate-800 text-sky-300 text-[10px] font-mono border border-slate-700">
                        {ch}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-slate-500 py-12">Selecciona un boletín CAP para inspeccionar.</div>
          )}
        </div>
      </div>

      {/* Modal / Panel de Nueva Emisión CAP */}
      {isCreatingAlert && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl w-full space-y-4 shadow-2xl animate-fadeIn max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-red-400" />
                <h3 className="text-base font-bold text-slate-100">Nueva Emisión de Alerta CAP v1.2</h3>
              </div>
              <button
                onClick={() => setIsCreatingAlert(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-mono"
              >
                ✕ Cerrar
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Titular de Alerta (Headline):</label>
                <input
                  type="text"
                  value={newHeadline}
                  onChange={e => setNewHeadline(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Evento Hidro-Ecológico:</label>
                  <input
                    type="text"
                    value={newEvent}
                    onChange={e => setNewEvent(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Nivel de Severidad:</label>
                  <select
                    value={newSeverity}
                    onChange={e => setNewSeverity(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100"
                  >
                    <option value="Extreme">Extreme (Rojo - Catastrófico)</option>
                    <option value="Severe">Severe (Naranja - Severo)</option>
                    <option value="Moderate">Moderate (Amarillo - Moderado)</option>
                    <option value="Minor">Minor (Menor)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Área de Afectación / Cobertura:</label>
                <input
                  type="text"
                  value={newArea}
                  onChange={e => setNewArea(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Descripción Técnica del Evento:</label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Instrucciones a la Población & COER:</label>
                <textarea
                  rows={2}
                  value={newInstruction}
                  onChange={e => setNewInstruction(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Población Objetivo Estimada:</label>
                <input
                  type="number"
                  value={targetPop}
                  onChange={e => setTargetPop(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsCreatingAlert(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleBroadcastAlert}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold shadow-lg flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Difundir Alerta Multi-Canal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
