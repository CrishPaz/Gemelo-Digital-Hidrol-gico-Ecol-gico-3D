/**
 * hydrodynamicsEngine.ts - Motor de Cálculo Hidráulico 1D, Inundaciones,
 * Asignación de Recursos Hídricos y Transporte de Contaminantes (Metales Pesados).
 */

import {
  RiverCrossSection,
  FloodReturnPeriodSimulation,
  WaterDemandSector,
  MonthlyWaterBalance,
  ContaminantDispersionPoint,
} from '../types';
import {
  MOCHE_RIVER_CROSS_SECTIONS,
  MOCHE_WATER_DEMAND_SECTORS,
  MOCHE_HEAVY_METALS_PROFILE,
} from '../data/mocheHydroData';

/**
 * Calcula el perfil hidráulico longitudinal para un caudal determinado (Q m3/s en cabecera)
 * usando aproximación de flujo gradualmente variado y ecuación de Manning
 */
export function computeHydraulicProfile(
  baseDischargeM3s: number,
  manningScale: number = 1.0
): RiverCrossSection[] {
  return MOCHE_RIVER_CROSS_SECTIONS.map((sec, idx) => {
    // El caudal aumenta hacia aguas abajo por aportes de tributarios
    const tributaryGainFactor = 1.0 + idx * 0.12;
    const qSection = baseDischargeM3s * tributaryGainFactor;

    // Estimación del tirante normal mediante inversión de Manning: Q = (1/n) * A * R^(2/3) * S0^(1/2)
    // Para sección trapecial / ancha: A = B * y, R ~ y
    const baseSlope = idx === 0 ? 0.045 : idx < 4 ? 0.025 : idx < 7 ? 0.008 : 0.003;
    const n = sec.manningN * manningScale;
    const width = sec.topWidthM;

    // y ~ (Q * n / (width * sqrt(S0)))^(3/5)
    const estimatedDepth = Math.max(
      0.3,
      Math.pow((qSection * n) / (width * Math.sqrt(baseSlope)), 0.6)
    );

    const waterDepthM = Number(estimatedDepth.toFixed(2));
    const waterLevelM = Number((sec.bedElevationM + waterDepthM).toFixed(2));
    const flowArea = width * waterDepthM;
    const flowVelocityMs = Number((qSection / flowArea).toFixed(2));

    // Número de Froude: Fr = v / sqrt(g * y)
    const g = 9.81;
    const froudeNumber = Number((flowVelocityMs / Math.sqrt(g * waterDepthM)).toFixed(2));

    const wettedPerimeterM = Number((width + 2 * waterDepthM * 1.1).toFixed(1));
    const hydraulicRadiusM = Number((flowArea / wettedPerimeterM).toFixed(2));

    // Bordo libre = Cota de corona de ribera - Cota de agua
    const freeboardM = Number((sec.bankElevationM - waterLevelM).toFixed(2));
    const isOverbankFlooded = freeboardM <= 0;

    let floodRiskLevel: 'Bajo' | 'Moderado' | 'Alto' | 'Extremo' = 'Bajo';
    if (freeboardM < -0.5) floodRiskLevel = 'Extremo';
    else if (freeboardM <= 0) floodRiskLevel = 'Alto';
    else if (freeboardM < 1.0) floodRiskLevel = 'Moderado';

    return {
      ...sec,
      dischargeM3s: Number(qSection.toFixed(2)),
      waterDepthM,
      waterLevelM,
      flowVelocityMs,
      froudeNumber,
      wettedPerimeterM,
      hydraulicRadiusM,
      freeboardM,
      isOverbankFlooded,
      floodRiskLevel,
    };
  });
}

/**
 * Optimiza la distribución de agua según prioridades de la Ley de Recursos Hídricos N° 29338
 * ante variaciones de caudal disponible en el río.
 */
