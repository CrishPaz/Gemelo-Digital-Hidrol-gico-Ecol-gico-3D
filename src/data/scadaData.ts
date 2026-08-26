/**
 * scadaData.ts - Datos e Infraestructura de Telecontrol SCADA,
 * Bocatomas, Desarenadores y Simulación de Rotura de Presa de Relaves (Dam-Break Shorey).
 */

import { HydraulicStructureSCADA, DamBreakSimulationPoint } from '../types';

export const INITIAL_SCADA_STRUCTURES: HydraulicStructureSCADA[] = [
  {
    id: 'scada-bocatoma-menocucho',
    name: 'Bocatoma Principal Menocucho',
    type: 'bocatoma',
    locationKm: 28.0,
    subbasin: 'Valle Medio - Confluencia Simbal',
    status: 'normal',
    waterLevelM: 2.85,
    maxDesignLevelM: 4.20,
    inflowM3s: 18.5,
    outflowM3s: 14.2,
    sedimentDepositionPercent: 28,
    gates: [
      {
        gateId: 'G1-RADIAL-RIV',
        gateName: 'Compuerta Radial Río Principal #1',
        gateType: 'radial',
        openingPercent: 65,
        flowPassingM3s: 10.5,
        remoteControlEnabled: true,
      },
      {
        gateId: 'G2-SLIDE-DERIV',
        gateName: 'Compuerta de Captación / Derivación #1',
        gateType: 'deslizante',
        openingPercent: 80,
        flowPassingM3s: 4.3,
        remoteControlEnabled: true,
      },
      {
        gateId: 'G3-SLIDE-PURGA',
        gateName: 'Compuerta de Limpia y Purga de Fondo',
        gateType: 'deslizante',
        openingPercent: 15,
        flowPassingM3s: 3.7,
        remoteControlEnabled: true,
      },
    ],
    actuatorStatus: 'En Línea (PLC Modbus TCP)',
  },
  {
    id: 'scada-canal-mochica',
    name: 'Partidor & Canal Principal La Mochica',
    type: 'canal_principal',
    locationKm: 16.5,
    subbasin: 'Valle Bajo - Laredo',
    status: 'normal',
    waterLevelM: 1.45,
    maxDesignLevelM: 2.10,
    inflowM3s: 3.8,
    outflowM3s: 3.8,
    sedimentDepositionPercent: 18,
    gates: [
      {
        gateId: 'G-MOCHICA-A',
        gateName: 'Compuerta Distribución Rama Norte',
        gateType: 'deslizante',
        openingPercent: 70,
        flowPassingM3s: 2.2,
        remoteControlEnabled: true,
      },
      {
        gateId: 'G-MOCHICA-B',
        gateName: 'Compuerta Distribución Rama Sur (Campiña)',
        gateType: 'deslizante',
        openingPercent: 55,
        flowPassingM3s: 1.6,
        remoteControlEnabled: true,
      },
    ],
    actuatorStatus: 'En Línea (PLC Modbus TCP)',
  },
  {
    id: 'scada-desarenador-poroto',
    name: 'Desarenador de Transición Poroto',
    type: 'desarenador',
    locationKm: 38.2,
    subbasin: 'Valle Medio - Poroto',
    status: 'alerta',
    waterLevelM: 2.10,
    maxDesignLevelM: 2.80,
    inflowM3s: 5.2,
    outflowM3s: 4.9,
    sedimentDepositionPercent: 78, // Alto nivel de sedimentos
    gates: [
      {
        gateId: 'G-DESAR-ENTRADA',
        gateName: 'Compuerta de Admisión Cámara 1',
        gateType: 'deslizante',
        openingPercent: 90,
        flowPassingM3s: 3.0,
        remoteControlEnabled: true,
      },
      {
        gateId: 'G-DESAR-PURGA-F',
        gateName: 'Válvula de Purga de Arenas',
        gateType: 'deslizante',
        openingPercent: 20,
        flowPassingM3s: 0.3,
        remoteControlEnabled: true,
      },
    ],
    actuatorStatus: 'En Línea (PLC Modbus TCP)',
  },
  {
    id: 'scada-presa-shorey',
    name: 'Depósito / Presa de Relaves Mineros Shorey',
    type: 'represa_relaves',
    locationKm: 92.4,
    subbasin: 'Cuenca Alta - Quiruvilca',
    status: 'emergencia',
    waterLevelM: 14.8,
    maxDesignLevelM: 16.0,
    inflowM3s: 2.1,
    outflowM3s: 1.8,
    sedimentDepositionPercent: 94,
    gates: [
      {
        gateId: 'G-RELAVES-VERT',
        gateName: 'Aliviadero de Demasías y Decantación',
        gateType: 'vagón',
        openingPercent: 40,
        flowPassingM3s: 1.8,
        remoteControlEnabled: false, // Bloqueado por seguridad local
      },
    ],
    actuatorStatus: 'Manual Local',
  },
];

