/**
 * EnkfEngine - Ensemble Kalman Filter (EnKF) para Asimilación de Datos Hidrológicos
 * Acoplado secuencialmente al modelo hidrológico GR4J con cuantificación de incertidumbre.
 *
 * Implementa la formulación estocástica de Evensen (2003 / 2009):
 * 1. Propagación del ensamble de estados con ruido en forzamientos (P y PET).
 * 2. Perturbación de observaciones con matriz de covarianza de error R.
 * 3. Cálculo de la ganancia de Kalman: K = P * H^T * (H * P * H^T + R)^-1
 * 4. Actualización del estado a posteriori y re-inyección en las reservas del modelo.
 */

import {
  GR4JParameters,
  GR4JState,
  calculateUnitHydrographs,
  gr4jStep,
  DEFAULT_MOCHE_GR4J_PARAMS,
} from './hydroEngine';
import { HydroSimulationResult } from '../types';

export interface EnKFConfig {
  ensembleSize: number; // N = 50
  precipErrorCoeffVar: number; // 0.20 (20% error log-normal)
  obsErrorCoeffVar: number; // 0.10 (10% error en aforos/sensores)
  parameterPerturbation: boolean;
}

export const DEFAULT_ENKF_CONFIG: EnKFConfig = {
  ensembleSize: 50,
  precipErrorCoeffVar: 0.20,
  obsErrorCoeffVar: 0.10,
  parameterPerturbation: true,
};

// Generador de números aleatorios normales (Box-Muller)
function randomGaussian(mean = 0, stdev = 1): number {
  let u = 1 - Math.random();
  let v = Math.random();
  let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * stdev;
}

/**
 * Calcula métricas estadísticas hidrológicas
 */
export function calculateHydroMetrics(observed: number[], simulated: number[]) {
  const n = observed.length;
  if (n === 0) return { rmse: 0, nse: 0, kge: 0, pbias: 0, mae: 0 };

  const obsMean = observed.reduce((a, b) => a + b, 0) / n;
  const simMean = simulated.reduce((a, b) => a + b, 0) / n;

  let sumSqErr = 0;
  let sumSqObsDev = 0;
  let sumAbsErr = 0;
  let sumObs = 0;
  let sumSim = 0;
  let sumObsSimDev = 0;
  let sumSimDevSq = 0;

  for (let i = 0; i < n; i++) {
    const o = observed[i];
    const s = simulated[i];
    const err = o - s;
    sumSqErr += err * err;
    sumSqObsDev += Math.pow(o - obsMean, 2);
    sumAbsErr += Math.abs(err);
    sumObs += o;
    sumSim += s;

    sumObsSimDev += (o - obsMean) * (s - simMean);
    sumSimDevSq += Math.pow(s - simMean, 2);
  }

  const rmse = Math.sqrt(sumSqErr / n);
  const mae = sumAbsErr / n;
  const nse = sumSqObsDev !== 0 ? 1 - sumSqErr / sumSqObsDev : 0;
  const pbias = sumObs !== 0 ? ((sumObs - sumSim) / sumObs) * 100 : 0;

  // Kling-Gupta Efficiency (KGE)
  const obsStd = Math.sqrt(sumSqObsDev / n);
  const simStd = Math.sqrt(sumSimDevSq / n);
  const r = (obsStd * simStd !== 0) ? (sumObsSimDev / n) / (obsStd * simStd) : 0;
  const alpha = obsStd !== 0 ? simStd / obsStd : 1;
  const beta = obsMean !== 0 ? simMean / obsMean : 1;
  const kge = 1 - Math.sqrt(Math.pow(r - 1, 2) + Math.pow(alpha - 1, 2) + Math.pow(beta - 1, 2));

  return {
    rmse: Number(rmse.toFixed(3)),
    nse: Number(Math.max(-1, nse).toFixed(3)),
    kge: Number(Math.max(-1, kge).toFixed(3)),
    pbias: Number(pbias.toFixed(2)),
    mae: Number(mae.toFixed(3)),
  };
}

