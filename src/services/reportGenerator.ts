/**
 * ReportGenerator - Generación de Reportes en PDF, Excel (.xlsx) y Word (.docx)
 * Reportes institucionales de auditoría de calidad de agua, caudales ecológicos y asimilación EnKF.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, HeadingLevel, AlignmentType, WidthType } from 'docx';
import { MonitoringStation, HydroSimulationResult, EcologicalFlowBenchmark } from '../types';

export interface ReportContext {
  basinName: string;
  generatedBy: string;
  role: string;
  date: string;
  stations: MonitoringStation[];
  simulationResult: HydroSimulationResult;
  eflowBenchmarks: EcologicalFlowBenchmark[];
}

/**
 * 1. Generación y descarga de Reporte Institucional en PDF
 */
export function generatePDFReport(ctx: ReportContext): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Colores institucionales
  const primaryColor = [15, 76, 129]; // Azul Hidrológico
  const secondaryColor = [5, 150, 105]; // Verde Ecológico

  // Encabezado
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 25, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('GEMELO DIGITAL HIDROLÓGICO-ECOLÓGICO', 14, 12);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Informe Técnico Oficial — ${ctx.basinName}`, 14, 18);
  doc.text(`Fecha: ${ctx.date}`, 160, 18);

  // Metadatos
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('1. RESUMEN EJECUTIVO DE ESTADO DE CUENCA', 14, 34);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `El presente informe consolida la asimilación de datos IoT y satelitales en tiempo real para la Cuenca del Río Moche (Perú), evaluando la calidad del agua según ECA-Agua (D.S. N° 004-2017-MINAM) y el cumplimiento de caudales ecológicos mediante el filtro Ensemble Kalman Filter (EnKF) y el modelo hidrológico GR4J.`,
    14,
    40,
    { maxWidth: 182, align: 'justify' }
  );

  // Tabla de KPIs de Asimilación
  const mPrior = ctx.simulationResult.metricsPrior;
  const mPost = ctx.simulationResult.metricsPosterior;

  autoTable(doc, {
    startY: 55,
    head: [['Métrica de Desempeño', 'Modelo A Priori (Sin Asimilación)', 'Modelo A Posteriori (Con EnKF)', 'Mejora Relativa']],
    body: [
      ['Nash-Sutcliffe Efficiency (NSE)', mPrior.nse.toString(), mPost.nse.toString(), `${((mPost.nse - mPrior.nse) * 100).toFixed(1)}%`],
      ['Kling-Gupta Efficiency (KGE)', mPrior.kge.toString(), mPost.kge.toString(), `${((mPost.kge - mPrior.kge) * 100).toFixed(1)}%`],
      ['Root Mean Square Error (RMSE)', `${mPrior.rmse} m³/s`, `${mPost.rmse} m³/s`, `-${(((mPrior.rmse - mPost.rmse) / mPrior.rmse) * 100).toFixed(1)}%`],
      ['Percent Bias (PBIAS)', `${mPrior.pbias}%`, `${mPost.pbias}%`, 'Sesgo Reducido'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 76, 129], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8.5 },
  });

  // Sección 2: Estado de Estaciones y Calidad de Agua
  const currentY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('2. MONITOREO DE CALIDAD DE AGUA Y TELEMETRÍA IoT', 14, currentY);

  const stationsData = ctx.stations.map(st => [
    st.code,
    st.name,
    st.subbasin.replace('Cuenca ', ''),
    `${st.currentValues.discharge.toFixed(2)} m³/s`,
    `${st.currentValues.wqi.toFixed(1)}/100`,
    st.currentValues.do.toFixed(1),
    st.currentValues.ph.toFixed(1),
    st.currentValues.nitrates.toFixed(1),
    st.ecaCompliance.isCompliant ? 'CUMPLE' : 'ALERTA',
  ]);

  autoTable(doc, {
    startY: currentY + 4,
    head: [['Código', 'Estación', 'Subcuenca', 'Q (m³/s)', 'ICA/WQI', 'OD (mg/L)', 'pH', 'NO3 (mg/L)', 'ECA-Agua']],
    body: stationsData,
    theme: 'striped',
    headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontSize: 8.5 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });

  // Sección 3: Caudales Ecológicos
  const eflowY = (doc as any).lastAutoTable.finalY + 10;
  if (eflowY > 230) {
    doc.addPage();
  }

  const finalEflowY = eflowY > 230 ? 20 : eflowY;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('3. EVALUACIÓN DE CAUDALES ECOLÓGICOS (MÉTODO TENNANT / Q95)', 14, finalEflowY);

  const eflowTableData = ctx.eflowBenchmarks.map(ef => [
    ef.stationName,
    `${ef.meanAnnualFlow} m³/s`,
    `${ef.monthlyRequirements[0].tennantMin} m³/s`,
    `${ef.monthlyRequirements[0].q95} m³/s`,
    `${ef.monthlyRequirements[0].wettedPerimeterCriticalQ} m³/s`,
    ef.currentEcologicalStatus,
  ]);

  autoTable(doc, {
    startY: finalEflowY + 4,
    head: [['Estación de Control', 'Caudal Medio (MAF)', 'Tennant Mínimo', 'Q95 Excedencia', 'Perímetro Mojado', 'Estado Actual']],
    body: eflowTableData,
    theme: 'grid',
    headStyles: { fillColor: [15, 76, 129], fontSize: 8.5 },
    bodyStyles: { fontSize: 8 },
  });

  // Pie de página institucional
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(
      `Gemelo Digital de Cuenca — Generado por: ${ctx.generatedBy} (${ctx.role}) — Página ${i} de ${pageCount}`,
      14,
      288
    );
  }

  doc.save(`Reporte_Gemelo_Digital_Moche_${ctx.date.replace(/[\s:/]/g, '_')}.pdf`);
}

/**
 * 2. Generación y descarga de Reporte Completo en Excel (.xlsx)
 */
export function generateExcelReport(ctx: ReportContext): void {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Resumen General
  const resumenData = [
    ['REPORTE TÉCNICO OFICIAL - GEMELO DIGITAL DE CUENCA'],
    ['Cuenca:', ctx.basinName],
    ['Generado por:', ctx.generatedBy],
    ['Rol:', ctx.role],
    ['Fecha de Emisión:', ctx.date],
    [],
    ['MÉTRICAS DE ASIMILACIÓN EnKF', 'A PRIORI (Sin EnKF)', 'A POSTERIORI (Con EnKF)'],
    ['NSE (Nash-Sutcliffe)', ctx.simulationResult.metricsPrior.nse, ctx.simulationResult.metricsPosterior.nse],
    ['KGE (Kling-Gupta)', ctx.simulationResult.metricsPrior.kge, ctx.simulationResult.metricsPosterior.kge],
    ['RMSE (m³/s)', ctx.simulationResult.metricsPrior.rmse, ctx.simulationResult.metricsPosterior.rmse],
    ['PBIAS (%)', ctx.simulationResult.metricsPrior.pbias, ctx.simulationResult.metricsPosterior.pbias],
    ['MAE (m³/s)', ctx.simulationResult.metricsPrior.mae, ctx.simulationResult.metricsPosterior.mae],
  ];
  const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen Ejecutivo');

  // Hoja 2: Telemetría y Calidad de Agua
  const estacionesHeader = [
    'Código',
    'Estación',
    'Subcuenca',
    'Latitud',
    'Longitud',
    'Altitud (msnm)',
    'Caudal Q (m3/s)',
    'Nivel H (m)',
    'ICA/WQI',
    'OD (mg/L)',
    'pH',
    'Conductividad (uS/cm)',
    'Turbidez (NTU)',
    'SST (mg/L)',
    'Nitratos (mg/L)',
    'Fósforo Total (mg/L)',
    'Coliformes (NMP/100mL)',
    'Plomo Pb (mg/L)',
    'Cumplimiento ECA-Agua',
  ];

  const estacionesRows = ctx.stations.map(st => [
    st.code,
    st.name,
    st.subbasin,
    st.coordinates.lat,
    st.coordinates.lng,
    st.coordinates.elevation,
    st.currentValues.discharge,
    st.currentValues.stage,
    st.currentValues.wqi,
    st.currentValues.do,
    st.currentValues.ph,
    st.currentValues.ec,
    st.currentValues.turbidity,
    st.currentValues.tss,
    st.currentValues.nitrates,
    st.currentValues.total_p,
    st.currentValues.fecal_coliforms,
    st.currentValues.heavy_metals_lead,
    st.ecaCompliance.isCompliant ? 'CUMPLE' : 'ALERTA',
  ]);

  const wsEstaciones = XLSX.utils.aoa_to_sheet([estacionesHeader, ...estacionesRows]);
  XLSX.utils.book_append_sheet(wb, wsEstaciones, 'Telemetría IoT');

  // Hoja 3: Asimilación EnKF Serie de Tiempo
  const seriesHeader = [
    'Fecha',
    'Precipitación (mm/día)',
    'ETP (mm/día)',
    'Q Observado (m3/s)',
    'Q Simulado Prior (m3/s)',
    'Q Asimilado EnKF (m3/s)',
    'Percentil P10 (m3/s)',
    'Percentil P50 (m3/s)',
    'Percentil P90 (m3/s)',
  ];

  const seriesRows = ctx.simulationResult.timestamps.map((t, i) => [
    t,
    ctx.simulationResult.precipitation[i],
    ctx.simulationResult.evapotranspiration[i],
    ctx.simulationResult.observedDischarge[i],
    ctx.simulationResult.simulatedPriorDischarge[i],
    ctx.simulationResult.simulatedPosteriorDischarge[i],
    ctx.simulationResult.boundsP10[i],
    ctx.simulationResult.boundsP50[i],
    ctx.simulationResult.boundsP90[i],
  ]);

  const wsSeries = XLSX.utils.aoa_to_sheet([seriesHeader, ...seriesRows]);
  XLSX.utils.book_append_sheet(wb, wsSeries, 'Serie Asimilación EnKF');

  XLSX.writeFile(wb, `Reporte_Gemelo_Digital_Moche_${ctx.date.replace(/[\s:/]/g, '_')}.xlsx`);
}

/**
 * 3. Generación y descarga de Reporte en Word (.docx)
 */
export async function generateDocxReport(ctx: ReportContext): Promise<void> {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: 'GEMELO DIGITAL HIDROLÓGICO-ECOLÓGICO DE CUENCA',
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: `Informe de Auditoría y Estado Ambiental: ${ctx.basinName}`,
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: `Fecha de emisión: ${ctx.date} | Generado por: ${ctx.generatedBy} (${ctx.role})`,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            text: '1. Resumen Ejecutivo y Métricas de Asimilación',
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            text: `La plataforma de Gemelo Digital ha ejecutado el ciclo de asimilación secuencial de datos mediante Ensemble Kalman Filter (EnKF) acoplado al modelo GR4J. Los resultados demuestran una mejora sustancial en la precisión predictiva de caudales y calidad del agua.`,
          }),
          new Paragraph({ text: '' }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Métrica')] }),
                  new TableCell({ children: [new Paragraph('Modelo A Priori')] }),
                  new TableCell({ children: [new Paragraph('Modelo EnKF (A Posteriori)')] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('NSE (Nash-Sutcliffe)')] }),
                  new TableCell({ children: [new Paragraph(ctx.simulationResult.metricsPrior.nse.toString())] }),
                  new TableCell({ children: [new Paragraph(ctx.simulationResult.metricsPosterior.nse.toString())] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('KGE (Kling-Gupta)')] }),
                  new TableCell({ children: [new Paragraph(ctx.simulationResult.metricsPrior.kge.toString())] }),
                  new TableCell({ children: [new Paragraph(ctx.simulationResult.metricsPosterior.kge.toString())] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('RMSE (m³/s)')] }),
                  new TableCell({ children: [new Paragraph(ctx.simulationResult.metricsPrior.rmse.toString())] }),
                  new TableCell({ children: [new Paragraph(ctx.simulationResult.metricsPosterior.rmse.toString())] }),
                ],
              }),
            ],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            text: '2. Monitoreo de Estaciones y Calidad de Agua',
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            text: `Se procesaron las 12 estaciones de monitoreo telemétrico IoT en tiempo real. Los valores se compararon contra los Estándares de Calidad Ambiental para Agua (D.S. N° 004-2017-MINAM).`,
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Reporte_Gemelo_Digital_Moche_${ctx.date.replace(/[\s:/]/g, '_')}.docx`;
  link.click();
}