/**
 * Simulación de la Onda de Rotura de Presa de Relaves (Dam-Break Model)
 * Ecuaciones de Saint-Venant 1D no lineales para fluidos no newtonianos (lodos y relaves)
 */
export function calculateDamBreakWave(breachWidthM: number, breachDepthM: number, waterStorageHm3: number): DamBreakSimulationPoint[] {
  // Volumen de la presa de relaves: V (m³)
  const volumeM3 = waterStorageHm3 * 1e6;
  // Caudal pico estimado por fórmula de Froehlich / USACE: Q_p = 0.607 * V^0.295 * h_w^1.24
  const breachHeight = breachDepthM;
  const peakFlow = 0.607 * Math.pow(volumeM3, 0.295) * Math.pow(breachHeight, 1.24);

  // Puntos de propagación aguas abajo (distancias desde la presa Shorey Km 92.4)
  const downstreamImpacts = [
    { kmFromDam: 0, zone: 'Presa de Relaves Shorey (Punto Falla)', baseElevation: 3850 },
    { kmFromDam: 8, zone: 'Caserío San Juan / Río San Juan', baseElevation: 3200 },
    { kmFromDam: 25, zone: 'Confluencia Río Otuzco / Agallpampa', baseElevation: 2150 },
    { kmFromDam: 45, zone: 'Sector Poroto / Mochal', baseElevation: 850 },
    { kmFromDam: 64, zone: 'Bocatoma Menocucho', baseElevation: 350 },
    { kmFromDam: 74, zone: 'Valle de Laredo (Población Urbana)', baseElevation: 120 },
    { kmFromDam: 86, zone: 'Campiña de Moche / Huaca del Sol', baseElevation: 45 },
    { kmFromDam: 92, zone: 'Desembocadura Océano Pacífico (Las Delicias)', baseElevation: 0 },
  ];

  return downstreamImpacts.map((pt, idx) => {
    // Atenuación hidrodinámica y retardo de tiempo
    const celerityMs = Math.max(2.5, 9.5 - (idx * 0.75)); // Velocidad de la onda de lodo
    const distanceM = pt.kmFromDam * 1000;
    const arrivalTimeMinutes = pt.kmFromDam === 0 ? 0 : Math.round(distanceM / celerityMs / 60);
    
    // Atenuación del caudal de pico por almacenamiento en llanura
    const attenuationFactor = Math.exp(-0.022 * pt.kmFromDam);
    const localPeakQ = Number((peakFlow * attenuationFactor).toFixed(1));
    
    // Tirante de inundación de lodo (h = (Q / (B * V))^0.6)
    const channelWidth = 15 + idx * 6; // Ancho promedio del valle
    const localDepth = Number((Math.pow(localPeakQ / (channelWidth * (celerityMs * 0.6)), 0.65)).toFixed(2));
    
    // Concentración de Metales Tóxicos (Pb/As) transportados en el lodo
    const initialPbMgL = 48.5; // Muy alta concentración inicial en relaves
    const localPb = Number((initialPbMgL * Math.exp(-0.015 * pt.kmFromDam)).toFixed(2));

    let status: DamBreakSimulationPoint['status'] = 'Sin Afectación';
    if (idx === 0) status = 'Pico de Inundación';
    else if (idx <= 3) status = 'Onda de Detritos';
    else if (idx <= 6) status = 'Pico de Inundación';
    else status = 'Recesión';

    return {
      timeHours: Number((arrivalTimeMinutes / 60).toFixed(2)),
      peakFlowM3s: localPeakQ,
      floodWaveDepthM: localDepth,
      flowVelocityMs: Number(celerityMs.toFixed(1)),
      heavyMetalsConcentrationMgL: localPb,
      impactZone: pt.zone,
      distanceFromDamKm: pt.kmFromDam,
      arrivalTimeMinutes,
      status,
    };
  });
}
