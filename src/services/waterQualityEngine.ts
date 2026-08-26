/**
 * WaterQualityEngine - Cálculo de Calidad del Agua e Índices WQI/ICA
 * Normativa: Estándares de Calidad Ambiental para Agua (D.S. N° 004-2017-MINAM, Perú)
 * y Algoritmos Bio-ópticos para Teledetección Satelital (Sentinel-2 L2A).
 */

export interface WaterQualityInput {
  do: number;              // mg/L (Oxígeno Disuelto)
  ph: number;              // Unidades de pH
  ec: number;              // uS/cm (Conductividad Eléctrica)
  turbidity: number;       // NTU (Turbidez)
  tss: number;             // mg/L (Sólidos Suspendidos Totales)
  nitrates: number;        // mg/L (Nitratos NO3-)
  total_p: number;         // mg/L (Fósforo Total)
  fecal_coliforms: number; // NMP/100 mL (Coliformes Fecales)
  chlorophyll_a?: number;  // ug/L (Clorofila-a)
  heavy_metals_lead?: number; // mg/L (Plomo)
}

export interface WQIResult {
  score: number; // 0 - 100
  classification: 'Excelente' | 'Buena' | 'Regular' | 'Mala' | 'Pésima';
  colorHex: string;
  subIndices: Record<string, number>;
  limitingFactor: string;
}

/**
 * Calcula el sub-índice de calidad (qi) para cada parámetro en escala 0-100
 */
function getSubIndexDO(doVal: number): number {
  if (doVal >= 7.5) return 100;
  if (doVal >= 6.0) return 85;
  if (doVal >= 5.0) return 70;
  if (doVal >= 4.0) return 50;
  if (doVal >= 2.0) return 25;
  return 10;
}

function getSubIndexPH(ph: number): number {
  if (ph >= 7.0 && ph <= 8.2) return 100;
  if ((ph >= 6.5 && ph < 7.0) || (ph > 8.2 && ph <= 8.6)) return 80;
  if ((ph >= 6.0 && ph < 6.5) || (ph > 8.6 && ph <= 9.0)) return 55;
  if ((ph >= 5.0 && ph < 6.0) || (ph > 9.0 && ph <= 9.5)) return 30;
  return 10;
}

function getSubIndexEC(ec: number): number {
  if (ec <= 500) return 100;
  if (ec <= 1000) return 85;
  if (ec <= 1500) return 70;
  if (ec <= 2500) return 50;
  if (ec <= 4000) return 30;
  return 15;
}

function getSubIndexTurbidity(turb: number): number {
  if (turb <= 5) return 100;
  if (turb <= 15) return 85;
  if (turb <= 30) return 70;
  if (turb <= 50) return 55;
  if (turb <= 100) return 35;
  return 15;
}

function getSubIndexNitrates(no3: number): number {
  if (no3 <= 2.0) return 100;
  if (no3 <= 5.0) return 85;
  if (no3 <= 10.0) return 70;
  if (no3 <= 25.0) return 45;
  if (no3 <= 50.0) return 25;
  return 10;
}

function getSubIndexPhosphorus(tp: number): number {
  if (tp <= 0.05) return 100;
  if (tp <= 0.10) return 80;
  if (tp <= 0.25) return 60;
  if (tp <= 0.50) return 40;
  return 20;
}

function getSubIndexColiforms(col: number): number {
  if (col <= 50) return 100;
  if (col <= 200) return 80;
  if (col <= 1000) return 60;
  if (col <= 2000) return 40;
  return 15;
}

function getSubIndexLead(lead: number): number {
  if (lead <= 0.001) return 100;
  if (lead <= 0.0025) return 85;
  if (lead <= 0.01) return 50;
  if (lead <= 0.05) return 25;
  return 5;
}

/**
 * Calcula el Índice de Calidad de Agua (ICA/WQI) Compuesto
 */
