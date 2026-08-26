/**
 * reportsData.ts - Plantillas y expedientes oficiales para entidades rectoras
 * (ANA, OEFA, SENAMHI, INDECI, SEDALIB).
 */

import { OfficialReport } from '../types';

export const INITIAL_OFFICIAL_REPORTS: OfficialReport[] = [
  {
    id: 'rep-ana-01',
    code: 'EXP-ANA-AAA-HARM-2026-089',
    entity: 'ANA',
    title: 'Informe Técnico Hidrológico: Balance Hídrico, Calibración SCE-UA y Disponibilidad en Cuenca Moche',
    reportType: 'Auditoría Hidrológica',
    issueDate: '2026-08-26 13:30',
    generatedBy: 'Ing. Supervisor Hidráulico (CIP 184592) - Gemelo Digital Moche',
    digitalSignatureHash: 'SHA256: 4f8b9e1a2c3d5e7f0b2a4c6e8d0f1a3b5c7e9f2a4b6c8d0e1f3a5b7c9e1d3f5a',
    status: 'Emitido Oficialmente',
    executiveSummary: 'Se presenta la consolidación del balance hídrico mensual en la cuenca del Río Moche, con un rendimiento de auto-calibración SCE-UA de NSE=0.912 y KGE=0.884. El caudal disponible en Laredo asciende a 14.8 m³/s con un régimen de asignación regulada para las comisiones de regantes de La Mochica y Menocucho.',
    keyMetrics: {
      'Caudal Medio Aforado': '14.8 m³/s',
      'Eficiencia Nash-Sutcliffe': '0.912 (Excelente)',
      'Sesgo de Volumen (PBIAS)': '+2.1%',
      'Caudal Ecológico Cumplido': '100% (2.10 m³/s garantizado)',
      'Volumen Asignado Riego': '24.5 Hm³/mes',
    },
    recommendations: [
      'Mantener la apertura de compuerta en Bocatoma Menocucho a 1.45 m para respetar la reserva ambiental.',
      'Actualizar la curva de calibración de gasto H-Q en la estación Quiruvilca ante arrastre de sedimentos.',
      'Coordinar con la Junta de Usuarios de la Cuenca del Río Moche el rol de turnos para el sector Laredo-Poroto.',
    ],
  },
  {
    id: 'rep-oefa-02',
    code: 'INF-OEFA-DS-CALIDAD-2026-042',
    entity: 'OEFA',
    title: 'Informe de Fiscalización Ambiental: Transporte de Drenaje Ácido de Mina (DAM) y Metales Pesados',
    reportType: 'Cumplimiento ECA-Agua & Metales',
    issueDate: '2026-08-26 12:45',
    generatedBy: 'Dirección de Supervisión Ambiental & Fiscalización Minera',
    digitalSignatureHash: 'SHA256: 8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f',
    status: 'Aprobado & Sellado',
    executiveSummary: 'Evaluación telemétrica de calidad del agua en la subcuenca alta (río Shorey / cerro San José). Se constató pH 3.8 en cabecera con concentraciones de Arsénico (0.24 mg/L) y Plomo (0.18 mg/L) que exceden el ECA-Agua Categoría 3 (Riego de Vegetales). Se registra atenuación hidrogeoquímica progresiva hasta Menocucho.',
    keyMetrics: {
      'pH en Naciente (Shorey)': '3.8 (Ácido Extremo)',
      'Arsénico Total en Confluencia': '0.14 mg/L (Excede ECA 0.10)',
      'Plomo Total en Confluencia': '0.08 mg/L (Excede ECA 0.05)',
      'Tasa de Neutralización': '76.4% por aportes alcalinos del río Otuzco',
      'Riesgo Bioacumulación': 'Moderado-Alto en cultivos de tallo corto',
    },
    recommendations: [
      'Exigir a la unidad minera en cabecera el aumento de dosificación de cal en la planta de tratamiento de DAM.',
      'Suspender provisionalmente las tomas agrícolas no autorizadas en el tramo Shorey-Samne.',
      'Remitir el expediente al Ministerio Público - Fiscalía Especializada en Materia Ambiental (FEMA La Libertad).',
    ],
  },
  {
    id: 'rep-indeci-03',
    code: 'EXP-INDECI-COER-LL-2026-015',
    entity: 'INDECI',
    title: 'Evaluación de Vulnerabilidad y Tiempos de Evacuación por Rotura de Presa de Relaves (Dam-Break)',
    reportType: 'Seguridad de Presas',
    issueDate: '2026-08-25 18:20',
    generatedBy: 'Centro de Operaciones de Emergencia Regional (COER La Libertad)',
    digitalSignatureHash: 'SHA256: 3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b',
    status: 'Emitido Oficialmente',
    executiveSummary: 'Modelación bidimensional de propagación de onda de lodos hiperconcentrados ante hipótesis de falla en el depósito de relaves Shorey (V=2.4 Hm³). La onda alcanzaría Quiruvilca en 42 min (Qp=1,420 m³/s, y=6.8 m) y la confluencia con Simbal en 4h 15 min.',
    keyMetrics: {
      'Caudal Pico en Brecha (Qp)': '1,680 m³/s',
      'Tirante Máximo en Quiruvilca': '6.80 m',
      'Tiempo de Llegada a Moche': '6h 40min',
      'Población en Zona de Alto Peligro': '14,250 habitantes',
      'Sirenas de Alarma SCADA': '4 Activadas / 100% Operativas',
    },
    recommendations: [
      'Validar rutas de evacuación señalizadas hacia cotas superiores a los 8 metros del lecho en Quiruvilca y Poroto.',
      'Ejecutar simulacro inopinado de respuesta temprana con las plataformas distritales de defensa civil.',
      'Inspeccionar piezómetros de cuerda vibrante en el talud aguas abajo del depósito de relaves.',
    ],
  },
  {
    id: 'rep-sedalib-04',
    code: 'INF-SEDALIB-DTH-2026-112',
    entity: 'SEDALIB',
    title: 'Dictamen de Intrusión Marina y Calidad de Agua Subterránea en Pozos de Abastecimiento Trujillo Sur',
    reportType: 'Balance Piezométrico y Salinidad',
    issueDate: '2026-08-24 10:00',
    generatedBy: 'Gerencia de Producción y Calidad del Agua - SEDALIB S.A.',
    digitalSignatureHash: 'SHA256: 1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e',
    status: 'Aprobado & Sellado',
    executiveSummary: 'Monitoreo de salinización por sobreexplotación en pozos de Víctor Larco y Las Delicias. Se observa avance de la cuña salina a 1.4 km de la línea costera con conductividades de hasta 3,850 µS/cm en pozo PZ-VL-01. El balance subterráneo anual presenta un déficit de -8.3 Hm³/año.',
    keyMetrics: {
      'Déficit Freático Anual': '-8.3 Hm³/año',
      'Conductividad Máxima': '3,850 µS/cm (Víctor Larco)',
      'Cloruros Promedio Litoral': '680 mg/L (Excede norma para consumo directo)',
      'Profundidad Interfase Salina': '-48.0 m bnm',
      'Pozos en Riesgo Crítico': '3 Pozos (Víctor Larco / Huanchaco)',
    },
    recommendations: [
      'Implementar recarga artificial inducida del acuífero aprovechando excedentes de avenidas del río Moche.',
      'Sectorizar el bombeo nocturno para atenuar los conos de depresión cerca a la franja marina.',
      'Interconectar la red de distribución con la planta de tratamiento de agua potable de Salaverry.',
    ],
  },
];
