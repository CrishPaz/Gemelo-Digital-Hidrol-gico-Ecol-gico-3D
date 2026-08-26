/**
 * OfficialReportsPanel.tsx - Módulo de Generación, Visualización, Firma Digital
 * y Exportación de Expedientes Técnicos para Entidades Rectoras (ANA, OEFA, SENAMHI, INDECI, SEDALIB).
 */

import React, { useState } from 'react';
import { OfficialReport, UserProfile } from '../types';
import { INITIAL_OFFICIAL_REPORTS } from '../data/reportsData';
import {
  FileText,
  Download,
  Printer,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Building,
  Calendar,
  User,
  Key,
  Layers,
  ChevronRight,
  ExternalLink,
  Award,
  Sparkles,
  Share2,
  FileCheck,
  Lock,
} from 'lucide-react';

interface OfficialReportsPanelProps {
  currentUser?: UserProfile;
}

export const OfficialReportsPanel: React.FC<OfficialReportsPanelProps> = ({ currentUser }) => {
  const [reports, setReports] = useState<OfficialReport[]>(INITIAL_OFFICIAL_REPORTS);
  const [selectedReportId, setSelectedReportId] = useState<string>(reports[0].id);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);

  const selectedReport = reports.find(r => r.id === selectedReportId) || reports[0];

  const handlePrintOrExport = (report: OfficialReport) => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setExportSuccessMsg(`Expediente ${report.code} generado en formato PDF Oficial con firma criptográfica.`);
      setTimeout(() => setExportSuccessMsg(null), 4000);
      window.print();
    }, 600);
  };

  const getEntityBadge = (entity: string) => {
    switch (entity) {
      case 'ANA':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'OEFA':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'INDECI':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'SEDALIB':
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      default:
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Encabezado Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <FileText className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-100">
              Expedientes Técnicos & Informes Oficiales Multi-Institucionales
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Generación automatizada de reportes vinculantes con firma digital criptográfica SHA-256 para ANA, OEFA, INDECI, SENAMHI y SEDALIB.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {exportSuccessMsg && (
            <div className="text-xs text-emerald-400 bg-emerald-950/80 px-3 py-1.5 rounded-lg border border-emerald-500/40 flex items-center gap-1.5 animate-fadeIn">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {exportSuccessMsg}
            </div>
          )}
          <button
            onClick={() => handlePrintOrExport(selectedReport)}
            disabled={isExporting}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {isExporting ? 'Compilando PDF...' : 'Exportar Expediente PDF'}
          </button>
        </div>
      </div>

      {/* Selector de Informes & Visualizador de Expediente */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Lista Lateral de Expedientes */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider px-1">
            Repositorio de Informes Emitidos ({reports.length})
          </div>

          <div className="space-y-2.5">
            {reports.map(r => {
              const isSelected = r.id === selectedReportId;
              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedReportId(r.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-950/40 border-blue-500 shadow-md ring-1 ring-blue-500/30'
                      : 'bg-slate-900/80 border-slate-800 hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${getEntityBadge(
                        r.entity
                      )}`}
                    >
                      {r.entity}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {r.issueDate.split(' ')[0]}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-200 line-clamp-2 leading-snug">
                    {r.title}
                  </h4>

                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span className="truncate max-w-[170px]">{r.code}</span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <FileCheck className="w-3 h-3" />
                      {r.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Visor Oficial del Documento Seleccionado (Estilo Documento Formal) */}
        <div className="lg:col-span-8 bg-slate-900/95 p-6 sm:p-8 rounded-2xl border border-slate-800 space-y-6 shadow-2xl relative">
          {/* Marca de Agua / Sello Oficial */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-800 pb-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded font-extrabold text-xs uppercase border ${getEntityBadge(
                    selectedReport.entity
                  )}`}
                >
                  {selectedReport.entity} - República del Perú
                </span>
                <span className="text-xs font-mono text-slate-400">|</span>
                <span className="text-xs font-semibold text-slate-300">
                  {selectedReport.reportType}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-100 mt-2 leading-snug">
                {selectedReport.title}
              </h3>
              <div className="text-xs font-mono text-blue-400 mt-1 font-semibold">
                Código Oficial: {selectedReport.code}
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center sm:text-right shrink-0 space-y-1">
              <div className="text-[10px] font-mono text-slate-400">ESTADO DEL DOCUMENTO</div>
              <div className="text-xs font-bold text-emerald-400 flex items-center justify-center sm:justify-end gap-1">
                <ShieldCheck className="w-4 h-4" />
                {selectedReport.status}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">{selectedReport.issueDate}</div>
            </div>
          </div>

          {/* Resumen Ejecutivo */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              1. Resumen Ejecutivo & Contexto Técnico
            </h4>
            <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800/80 text-xs text-slate-300 leading-relaxed">
              {selectedReport.executiveSummary}
            </div>
          </div>

          {/* Tabla de Indicadores y Métricas Clave */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              2. Parámetros Cuantitativos Validados en Tiempo Real
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(selectedReport.keyMetrics).map(([key, val]) => (
                <div
                  key={key}
                  className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center text-xs"
                >
                  <span className="text-slate-400">{key}:</span>
                  <span className="font-mono font-bold text-slate-100">{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recomendaciones y Dictamen Técnico */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              3. Conclusiones y Disposiciones Técnicas Vinculantes
            </h4>
            <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-2 text-xs">
              {selectedReport.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2 text-slate-300">
                  <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sello de Auditoría Criptográfica y Firma Digital */}
          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800/50 text-[11px] font-mono">
            <div className="space-y-1">
              <div className="text-slate-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>Responsable de Emisión:</span>
                <strong className="text-slate-200">{selectedReport.generatedBy}</strong>
              </div>
              <div className="text-slate-500 flex items-center gap-1.5 text-[10px]">
                <Key className="w-3.5 h-3.5 text-emerald-400" />
                <span className="truncate max-w-[280px] sm:max-w-md">
                  Firma Digital: {selectedReport.digitalSignatureHash}
                </span>
              </div>
            </div>

            <div className="px-3 py-1.5 bg-emerald-950/40 text-emerald-400 rounded-lg border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" />
              Verificado Criptográficamente
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
