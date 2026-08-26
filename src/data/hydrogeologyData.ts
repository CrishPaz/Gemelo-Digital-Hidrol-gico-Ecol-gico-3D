/**
 * hydrogeologyData.ts - Red Piezométrica, Modelo de Cuña Salina (Ghyben-Herzberg)
 * y Balance Hidrogeológico del Acuífero del Valle Santa Catalina / Río Moche.
 */

import { GroundwaterWell, AquiferRechargeBalance } from '../types';

export const INITIAL_GROUNDWATER_WELLS: GroundwaterWell[] = [
  {
    id: 'well-01',
    code: 'PZ-VL-01',
    name: 'Pozo Agrícola Buenos Aires Sur',
    sector: 'Víctor Larco / Buenos Aires',
    distanceToCoastKm: 0.8,
    depthMeters: 45,
    waterTableDepthM: 2.8,
    hydraulicHeadMsl: 1.2,
    extractionRateLs: 35,
    electricalConductivityUsCm: 3850,
    chloridesMgL: 680,
    salinityRisk: 'Severa (Intrusión)',
    irrigationSuitability: 'No Apto (Salinizado)',
    latitude: -8.148,
    longitude: -79.055,
  },
  {
    id: 'well-02',
    code: 'PZ-DEL-02',
    name: 'Pozo Fundo Las Delicias',
    sector: 'Moche / Las Delicias',
    distanceToCoastKm: 1.4,
    depthMeters: 55,
    waterTableDepthM: 4.2,
    hydraulicHeadMsl: 2.1,
    extractionRateLs: 42,
    electricalConductivityUsCm: 2900,
    chloridesMgL: 460,
    salinityRisk: 'Moderada',
    irrigationSuitability: 'Restringido (Palto/Espárrago)',
    latitude: -8.172,
    longitude: -79.031,
  },
  {
    id: 'well-03',
    code: 'PZ-CAMP-03',
    name: 'Pozo Comunal Campiña de Moche',
    sector: 'Campiña de Moche',
    distanceToCoastKm: 4.8,
    depthMeters: 60,
    waterTableDepthM: 7.5,
    hydraulicHeadMsl: 14.5,
    extractionRateLs: 28,
    electricalConductivityUsCm: 1420,
    chloridesMgL: 185,
    salinityRisk: 'Leve',
    irrigationSuitability: 'Apto con Drenaje',
    latitude: -8.156,
    longitude: -78.995,
  },
  {
    id: 'well-04',
    code: 'PZ-LAR-04',
    name: 'Pozo Cooperativa Laredo Norte',
    sector: 'Valle de Laredo',
    distanceToCoastKm: 16.2,
    depthMeters: 75,
    waterTableDepthM: 14.8,
    hydraulicHeadMsl: 85.0,
    extractionRateLs: 50,
    electricalConductivityUsCm: 840,
    chloridesMgL: 92,
    salinityRisk: 'Normal',
    irrigationSuitability: 'Apto Sin Restricción',
    latitude: -8.089,
    longitude: -78.960,
  },
  {
    id: 'well-05',
    code: 'PZ-POR-05',
    name: 'Pozo Valle Medio Poroto',
    sector: 'Poroto / Mochal',
    distanceToCoastKm: 34.0,
    depthMeters: 40,
    waterTableDepthM: 9.2,
    hydraulicHeadMsl: 580.0,
    extractionRateLs: 18,
    electricalConductivityUsCm: 610,
    chloridesMgL: 45,
    salinityRisk: 'Normal',
    irrigationSuitability: 'Apto Sin Restricción',
    latitude: -8.012,
    longitude: -78.784,
  },
  {
    id: 'well-06',
    code: 'PZ-HUAN-06',
    name: 'Pozo Hortícola Huanchaco Playa',
    sector: 'Huanchaco Litoral',
    distanceToCoastKm: 1.1,
    depthMeters: 38,
    waterTableDepthM: 3.1,
    hydraulicHeadMsl: 1.5,
    extractionRateLs: 22,
    electricalConductivityUsCm: 3200,
    chloridesMgL: 540,
    salinityRisk: 'Severa (Intrusión)',
    irrigationSuitability: 'No Apto (Salinizado)',
    latitude: -8.075,
    longitude: -79.112,
  },
];

/**
 * Cálculo de la Penetración de la Cuña Salina mediante Ley de Ghyben-Herzberg:
 * z = 40 * h_f (donde z es la profundidad de la interfase salina bajo el nivel del mar y h_f es la carga de agua dulce)
 */
export function calculateSaltWedgeProfile(pumpingExtractionFactor: number, riverRechargeFactor: number) {
  // Distancias desde la línea de costa hacia el interior (0 a 10 km)
  const distancesKm = [0, 0.5, 1.0, 1.5, 2.0, 3.0, 4.5, 6.0, 8.0, 10.0];

  return distancesKm.map(dist => {
    // Carga hidráulica dulce base h_f (msnm) modificada por recarga fluvial vs bombeo
    const naturalHead = 0.4 + (dist * 1.8);
    const modifiedHead = Math.max(0.1, naturalHead * riverRechargeFactor - (pumpingExtractionFactor * 0.45));
    
    // Profundidad de la interfase agua dulce / agua de mar (z = 40 * h_f)
    const saltInterfaceDepthM = -(40 * modifiedHead);

    // Conductividad eléctrica estimada en superficie freática (uS/cm)
    const baseEC = 600 + (3500 * Math.exp(-0.75 * dist * (riverRechargeFactor / pumpingExtractionFactor)));
    const electricalConductivity = Math.round(baseEC);

    return {
      distanceKm: dist,
      waterTableHeadM: Number(modifiedHead.toFixed(2)),
      saltInterfaceDepthM: Number(saltInterfaceDepthM.toFixed(1)),
      electricalConductivityUsCm: electricalConductivity,
      riskLevel: electricalConductivity > 3000 ? 'Severo' : electricalConductivity > 1500 ? 'Moderado' : 'Bajo',
    };
  });
}