/**
 * Ejecuta Asimilación de Datos con Ensemble Kalman Filter
 */
export function runEnKFAssimilation(
  dates: string[],
  precipitationSeries: number[],
  petSeries: number[],
  observedDischargeSeries: number[],
  baseParams: GR4JParameters = DEFAULT_MOCHE_GR4J_PARAMS,
  config: EnKFConfig = DEFAULT_ENKF_CONFIG
): HydroSimulationResult {
  const T = precipitationSeries.length;
  const N = config.ensembleSize;

  // 1. Simulación Open-Loop (Prior sin asimilación)
  const priorSim = new Array(T).fill(0);
  const { uh1, uh2 } = calculateUnitHydrographs(baseParams.x4);

  let openLoopState: GR4JState = {
    productionStore: baseParams.x1 * 0.5,
    routingStore: baseParams.x3 * 0.5,
    uh1State: new Array(uh1.length).fill(0),
    uh2State: new Array(uh2.length).fill(0),
  };

  for (let t = 0; t < T; t++) {
    const step = gr4jStep(precipitationSeries[t], petSeries[t], openLoopState, baseParams, uh1, uh2);
    openLoopState = step.newState;
    priorSim[t] = Number(step.dischargeM3s.toFixed(3));
  }

  // 2. Inicialización del Ensamble EnKF
  interface EnsembleMember {
    params: GR4JParameters;
    state: GR4JState;
    currentQ: number;
    historyQ: number[];
  }

  const ensemble: EnsembleMember[] = [];
  for (let i = 0; i < N; i++) {
    // Perturbación de parámetros si está habilitado
    const paramPerturb = config.parameterPerturbation
      ? 1 + randomGaussian(0, 0.08)
      : 1.0;

    const memberParams: GR4JParameters = {
      x1: Math.max(50, baseParams.x1 * paramPerturb),
      x2: baseParams.x2 + randomGaussian(0, 0.15),
      x3: Math.max(10, baseParams.x3 * (1 + randomGaussian(0, 0.08))),
      x4: Math.max(0.5, baseParams.x4 * (1 + randomGaussian(0, 0.05))),
      catchmentAreaKm2: baseParams.catchmentAreaKm2,
    };

    ensemble.push({
      params: memberParams,
      state: {
        productionStore: memberParams.x1 * (0.5 + randomGaussian(0, 0.05)),
        routingStore: memberParams.x3 * (0.5 + randomGaussian(0, 0.05)),
        uh1State: new Array(uh1.length).fill(0),
        uh2State: new Array(uh2.length).fill(0),
      },
      currentQ: 0,
      historyQ: [],
    });
  }

  const posteriorMean = new Array(T).fill(0);
  const boundsP10 = new Array(T).fill(0);
  const boundsP50 = new Array(T).fill(0);
  const boundsP90 = new Array(T).fill(0);
  const ensembleHistoryMatrix: number[][] = [];

  for (let i = 0; i < N; i++) {
    ensembleHistoryMatrix.push(new Array(T).fill(0));
  }

  // 3. Bucle temporal con predicción y actualización EnKF
  for (let t = 0; t < T; t++) {
    const pNominal = precipitationSeries[t];
    const petNominal = petSeries[t];
    const yObs = observedDischargeSeries[t];

    // Paso A: Propagación hacia adelante del ensamble (Forecast Step)
    for (let i = 0; i < N; i++) {
      // Perturbación estocástica de forzamientos meteorológicos
      const pPerturbed = Math.max(0, pNominal * Math.exp(randomGaussian(0, config.precipErrorCoeffVar)));
      const petPerturbed = Math.max(0, petNominal * (1 + randomGaussian(0, 0.10)));

      const step = gr4jStep(
        pPerturbed,
        petPerturbed,
        ensemble[i].state,
        ensemble[i].params,
        uh1,
        uh2
      );

      ensemble[i].state = step.newState;
      ensemble[i].currentQ = step.dischargeM3s;
    }

    // Paso B: Asimilación y actualización Kalman (Update Step)
    if (yObs !== undefined && !isNaN(yObs) && yObs > 0) {
      // Vector de observaciones simuladas por el ensamble
      const simulatedQs = ensemble.map(m => m.currentQ);
      const meanSimQ = simulatedQs.reduce((a, b) => a + b, 0) / N;

      // Estados de los reservorios
      const storeSs = ensemble.map(m => m.state.productionStore);
      const storeRs = ensemble.map(m => m.state.routingStore);

      const meanS = storeSs.reduce((a, b) => a + b, 0) / N;
      const meanR = storeRs.reduce((a, b) => a + b, 0) / N;

      // Covarianza cruzada Cov(S, Q) y Cov(R, Q) y Varianza Var(Q)
      let varQ = 0;
      let covSQ = 0;
      let covRQ = 0;

      for (let i = 0; i < N; i++) {
        const qDev = simulatedQs[i] - meanSimQ;
        varQ += qDev * qDev;
        covSQ += (storeSs[i] - meanS) * qDev;
        covRQ += (storeRs[i] - meanR) * qDev;
      }
      varQ /= (N - 1);
      covSQ /= (N - 1);
      covRQ /= (N - 1);

      // Varianza del error de observación R_obs
      const obsErrorVariance = Math.pow(Math.max(0.2, yObs * config.obsErrorCoeffVar), 2);

      // Ganancia de Kalman para los reservorios
      const kalmanGainS = covSQ / (varQ + obsErrorVariance);
      const kalmanGainR = covRQ / (varQ + obsErrorVariance);
      const kalmanGainQ = varQ / (varQ + obsErrorVariance);

      // Actualización de cada miembro con observación perturbada
      for (let i = 0; i < N; i++) {
        const perturbedObs = yObs + randomGaussian(0, Math.sqrt(obsErrorVariance));
        const innovation = perturbedObs - ensemble[i].currentQ;

        // Actualizar estados internos
        ensemble[i].state.productionStore = Math.max(
          10,
          Math.min(ensemble[i].params.x1, ensemble[i].state.productionStore + kalmanGainS * innovation)
        );
        ensemble[i].state.routingStore = Math.max(
          1,
          Math.min(ensemble[i].params.x3 * 2, ensemble[i].state.routingStore + kalmanGainR * innovation)
        );

        // Actualizar caudal estimado posterior
        ensemble[i].currentQ = Math.max(0.01, ensemble[i].currentQ + kalmanGainQ * innovation);
      }
    }

    // Registro de percentiles y medias del ensamble para el instante t
    const currentMemberQs = ensemble.map(m => m.currentQ).sort((a, b) => a - b);
    const mean = currentMemberQs.reduce((a, b) => a + b, 0) / N;

    posteriorMean[t] = Number(mean.toFixed(3));
    boundsP10[t] = Number(currentMemberQs[Math.floor(N * 0.10)].toFixed(3));
    boundsP50[t] = Number(currentMemberQs[Math.floor(N * 0.50)].toFixed(3));
    boundsP90[t] = Number(currentMemberQs[Math.floor(N * 0.90)].toFixed(3));

    for (let i = 0; i < N; i++) {
      ensembleHistoryMatrix[i][t] = Number(currentMemberQs[i].toFixed(3));
    }
  }

  // 4. Métricas antes y después de asimilación
  const metricsPrior = calculateHydroMetrics(observedDischargeSeries, priorSim);
  const metricsPosterior = calculateHydroMetrics(observedDischargeSeries, posteriorMean);

  return {
    timestamps: dates,
    precipitation: precipitationSeries,
    evapotranspiration: petSeries,
    observedDischarge: observedDischargeSeries,
    simulatedPriorDischarge: priorSim,
    simulatedPosteriorDischarge: posteriorMean,
    ensembleMembers: ensembleHistoryMatrix,
    boundsP10,
    boundsP50,
    boundsP90,
    metricsPrior,
    metricsPosterior,
  };
}
