/**
 * HydroEngine - Implementación del Modelo Hidrológico GR4J (Génie Rural à 4 paramètres Journalier)
 * Perrin et al. (2003) adaptado para cuencas andino-costeras (Cuenca del Río Moche).
 *
 * Parámetros:
 * - X1: Capacidad del reservorio de producción (suelo) [mm] (rango típico: 100 - 1200)
 * - X2: Coeficiente de intercambio de agua subterránea [mm/día] (rango típico: -5.0 a 5.0)
 * - X3: Capacidad máxima del reservorio de ruteo [mm] (rango típico: 20 - 500)
 * - X4: Tiempo base del hidrograma unitario UH1 [días] (rango típico: 0.5 - 4.0)
 */

export interface GR4JParameters {
  x1: number; // mm
  x2: number; // mm/day
  x3: number; // mm
  x4: number; // days
  catchmentAreaKm2: number; // km2 (Moche: 2708 km2)
}

export interface GR4JState {
  productionStore: number; // S [mm]
  routingStore: number;    // R [mm]
  uh1State: number[];      // memoria de ordenadas de UH1
  uh2State: number[];      // memoria de ordenadas de UH2
}

export const DEFAULT_MOCHE_GR4J_PARAMS: GR4JParameters = {
  x1: 420.5,
  x2: -0.85,
  x3: 88.0,
  x4: 1.65,
  catchmentAreaKm2: 2708.0,
};

/**
 * Calcula las ordenadas de los hidrogramas unitarios UH1 y UH2
 */
export function calculateUnitHydrographs(x4: number): { uh1: number[]; uh2: number[] } {
  const n1 = Math.ceil(x4);
  const n2 = Math.ceil(2 * x4);
  const uh1 = new Array(n1).fill(0);
  const uh2 = new Array(n2).fill(0);

  // S-curves para UH1
  const sCurves1 = (t: number) => {
    if (t <= 0) return 0;
    if (t < x4) return Math.pow(t / x4, 2.5);
    return 1.0;
  };

  // S-curves para UH2
  const sCurves2 = (t: number) => {
    if (t <= 0) return 0;
    if (t <= x4) return 0.5 * Math.pow(t / x4, 2.5);
    if (t < 2 * x4) return 1.0 - 0.5 * Math.pow(2.0 - t / x4, 2.5);
    return 1.0;
  };

  for (let i = 1; i <= n1; i++) {
    uh1[i - 1] = sCurves1(i) - sCurves1(i - 1);
  }

  for (let i = 1; i <= n2; i++) {
    uh2[i - 1] = sCurves2(i) - sCurves2(i - 1);
  }

  return { uh1, uh2 };
}

/**
 * Ejecuta un paso de tiempo diario del modelo GR4J
 */
export function gr4jStep(
  precipitation: number, // P [mm/day]
  potentialET: number,   // E [mm/day]
  state: GR4JState,
  params: GR4JParameters,
  uh1: number[],
  uh2: number[]
): { dischargeM3s: number; newState: GR4JState; netRain: number; actualET: number } {
  let S = state.productionStore;
  let R = state.routingStore;
  const { x1, x2, x3, catchmentAreaKm2 } = params;

  let netRain = 0;
  let actualET = 0;
  let Pn = 0;
  let En = 0;

  if (precipitation >= potentialET) {
    Pn = precipitation - potentialET;
    En = 0;
    const ws = Pn / x1;
    const tanws = Math.tanh(ws);
    const Ps = (x1 * (1 - Math.pow(S / x1, 2)) * tanws) / (1 + (S / x1) * tanws);
    Pn = Pn - Ps;
    S = S + Ps;
  } else {
    Pn = 0;
    En = potentialET - precipitation;
    const ws = En / x1;
    const tanws = Math.tanh(ws);
    const Es = (S * (2 - S / x1) * tanws) / (1 + (1 - S / x1) * tanws);
    actualET = precipitation + Es;
    S = S - Es;
  }

  // Percolación desde el reservorio de producción
  const perc = S * (1 - Math.pow(1 + Math.pow((4.0 / 9.0) * (S / x1), 4), -0.25));
  S = S - perc;
  const Pr = Pn + perc;

  // Convolución con Hidrogramas Unitarios
  // UH1 recibe el 90% del flujo, UH2 recibe el 10%
  const uh1State = [...state.uh1State];
  const uh2State = [...state.uh2State];

  let Q9 = 0;
  for (let i = 0; i < uh1.length; i++) {
    uh1State[i] = (uh1State[i] || 0) + 0.9 * Pr * uh1[i];
  }
  Q9 = uh1State[0] || 0;
  uh1State.shift();
  uh1State.push(0);

  let Q1 = 0;
  for (let i = 0; i < uh2.length; i++) {
    uh2State[i] = (uh2State[i] || 0) + 0.1 * Pr * uh2[i];
  }
  Q1 = uh2State[0] || 0;
  uh2State.shift();
  uh2State.push(0);

  // Intercambio subterráneo F
  const F = x2 * Math.pow(R / x3, 3.5);

  // Reservorio de ruteo R
  R = Math.max(0, R + Q9 + F);
  const Qr = R * (1 - Math.pow(1 + Math.pow(R / x3, 4), -0.25));
  R = R - Qr;

  // Componente de flujo directo Qd
  const Qd = Math.max(0, Q1 + F);

  // Escurrimiento total en mm/día
  const totalRunoffMm = Qr + Qd;

  // Conversión de mm/día a m3/s para el área de la cuenca
  // Q (m3/s) = (mm/día * 1e-3 m/mm * Area km2 * 1e6 m2/km2) / (86400 s/día)
  const dischargeM3s = (totalRunoffMm * catchmentAreaKm2 * 1000) / 86400;

  return {
    dischargeM3s: Math.max(0.01, dischargeM3s),
    netRain,
    actualET,
    newState: {
      productionStore: S,
      routingStore: R,
      uh1State,
      uh2State,
    },
  };
}

/**
 * Ejecuta una simulación temporal completa con GR4J
 */
export function runGR4JSimulation(
  precipitationSeries: number[],
  petSeries: number[],
  params: GR4JParameters = DEFAULT_MOCHE_GR4J_PARAMS,
  initialStoreFraction = 0.5
): number[] {
  const { uh1, uh2 } = calculateUnitHydrographs(params.x4);

  let state: GR4JState = {
    productionStore: params.x1 * initialStoreFraction,
    routingStore: params.x3 * initialStoreFraction,
    uh1State: new Array(uh1.length).fill(0),
    uh2State: new Array(uh2.length).fill(0),
  };

  const discharges: number[] = [];

  for (let t = 0; t < precipitationSeries.length; t++) {
    const p = precipitationSeries[t];
    const pet = petSeries[t];
    const stepResult = gr4jStep(p, pet, state, params, uh1, uh2);
    state = stepResult.newState;
    discharges.push(Number(stepResult.dischargeM3s.toFixed(3)));
  }

  return discharges;
}
