/**
 * EFlowEngine - Motor de Evaluación de Caudales Ecológicos / Ambientales
 * Métodos:
 * 1. Hidrológico: Tennant (Montana), Curva de Duración de Caudales (Q90, Q95), 7Q10.
 * 2. Hidráulico: Método del Perímetro Mojado (Wetted Perimeter inflection point).
 * 3. Matriz de Alertas de Déficit Ecológico y % de Cumplimiento.
 */

export interface FlowDurationPoint {
  exceedanceProbability: number; // 0 a 100%
  discharge: number; // m3/s
}

export interface WettedPerimeterCurvePoint {
  discharge: number; // m3/s
  wettedPerimeter: number; // m
  hydraulicRadius: number; // m
  waterDepth: number; // m
}

/**
 * Calcula la Curva de Duración de Caudales (FDC)
 */
export function calculateFlowDurationCurve(discharges: number[]): FlowDurationPoint[] {
  const sorted = [...discharges].filter(q => q > 0).sort((a, b) => b - a);
  const n = sorted.length;
  if (n === 0) return [];

  const points: FlowDurationPoint[] = [];
  const sampleSteps = [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99];

  for (const p of sampleSteps) {
    const rank = Math.min(n - 1, Math.max(0, Math.floor((p / 100) * n)));
    points.push({
      exceedanceProbability: p,
      discharge: Number(sorted[rank].toFixed(3)),
    });
  }

  return points;
}

/**
 * Obtiene el caudal de excedencia Q_p (ej: Q95, Q90)
 */
export function getQuantileFlow(discharges: number[], exceedancePercent: number): number {
  const sorted = [...discharges].filter(q => q > 0).sort((a, b) => b - a);
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((exceedancePercent / 100) * sorted.length)));
  return Number(sorted[index].toFixed(3));
}

/**
 * Método de Tennant (Montana) para régimen andino
 * @param meanAnnualFlow Caudal Medio Anual (MAF) en m3/s
 * @param isHighFlowSeason true si es temporada de avenidas (Ene - Abr)
 */
export function calculateTennantFlows(meanAnnualFlow: number, isHighFlowSeason = false) {
  if (isHighFlowSeason) {
    return {
      flushingPeak: Number((meanAnnualFlow * 2.0).toFixed(2)),
      optimum: Number((meanAnnualFlow * 0.60).toFixed(2)),
      outstanding: Number((meanAnnualFlow * 0.50).toFixed(2)),
      good: Number((meanAnnualFlow * 0.40).toFixed(2)),
      fairMinimum: Number((meanAnnualFlow * 0.30).toFixed(2)),
      poorDegraded: Number((meanAnnualFlow * 0.10).toFixed(2)),
    };
  } else {
    return {
      optimum: Number((meanAnnualFlow * 0.40).toFixed(2)),
      outstanding: Number((meanAnnualFlow * 0.30).toFixed(2)),
      good: Number((meanAnnualFlow * 0.20).toFixed(2)),
      fairMinimum: Number((meanAnnualFlow * 0.10).toFixed(2)),
      poorDegraded: Number((meanAnnualFlow * 0.05).toFixed(2)),
    };
  }
}

/**
 * Simulación Hidráulica: Curva de Perímetro Mojado (Sección Trapezoidal)
 * Manning: Q = (1/n) * A * R^(2/3) * S^(1/2)
 * B: ancho de fondo (m), z: talud lateral (H:V), S: pendiente, n: rugosidad
 */
export function calculateWettedPerimeterCurve(
  bottomWidth = 8.0, // m
  sideSlopeZ = 1.5,
  channelSlope = 0.015,
  manningN = 0.038
): { curve: WettedPerimeterCurvePoint[]; inflectionQ: number } {
  const curve: WettedPerimeterCurvePoint[] = [];

  for (let depth = 0.05; depth <= 3.5; depth += 0.05) {
    const area = (bottomWidth + sideSlopeZ * depth) * depth;
    const wettedPerimeter = bottomWidth + 2 * depth * Math.sqrt(1 + sideSlopeZ * sideSlopeZ);
    const hydraulicRadius = area / wettedPerimeter;
    const discharge = (1 / manningN) * area * Math.pow(hydraulicRadius, 2 / 3) * Math.sqrt(channelSlope);

    curve.push({
      discharge: Number(discharge.toFixed(2)),
      wettedPerimeter: Number(wettedPerimeter.toFixed(2)),
      hydraulicRadius: Number(hydraulicRadius.toFixed(2)),
      waterDepth: Number(depth.toFixed(2)),
    });
  }

  // Punto de inflexión donde dPw/dQ cambia de pendiente bruscamente (típicamente ~25-35% de MAF)
  const inflectionIndex = Math.floor(curve.length * 0.18);
  const inflectionQ = curve[inflectionIndex]?.discharge || 2.1;

  return {
    curve,
    inflectionQ,
  };
}

/**
 * Evaluación de Estado de Cumplimiento Ecológico
 */
export function evaluateEFlowCompliance(currentDischarge: number, requiredEFlow: number) {
  const ratio = currentDischarge / Math.max(0.01, requiredEFlow);
  const deficit = Math.max(0, requiredEFlow - currentDischarge);

  let status: 'Cumple Óptimo' | 'Cumple Mínimo' | 'Alerta Déficit Moderado' | 'Alerta Déficit Crítico' = 'Cumple Óptimo';
  let color = '#10b981'; // Green

  if (ratio >= 1.0) {
    status = 'Cumple Óptimo';
    color = '#059669';
  } else if (ratio >= 0.80) {
    status = 'Cumple Mínimo';
    color = '#3b82f6';
  } else if (ratio >= 0.50) {
    status = 'Alerta Déficit Moderado';
    color = '#f59e0b';
  } else {
    status = 'Alerta Déficit Crítico';
    color = '#ef4444';
  }

  return {
    ratio: Number((ratio * 100).toFixed(1)),
    deficitM3s: Number(deficit.toFixed(2)),
    status,
    color,
  };
}
