/**
 * AICopilotPanel.tsx - Copiloto Hidro-Ecológico Avanzado con IA (Gemini 3.7 Flash)
 * Multi-Especialista, Acciones Ejecutables en el Gemelo Digital, Dictado por Voz y Generador Legal.
 */

import React, { useState, useRef, useEffect } from 'react';
import { AICopilotMessage, MonitoringStation, UserProfile, CopilotSpecialistMode, ExecutableAction } from '../types';
import {
  Sparkles,
  Send,
  Bot,
  User,
  ShieldAlert,
  Sliders,
  FileCheck2,
  AlertOctagon,
  CheckCircle2,
  RefreshCw,
  Zap,
  Info,
  ChevronRight,
  Compass,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  FileText,
  Download,
  Copy,
  Check,
  ExternalLink,
  BookOpen,
  Activity,
  Layers,
  Scale,
  Flame,
  Waves,
  Droplets,
  HelpCircle,
  X,
} from 'lucide-react';
import { useI18n } from '../providers/I18nProvider';

interface AICopilotPanelProps {
  currentUser: UserProfile;
  stations: MonitoringStation[];
  onNavigateTab?: (tab: string) => void;
}

export const AICopilotPanel: React.FC<AICopilotPanelProps> = ({ currentUser, stations, onNavigateTab }) => {
  const { t, locale } = useI18n();

  const [specialistMode, setSpecialistMode] = useState<CopilotSpecialistMode>('general');
  const [messages, setMessages] = useState<AICopilotMessage[]>([
    {
      id: 'msg-0',
      role: 'assistant',
      content: `${t('copilot.welcome.greeting')} **${currentUser.name}**. ${t('copilot.welcome.intro')}

${t('copilot.welcome.capabilities')}

${t('copilot.welcome.cta')}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      specialistMode: 'general',
      executableActions: [
        {
          id: 'act-start-3d',
          label: t('copilot.action.explore3d'),
          actionType: 'navigate_tab',
          targetTab: '3d_twin',
        },
        {
          id: 'act-start-metals',
          label: t('copilot.action.metals'),
          actionType: 'navigate_tab',
          targetTab: 'heavy_metals',
        },
      ],
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeakingId, setIsSpeakingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showResolutionModal, setShowResolutionModal] = useState<boolean>(false);
  const [resolutionType, setResolutionType] = useState<string>('Resolución Directoral');
  const [resolutionEntity, setResolutionEntity] = useState<string>('Autoridad Nacional del Agua (ANA)');
  const [resolutionCase, setResolutionCase] = useState<string>(t('copilot.doc.case.default'));
  const [generatedResolutionText, setGeneratedResolutionText] = useState<string>('');
  const [isGeneratingDoc, setIsGeneratingDoc] = useState<boolean>(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const speechRecognitionRef = useRef<any>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Inicializar Web Speech Recognition si está disponible en el navegador
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      // La voz sigue al idioma de la interfaz: dictar en inglés con el reconocedor
      // fijado a es-PE producía transcripciones basura.
      recognition.lang = locale === 'en' ? 'en-US' : 'es-PE';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputPrompt(prev => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      speechRecognitionRef.current = recognition;
    }
  }, []);

  const toggleVoiceInput = () => {
    if (!speechRecognitionRef.current) {
      alert(t('copilot.voice.unsupported'));
      return;
    }

    if (isListening) {
      speechRecognitionRef.current.stop();
      setIsListening(false);
    } else {
      speechRecognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleSpeakText = (msgId: string, text: string) => {
    if (!('speechSynthesis' in window)) return;

    if (isSpeakingId === msgId) {
      window.speechSynthesis.cancel();
      setIsSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    // Limpiar markdown básico para locución natural
    const cleanText = text.replace(/[*#_`$]/g, '').replace(/\[.*?\]\(.*?\)/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = locale === 'en' ? 'en-US' : 'es-ES';
    utterance.rate = 1.05;

    utterance.onend = () => setIsSpeakingId(null);
    utterance.onerror = () => setIsSpeakingId(null);

    setIsSpeakingId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const handleCopyText = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Especialistas disponibles
  const specialistOptions = [
    {
      id: 'general' as CopilotSpecialistMode,
      name: t('copilot.spec.general.name'),
      icon: Sparkles,
      color: 'from-blue-600 to-indigo-600',
      tag: t('copilot.spec.general.tag'),
      description: t('copilot.spec.general.desc'),
    },
    {
      id: 'water_quality_dam' as CopilotSpecialistMode,
      name: t('copilot.spec.dam.name'),
      icon: Flame,
      color: 'from-amber-600 to-red-600',
      tag: t('copilot.spec.dam.tag'),
      description: t('copilot.spec.dam.desc'),
    },
    {
      id: 'flood_hydraulics' as CopilotSpecialistMode,
      name: t('copilot.spec.flood.name'),
      icon: Waves,
      color: 'from-cyan-600 to-blue-700',
      tag: t('copilot.spec.flood.tag'),
      description: t('copilot.spec.flood.desc'),
    },
    {
      id: 'regulatory_legal' as CopilotSpecialistMode,
      name: t('copilot.spec.legal.name'),
      icon: Scale,
      color: 'from-emerald-600 to-teal-700',
      tag: t('copilot.spec.legal.tag'),
      description: t('copilot.spec.legal.desc'),
    },
    {
      id: 'scada_allocation' as CopilotSpecialistMode,
      name: t('copilot.spec.scada.name'),
      icon: Droplets,
      color: 'from-purple-600 to-pink-600',
      tag: t('copilot.spec.scada.tag'),
      description: t('copilot.spec.scada.desc'),
    },
  ];

  // Consultas rápidas organizadas por especialidad
  const quickPromptsBySpecialist: Record<CopilotSpecialistMode, { label: string; prompt: string; icon: any }[]> = {
    general: [
      {
        label: t('copilot.qp.general.status.label'),
        prompt: t('copilot.qp.general.status.prompt'),
        icon: Activity,
      },
      {
        label: t('copilot.qp.general.demand.label'),
        prompt: t('copilot.qp.general.demand.prompt'),
        icon: Sliders,
      },
      {
        label: t('copilot.qp.general.calib.label'),
        prompt: t('copilot.qp.general.calib.prompt'),
        icon: FileCheck2,
      },
    ],
    water_quality_dam: [
      {
        label: t('copilot.qp.dam.lead.label'),
        prompt: t('copilot.qp.dam.lead.prompt'),
        icon: AlertOctagon,
      },
      {
        label: t('copilot.qp.dam.transit.label'),
        prompt: t('copilot.qp.dam.transit.prompt'),
        icon: Zap,
      },
      {
        label: t('copilot.qp.dam.tmdl.label'),
        prompt: t('copilot.qp.dam.tmdl.prompt'),
        icon: Layers,
      },
    ],
    flood_hydraulics: [
      {
        label: t('copilot.qp.flood.enso.label'),
        prompt: t('copilot.qp.flood.enso.prompt'),
        icon: ShieldAlert,
      },
      {
        label: t('copilot.qp.flood.dambreak.label'),
        prompt: t('copilot.qp.flood.dambreak.prompt'),
        icon: AlertOctagon,
      },
      {
        label: t('copilot.qp.flood.sirens.label'),
        prompt: t('copilot.qp.flood.sirens.prompt'),
        icon: Volume2,
      },
    ],
    regulatory_legal: [
      {
        label: t('copilot.qp.legal.opinion.label'),
        prompt: t('copilot.qp.legal.opinion.prompt'),
        icon: FileText,
      },
      {
        label: t('copilot.qp.legal.pas.label'),
        prompt: t('copilot.qp.legal.pas.prompt'),
        icon: Scale,
      },
      {
        label: t('copilot.qp.legal.ban.label'),
        prompt: t('copilot.qp.legal.ban.prompt'),
        icon: BookOpen,
      },
    ],
    scada_allocation: [
      {
        label: t('copilot.qp.scada.intake.label'),
        prompt: t('copilot.qp.scada.intake.prompt'),
        icon: Sliders,
      },
      {
        label: t('copilot.qp.scada.aquifer.label'),
        prompt: t('copilot.qp.scada.aquifer.prompt'),
        icon: Droplets,
      },
      {
        label: t('copilot.qp.scada.gates.label'),
        prompt: t('copilot.qp.scada.gates.prompt'),
        icon: Zap,
      },
    ],
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputPrompt.trim();
    if (!textToSend || isLoading) return;

    const userMessage: AICopilotMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      specialistMode,
    };

    setMessages(prev => [...prev, userMessage]);
    if (!customPrompt) setInputPrompt('');
    setIsLoading(true);

    try {
      // Contexto telemétrico e hidrológico actual para alimentar a Gemini
      const meanDischarge = (stations.reduce((acc, s) => acc + s.currentValues.discharge, 0) / stations.length).toFixed(2);
      const meanWQI = (stations.reduce((acc, s) => acc + s.currentValues.wqi, 0) / stations.length).toFixed(1);
      const alertsCount = stations.filter(s => !s.ecaCompliance.isCompliant).length;

      const response = await fetch('/api/gemini/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToSend,
          specialistMode,
          context: {
            currentDischarge: meanDischarge,
            meanWQI,
            ecaAlertsCount: alertsCount,
            waterStress: 'Estrés Moderado',
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();

      const assistantMessage: AICopilotMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        actionProtocol: data.actionProtocol,
        executableActions: data.executableActions,
        citations: data.citations,
        specialistMode,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error comunicando con el copiloto:', error);
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: t('copilot.error.request'),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          specialistMode,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateResolutionDoc = async () => {
    setIsGeneratingDoc(true);
    try {
      const res = await fetch('/api/gemini/generate-resolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: resolutionType,
          entity: resolutionEntity,
          caseDetails: resolutionCase,
        }),
      });
      const data = await res.json();
      setGeneratedResolutionText(data.documentText || t('copilot.doc.error.generate'));
    } catch (err) {
      console.error(err);
      setGeneratedResolutionText(t('copilot.doc.error.server'));
    } finally {
      setIsGeneratingDoc(false);
    }
  };

  const handleExportChatMarkdown = () => {
    const text = messages
      .map(
        m =>
          `### ${m.role === 'user' ? `👤 ${t('copilot.export.user')}` : `🤖 ${t('copilot.export.assistant')}`} (${m.timestamp})\n\n${m.content}\n\n---\n`
      )
      .join('\n');

    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Copiloto_Moche_Sesion_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentSpecialist = specialistOptions.find(s => s.id === specialistMode) || specialistOptions[0];

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* 1. Encabezado y Selector de Especialistas */}
      <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl bg-gradient-to-tr ${currentSpecialist.color} text-white shadow-lg`}>
              <currentSpecialist.icon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100">{currentSpecialist.name}</h2>
                <span className="px-2 py-0.5 rounded-md bg-blue-950 text-blue-300 border border-blue-800/80 text-[10px] font-mono font-bold">
                  Gemini 3.7 Flash
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{currentSpecialist.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowResolutionModal(true)}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all shadow-sm"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              {t('copilot.btn.legalGenerator')}
            </button>

            <button
              onClick={handleExportChatMarkdown}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              {t('copilot.btn.exportSession')}
            </button>
          </div>
        </div>

        {/* Barra de Selección de Modo de Especialista */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-2 border-t border-slate-800">
          {specialistOptions.map(spec => {
            const Icon = spec.icon;
            const isSelected = specialistMode === spec.id;
            return (
              <button
                key={spec.id}
                onClick={() => setSpecialistMode(spec.id)}
                className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                  isSelected
                    ? 'bg-slate-800/90 border-blue-500 shadow-md ring-1 ring-blue-500/50'
                    : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/40 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`p-1.5 rounded-lg ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-[9px] font-mono text-slate-400 truncate max-w-[80px]">{spec.tag}</span>
                </div>
                <div className={`text-xs font-bold truncate ${isSelected ? 'text-slate-100' : 'text-slate-300'}`}>
                  {spec.name}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Barra de Contexto Telemétrico en Vivo Inyectado al Modelo */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300">
        <div className="flex items-center gap-2 text-sky-400 font-bold">
          <Activity className="w-3.5 h-3.5" />
          <span>{t('copilot.ctx.title')}:</span>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-slate-400">
          <span>
            {t('copilot.ctx.meanQ')}: <strong className="text-slate-200">6.45 m³/s</strong>
          </span>
          <span>
            {t('copilot.ctx.wqi')}: <strong className="text-emerald-400">68.4/100</strong>
          </span>
          <span>
            {t('copilot.ctx.ecaAlerts')}: <strong className="text-amber-400">2 {t('copilot.ctx.active')}</strong>
          </span>
          <span>
            {t('copilot.ctx.eflow')}: <strong className="text-sky-400">1.65 m³/s ({t('copilot.ctx.compliant')})</strong>
          </span>
          <span>
            {t('copilot.ctx.wedge')}: <strong className="text-purple-400">Km 4.1 {t('copilot.ctx.coastline')}</strong>
          </span>
        </div>
      </div>

      {/* 3. Sugerencias Rápidas de Consultas del Especialista Activo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {quickPromptsBySpecialist[specialistMode].map((qp, idx) => {
          const Icon = qp.icon;
          return (
            <button
              key={idx}
              onClick={() => handleSendMessage(qp.prompt)}
              disabled={isLoading}
              className="p-3 rounded-xl bg-slate-900/70 hover:bg-slate-850 border border-slate-800/80 text-left transition-all hover:border-slate-700 flex items-start gap-2.5 group"
            >
              <span className="p-1.5 rounded-lg bg-slate-800 text-sky-400 group-hover:text-white group-hover:bg-blue-600 transition-colors mt-0.5">
                <Icon className="w-3.5 h-3.5" />
              </span>
              <div className="flex-1">
                <div className="text-xs font-bold text-slate-200 group-hover:text-sky-300 transition-colors">
                  {qp.label}
                </div>
                <div className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                  {qp.prompt}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 4. Ventana Principal de Conversación */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 flex flex-col h-[580px] overflow-hidden shadow-xl">
        {/* Historial de Mensajes */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-sky-500 flex items-center justify-center text-white flex-shrink-0 shadow-md">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-4.5 text-xs leading-relaxed space-y-3 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white font-medium rounded-br-none shadow-md'
                    : 'bg-slate-950/95 text-slate-200 border border-slate-800 rounded-bl-none shadow-lg'
                }`}
              >
                {/* Cabecera del Mensaje del Asistente */}
                {msg.role === 'assistant' && (
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                    <span className="text-[11px] font-bold text-sky-400 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      Gemini 3.7 Flash — {t('copilot.msg.specialized')}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleSpeakText(msg.id, msg.content)}
                        title={t('copilot.msg.listen')}
                        className={`p-1 rounded-lg text-slate-400 hover:text-slate-200 transition-colors ${
                          isSpeakingId === msg.id ? 'text-emerald-400 bg-emerald-950' : ''
                        }`}
                      >
                        {isSpeakingId === msg.id ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleCopyText(msg.id, msg.content)}
                        title={t('copilot.msg.copy')}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Contenido en texto formateado con Markdown básico */}
                <div className="whitespace-pre-wrap space-y-2 text-slate-200">{msg.content}</div>

                {/* Tarjeta de Protocolo de Acción si existe */}
                {msg.actionProtocol && (
                  <div className="mt-3 pt-3 border-t border-slate-800 space-y-2.5 bg-slate-900/90 p-3.5 rounded-xl border border-slate-700/60">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-sky-300 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        {msg.actionProtocol.title}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          msg.actionProtocol.level === 'critical'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : msg.actionProtocol.level === 'warning'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                        }`}
                      >
                        {t('copilot.protocol.level')} {msg.actionProtocol.level}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">{t('copilot.protocol.steps')}:</div>
                      {msg.actionProtocol.steps.map((st, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-slate-300 text-[11px]">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                          <span>{st}</span>
                        </div>
                      ))}
                    </div>

                    {msg.actionProtocol.recommendedGateActions && (
                      <div className="space-y-1 pt-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">{t('copilot.protocol.gates')}:</div>
                        {msg.actionProtocol.recommendedGateActions.map((ga, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-amber-300 text-[11px]">
                            <ChevronRight className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                            <span>{ga}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Botones de Acciones Ejecutables en el Gemelo Digital */}
                {msg.executableActions && msg.executableActions.length > 0 && onNavigateTab && (
                  <div className="mt-3 pt-2.5 border-t border-slate-800">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-sky-400" />
                      {t('copilot.actions.title')}:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {msg.executableActions.map(act => (
                        <button
                          key={act.id}
                          onClick={() => act.targetTab && onNavigateTab(act.targetTab)}
                          className="px-3 py-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-500/50 text-[11px] font-bold transition-all flex items-center gap-1.5 shadow-sm"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>{act.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Citas y Fuentes Normativas */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="pt-2 text-[10px] text-slate-400 font-mono flex items-center gap-2 flex-wrap">
                    <span className="text-slate-400">{t('copilot.citations.label')}:</span>
                    {msg.citations.map((c, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                        {c}
                      </span>
                    ))}
                  </div>
                )}

                <div className="text-[10px] text-slate-400 mt-1 text-right">{msg.timestamp}</div>
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 flex-shrink-0 border border-slate-700">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 items-center text-xs text-slate-400">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-sky-500 flex items-center justify-center text-white animate-pulse">
                <Bot className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2.5 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
                <span>{t('copilot.loading')}</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Bar con Soporte de Voz */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
          <button
            onClick={toggleVoiceInput}
            title={isListening ? t('copilot.input.voice.stop') : t('copilot.input.voice.start')}
            className={`p-2.5 rounded-xl border transition-all flex items-center justify-center ${
              isListening
                ? 'bg-red-600 border-red-500 text-white animate-pulse shadow-lg shadow-red-500/30'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
            }`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <input
            type="text"
            value={inputPrompt}
            onChange={e => setInputPrompt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
            placeholder={
              isListening
                ? t('copilot.input.listening')
                : `${t('copilot.input.placeholder')} ${currentSpecialist.name.toLowerCase()}...`
            }
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />

          <button
            onClick={() => handleSendMessage()}
            disabled={!inputPrompt.trim() || isLoading}
            className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all shadow-md flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modal de Generador de Resoluciones y Actas Legales con IA */}
      {showResolutionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scaleIn">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  {t('copilot.doc.title')}
                </h3>
              </div>
              <button
                onClick={() => setShowResolutionModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">{t('copilot.doc.type.label')}</label>
                  <select
                    value={resolutionType}
                    onChange={e => setResolutionType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Resolución Directoral">{t('copilot.doc.type.directoral')}</option>
                    <option value="Dictamen Técnico Legal">{t('copilot.doc.type.opinion')}</option>
                    <option value="Notificación de Veda Temporal">{t('copilot.doc.type.ban')}</option>
                    <option value="Acta de Fiscalización Ambiental">{t('copilot.doc.type.record')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">{t('copilot.doc.entity.label')}</label>
                  <select
                    value={resolutionEntity}
                    onChange={e => setResolutionEntity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Autoridad Nacional del Agua (ANA)">Autoridad Nacional del Agua (ANA)</option>
                    <option value="OEFA">Organismo de Evaluación y Fiscalización Ambiental (OEFA)</option>
                    <option value="ALA Moche-Virú-Chao">Administración Local del Agua (ALA Moche-Virú-Chao)</option>
                    <option value="COER La Libertad / INDECI">COER La Libertad / INDECI</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">{t('copilot.doc.case.label')}</label>
                <textarea
                  rows={3}
                  value={resolutionCase}
                  onChange={e => setResolutionCase(e.target.value)}
                  placeholder={t('copilot.doc.case.placeholder')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleGenerateResolutionDoc}
                  disabled={isGeneratingDoc}
                  className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md disabled:opacity-50"
                >
                  {isGeneratingDoc ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{t('copilot.doc.generating')}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{t('copilot.doc.generate')}</span>
                    </>
                  )}
                </button>
              </div>

              {generatedResolutionText && (
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400">{t('copilot.doc.result.label')}:</span>
                    <button
                      onClick={() => handleCopyText('resolution-doc', generatedResolutionText)}
                      className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{t('copilot.doc.copy')}</span>
                    </button>
                  </div>
                  <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                    {generatedResolutionText}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
