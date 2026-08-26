/**
 * ReportsAndAuditPanel - Generación y Descarga de Informes Técnicos Multi-Formato
 * y Visor de Expedientes Oficiales Institucionales (ANA, OEFA, INDECI, SEDALIB).
 */

import React, { useState } from 'react';
import { MonitoringStation, HydroSimulationResult, EcologicalFlowBenchmark, UserProfile, AuditLogEntry } from '../types';
import { generatePDFReport, generateExcelReport, generateDocxReport, ReportContext } from '../services/reportGenerator';
import { OfficialReportsPanel } from './OfficialReportsPanel';
import {
  FileText,
  Download,
  FileSpreadsheet,
  FileCode,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Sparkles,
  History,
  Building,
  Layers,
} from 'lucide-react';

interface ReportsAndAuditPanelProps {
  stations: MonitoringStation[];
  simulationResult: HydroSimulationResult;
  eflowBenchmarks: EcologicalFlowBenchmark[];
  currentUser: UserProfile;
  auditLogs: AuditLogEntry[];
}

export const ReportsAndAuditPanel: React.FC<ReportsAndAuditPanelProps> = ({
  stations,
  simulationResult,
  eflowBenchmarks,
  currentUser,
  auditLogs,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'official_dossiers' | 'export_generator' | 'audit_trail'>('official_dossiers');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportMessage, setExportMessage] = useState<string>('');

  const createReportContext = (): ReportContext => ({
    basinName: 'Cuenca del Río Moche (La Libertad, Perú)',
    generatedBy: currentUser.name,
    role: currentUser.role,
    date: new Date().toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    stations,
    simulationResult,
    eflowBenchmarks,
  });

  const handleExportPDF = () => {
    setIsExporting(true);
    setExportMessage('Compilando documento PDF con gráficos vectoriales...');
    setTimeout(() => {
      try {
        generatePDFReport(createReportContext());
        setExportMessage('¡Reporte PDF descargado con éxito!');
      } catch (err) {
        console.error(err);
        setExportMessage('Error al generar PDF');
      } finally {
        setTimeout(() => setIsExporting(false), 1500);
      }
    }, 400);
  };

  const handleExportExcel = () => {
    setIsExporting(true);
    setExportMessage('Estructurando libro Excel multi-pestaña (.xlsx)...');
    try {
      generateExcelReport(createReportContext());
      setExportMessage('¡Libro Excel descargado con éxito!');
    } catch (err) {
      console.error(err);
      setExportMessage('Error al generar Excel');
    } finally {
      setTimeout(() => setIsExporting(false), 1500);
    }
  };

  const handleExportDocx = async () => {
    setIsExporting(true);
    setExportMessage('Estructurando documento Word (.docx)...');
    try {
      await generateDocxReport(createReportContext());
      setExportMessage('¡Documento Word descargado con éxito!');
    } catch (err) {
      console.error(err);
      setExportMessage('Error al generar Word');
    } finally {
      setTimeout(() => setIsExporting(false), 1500);
    }
  };

  return (
    <div className="space-y-6">
      {/* Subnavegador de Informes & Auditoría */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 p-3 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('official_dossiers')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeSubTab === 'official_dossiers'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Building className="w-4 h-4" />
            Expedientes Oficiales (ANA / OEFA / INDECI)
          </button>

          <button
            onClick={() => setActiveSubTab('export_generator')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeSubTab === 'export_generator'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Download className="w-4 h-4" />
            Generador Rápido (PDF / Word / Excel)
          </button>

          <button
            onClick={() => setActiveSubTab('audit_trail')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeSubTab === 'audit_trail'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            Trazabilidad & Bitácora de Auditoría
          </button>
        </div>

        <div className="text-xs font-mono text-slate-400 hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-950 rounded-xl border border-slate-800">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Firma Digital SHA-256 Activa</span>
        </div>
      </div>

      {/* 1. Expedientes Técnicos Oficiales Multi-Institucionales */}
      {activeSubTab === 'official_dossiers' && (
        <OfficialReportsPanel currentUser={currentUser} />
      )}

      {/* 2. Generador Rápido Multi-Formato */}
      {activeSubTab === 'export_generator' && (
        <div className="p-6 bg-slate-900/90 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-md space-y-5 animate-fadeIn">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-400" />
              Generador de Documentos y Libros de Cálculo en Lote
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Exporta los datos completos del gemelo digital, calibración hidrológica e índices de calidad a los formatos estándar de ingeniería.
            </p>
          </div>

          {isExporting && (
            <div className="p-3 bg-blue-950/70 border border-blue-600/60 rounded-xl text-xs text-blue-200 flex items-center gap-2 animate-pulse">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span>{exportMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            {/* Opción PDF */}
            <div className="p-5 bg-slate-950 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-all">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-xs text-slate-200">INFORME TÉCNICO PDF</span>
                  <span className="p-1.5 rounded bg-red-950 text-red-400 border border-red-800 text-[10px] font-bold">
                    PDF
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  Memoria ejecutiva institucional con membrete, tabla de asimilación EnKF, calidad ECA-Agua y anexos.
                </p>
              </div>
              <button
                onClick={handleExportPDF}
                disabled={isExporting}
                className="w-full py-2.5 bg-red-700 hover:bg-red-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar Informe PDF
              </button>
            </div>

            {/* Opción Excel */}
            <div className="p-5 bg-slate-950 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-all">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-xs text-slate-200">BASE DE DATOS EXCEL</span>
                  <span className="p-1.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                    XLSX
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  Libro multi-hoja con series temporales horarias, parámetros de calidad, caudales observados vs simulados.
                </p>
              </div>
              <button
                onClick={handleExportExcel}
                disabled={isExporting}
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Descargar Libro Excel
              </button>
            </div>

            {/* Opción Word */}
            <div className="p-5 bg-slate-950 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-all">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-xs text-slate-200">MEMORIA TÉCNICA WORD</span>
                  <span className="p-1.5 rounded bg-blue-950 text-blue-400 border border-blue-800 text-[10px] font-bold">
                    DOCX
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  Plantilla formal editable para elaboración de informes de fiscalización y auditoría ambiental.
                </p>
              </div>
              <button
                onClick={handleExportDocx}
                disabled={isExporting}
                className="w-full py-2.5 bg-blue-700 hover:bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50"
              >
                <FileCode className="w-3.5 h-3.5" />
                Descargar Documento Word
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Bitácora de Auditoría Inmutable (Audit Trail) */}
      {activeSubTab === 'audit_trail' && (
        <div className="p-6 bg-slate-900/90 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-md space-y-4 animate-fadeIn">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <History className="w-4 h-4 text-slate-400" />
                Bitácora de Auditoría del Sistema (Trazabilidad y MLOps)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Registro inmutable de todas las acciones operativas, cambios en compuertas y calibraciones.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400 px-3 py-1 bg-slate-950 rounded-lg border border-slate-800">
              Total registros: {auditLogs.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Usuario</th>
                  <th className="py-2.5 px-3">Rol</th>
                  <th className="py-2.5 px-3">Módulo</th>
                  <th className="py-2.5 px-3">Acción Ejecutada</th>
                  <th className="py-2.5 px-3">Detalles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 text-slate-400">{log.timestamp}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-200">{log.userName}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                        {log.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-sky-400">{log.module}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-200">{log.action}</td>
                    <td className="py-2.5 px-3 text-slate-400 font-sans">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