export function calculateWQI(params: WaterQualityInput): WQIResult {
  const qDO = getSubIndexDO(params.do);
  const qPH = getSubIndexPH(params.ph);
  const qEC = getSubIndexEC(params.ec);
  const qTurb = getSubIndexTurbidity(params.turbidity);
  const qNO3 = getSubIndexNitrates(params.nitrates);
  const qTP = getSubIndexPhosphorus(params.total_p);
  const qCol = getSubIndexColiforms(params.fecal_coliforms);
  const qPb = getSubIndexLead(params.heavy_metals_lead ?? 0.002);

  // Pesos normalizados wi (suma = 1.00)
  const weights = {
    do: 0.18,
    ph: 0.12,
    ec: 0.10,
    turbidity: 0.12,
    nitrates: 0.12,
    total_p: 0.10,
    fecal_coliforms: 0.14,
    heavy_metals_lead: 0.12,
  };

  const score =
    qDO * weights.do +
    qPH * weights.ph +
    qEC * weights.ec +
    qTurb * weights.turbidity +
    qNO3 * weights.nitrates +
    qTP * weights.total_p +
    qCol * weights.fecal_coliforms +
    qPb * weights.heavy_metals_lead;

  const roundedScore = Number(score.toFixed(1));

  // Identificar el factor más limitante
  const subIndices = {
    'Oxígeno Disuelto': qDO,
    'pH': qPH,
    'Conductividad': qEC,
    'Turbidez': qTurb,
    'Nitratos': qNO3,
    'Fósforo Total': qTP,
    'Coliformes Fecales': qCol,
    'Plomo (Metales)': qPb,
  };

  let minKey = 'Oxígeno Disuelto';
  let minVal = 100;
  for (const [k, v] of Object.entries(subIndices)) {
    if (v < minVal) {
      minVal = v;
      minKey = k;
    }
  }

  let classification: WQIResult['classification'] = 'Excelente';
  let colorHex = '#10b981'; // Green

  if (roundedScore >= 90) {
    classification = 'Excelente';
    colorHex = '#059669';
  } else if (roundedScore >= 70) {
    classification = 'Buena';
    colorHex = '#10b981';
  } else if (roundedScore >= 50) {
    classification = 'Regular';
    colorHex = '#f59e0b'; // Amber
  } else if (roundedScore >= 25) {
    classification = 'Mala';
    colorHex = '#ef4444'; // Red
  } else {
    classification = 'Pésima';
    colorHex = '#7f1d1d'; // Dark Red
  }

  return {
    score: roundedScore,
    classification,
    colorHex,
    subIndices,
    limitingFactor: `${minKey} (${minVal}/100)`,
  };
}

/**
 * Teledetección Satelital: Estimación de Índices Espectrales Sentinel-2
 */
export function calculateSatelliteWaterIndices(
  greenReflectance: number,  // Band 3 (560 nm)
  redReflectance: number,    // Band 4 (665 nm)
  redEdgeReflectance: number,// Band 5 (705 nm)
  nirReflectance: number,    // Band 8 (842 nm)
  swirReflectance: number    // Band 11 (1610 nm)
) {
  // 1. NDWI (Normalized Difference Water Index - McFeeters 1996)
  const ndwi = (greenReflectance - nirReflectance) / Math.max(0.0001, greenReflectance + nirReflectance);

  // 2. MNDWI (Modified NDWI - Xu 2006)
  const mndwi = (greenReflectance - swirReflectance) / Math.max(0.0001, greenReflectance + swirReflectance);

  // 3. Clorofila-a (Algoritmo 2-Band Red-Edge Ratio - Moses et al., 2012)
  // Chl-a [ug/L] = a * (R_705 / R_665) + b
  const bandRatio = redEdgeReflectance / Math.max(0.001, redReflectance);
  const chlorophyllA = Math.max(0.2, Number((24.5 * bandRatio - 12.2).toFixed(2)));

  // 4. Turbidez Semi-Analítica (Nechad et al., 2010 - Band 4)
  // T [NTU] = (A_T * rho_w) / (1 - rho_w / C_T)
  const A_T = 385.0;
  const C_T = 0.174;
  const turbidityNTU = Math.max(
    1.0,
    Number(((A_T * redReflectance) / (1 - Math.min(0.9, redReflectance / C_T))).toFixed(1))
  );

  return {
    ndwi: Number(ndwi.toFixed(3)),
    mndwi: Number(mndwi.toFixed(3)),
    chlorophyllAUgL: chlorophyllA,
    turbidityNTU: turbidityNTU,
    isWaterPixel: ndwi > 0.0 || mndwi > 0.1,
  };
}

/**
 * Filtro de Detección de Outliers (Hampel Filter / 3-Sigma) para Telemetría IoT
 */
export function validateTelemetryPoint(
  currentValue: number,
  recentWindow: number[],
  physicalMin: number,
  physicalMax: number
): { validatedValue: number; flag: 'good' | 'suspect_outlier' | 'drift_corrected' | 'imputed' } {
  // 1. Verificación de límites físicos
  if (currentValue < physicalMin || currentValue > physicalMax) {
    const clamped = Math.max(physicalMin, Math.min(physicalMax, currentValue));
    return { validatedValue: clamped, flag: 'suspect_outlier' };
  }

  if (recentWindow.length < 5) {
    return { validatedValue: currentValue, flag: 'good' };
  }

  // 2. Filtro Hampel: Mediana y Desviación Absoluta de la Mediana (MAD)
  const sorted = [...recentWindow].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const absDevs = sorted.map(v => Math.abs(v - median)).sort((a, b) => a - b);
  const mad = absDevs[Math.floor(absDevs.length / 2)];

  const threshold = 3.0 * (1.4826 * Math.max(0.01, mad));

  if (Math.abs(currentValue - median) > threshold) {
    // Es un outlier brusco: imputar con la mediana local
    return { validatedValue: Number(median.toFixed(2)), flag: 'imputed' };
  }

  return { validatedValue: currentValue, flag: 'good' };
}