export function optimizeWaterAllocation(
  availableRiverFlowM3s: number,
  sectors: WaterDemandSector[] = MOCHE_WATER_DEMAND_SECTORS
): WaterDemandSector[] {
  // Ordenar por rango de prioridad: 1 (Ecológico) > 2 (Poblacional) > 3 (Agrario) > 4 (Industrial/Minero)
  let remainingFlow = availableRiverFlowM3s;

  return sectors.map(sec => {
    let allocated = 0;
    if (remainingFlow >= sec.requestedFlowM3s) {
      allocated = sec.requestedFlowM3s;
      remainingFlow -= sec.requestedFlowM3s;
    } else {
      allocated = Math.max(0, remainingFlow);
      remainingFlow = 0;
    }

    const satisfactionRatePercent = Number(((allocated / sec.requestedFlowM3s) * 100).toFixed(1));

    let gateStatus: '100% Abierta' | '75% Regulada' | '50% Restringida' | 'Cierre Preventivo' = '100% Abierta';
    if (satisfactionRatePercent === 0) {
      gateStatus = 'Cierre Preventivo';
    } else if (satisfactionRatePercent < 60) {
      gateStatus = '50% Restringida';
    } else if (satisfactionRatePercent < 95) {
      gateStatus = '75% Regulada';
    }

    return {
      ...sec,
      allocatedFlowM3s: Number(allocated.toFixed(2)),
      satisfactionRatePercent,
      gateStatus,
    };
  });
}

/**
 * Simula el transporte y dispersión 1D de metales pesados (Pb, As, Cd)
 * con atenuación natural, sorción y neutralización de drenaje ácido de mina (DAM)
 */
export function simulateHeavyMetalsTransport(
  remediationEfficiencyPercent: number = 0, // 0 a 100% de tratamiento de efluente minero en cabecera
  dilutionFlowMultiplier: number = 1.0
): ContaminantDispersionPoint[] {
  const remediationFactor = 1 - (remediationEfficiencyPercent / 100) * 0.88;

  return MOCHE_HEAVY_METALS_PROFILE.map((pt, idx) => {
    // Atenuación longitudinal con la distancia
    const attenuation = Math.exp(-0.025 * pt.km);
    const dilutionFactor = Math.max(0.2, 1.0 / (dilutionFlowMultiplier * (1 + idx * 0.15)));

    const leadPb = Number((pt.leadPb_mgL * remediationFactor * (0.3 + 0.7 * attenuation) * dilutionFactor).toFixed(3));
    const arsenicAs = Number((pt.arsenicAs_mgL * remediationFactor * (0.35 + 0.65 * attenuation) * dilutionFactor).toFixed(3));
    const cadmiumCd = Number((pt.cadmiumCd_mgL * remediationFactor * (0.25 + 0.75 * attenuation) * dilutionFactor).toFixed(4));
    const ironFe = Number((pt.ironFe_mgL * remediationFactor * (0.2 + 0.8 * attenuation) * dilutionFactor).toFixed(2));

    // Recuperación de pH con neutralización
    const ph = Math.min(8.2, Number((pt.ph + (remediationEfficiencyPercent / 100) * 2.8).toFixed(1)));
    const wqi = Math.min(98, Math.max(15, Number((pt.wqi + (remediationEfficiencyPercent / 100) * 35).toFixed(1))));

    // Evaluación ECA Cat 3 (Riego de vegetales y bebida de animales: Pb <= 0.05, As <= 0.1)
    let status: 'Conforme ECA' | 'Alerta Leve' | 'Superación Crítica ECA' = 'Conforme ECA';
    if (leadPb > 0.05 || arsenicAs > 0.1) {
      status = 'Superación Crítica ECA';
    } else if (leadPb > 0.03 || arsenicAs > 0.07) {
      status = 'Alerta Leve';
    }

    const currentPollutantLoadKgDay = Number((leadPb * pt.tmdlCapacityKgDay * 2.2).toFixed(1));

    return {
      ...pt,
      leadPb_mgL: leadPb,
      arsenicAs_mgL: arsenicAs,
      cadmiumCd_mgL: cadmiumCd,
      ironFe_mgL: ironFe,
      ph,
      wqi,
      currentPollutantLoadKgDay,
      status,
    };
  });
}
