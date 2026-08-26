export type UserRole = 'admin' | 'basin_manager' | 'analyst' | 'field_operator' | 'guest';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  permissions: {
    canRunSimulations: boolean;
    canRunAssimilation: boolean;
    canTriggerScenarios: boolean;
    canGenerateReports: boolean;
    canManageSensors: boolean;
    canEditSystemConfig: boolean;
  };
}

export type WaterQualityParameter =
  | 'discharge'
  | 'stage'
  | 'do'
  | 'ph'
  | 'ec'
  | 'turbidity'
  | 'tss'
  | 'nitrates'
  | 'total_p'
  | 'fecal_coliforms'
  | 'chlorophyll_a'
  | 'heavy_metals_lead'
  | 'wqi';

export interface MonitoringStation {
  id: string;
  code: string;
  name: string;
  subbasin: 'Cuenca Alta (Cabecera)' | 'Cuenca Media (Valles)' | 'Cuenca Baja (Desembocadura)';
  riverReach: string;
  coordinates: {
    lat: number;
    lng: number;
    elevation: number; // m s.n.m.
  };
  grid3D: {
    x: number;
    y: number; // elevation offset
    z: number;
  };
  stationType: 'hydrometric' | 'water_quality' | 'meteorological' | 'combined';
  transmission: 'MQTT' | 'LoRaWAN' | 'Cellular_HTTP' | 'Manual';
  status: 'active' | 'warning' | 'offline';
  lastPing: string;
  currentValues: {
    discharge: number; // m3/s
    stage: number; // m
    do: number; // mg/L
    ph: number; // pH units
    ec: number; // uS/cm
    turbidity: number; // NTU
    tss: number; // mg/L
    nitrates: number; // mg/L
    total_p: number; // mg/L
    fecal_coliforms: number; // NMP/100mL
    chlorophyll_a: number; // ug/L
    heavy_metals_lead: number; // mg/L
    wqi: number; // 0 - 100
  };
  ecaCompliance: {
    isCompliant: boolean;
    violatedParameters: string[];
  };
}

export interface TelemetryRecord {
  timestamp: string;
  stationId: string;
  parameter: WaterQualityParameter;
  rawValue: number;
  validatedValue: number;
  qualityFlag: 'good' | 'suspect_outlier' | 'drift_corrected' | 'imputed';
  unit: string;
}

export interface HydroSimulationResult {
  timestamps: string[];
  precipitation: number[]; // mm/day
  evapotranspiration: number[]; // mm/day
  observedDischarge: number[]; // m3/s
  simulatedPriorDischarge: number[]; // m3/s (before assimilation)
  simulatedPosteriorDischarge: number[]; // m3/s (after EnKF)
  ensembleMembers: number[][]; // 50 members x Timesteps
  boundsP10: number[];
  boundsP50: number[];
  boundsP90: number[];
  metricsPrior: {
    rmse: number;
    nse: number;
    kge: number;
    pbias: number;
    mae: number;
  };
  metricsPosterior: {
    rmse: number;
    nse: number;
    kge: number;
    pbias: number;
    mae: number;
  };
}

export interface EcologicalFlowBenchmark {
  stationId: string;
  stationName: string;
  monthlyRequirements: {
    month: string;
    tennantMin: number; // m3/s (10% - 30% MAF)
    tennantOptimum: number; // m3/s (60% MAF)
    q95: number; // m3/s (95% exceedance)
    q7_10: number; // 7-day 10-year low flow
    wettedPerimeterCriticalQ: number; // m3/s
  }[];
  meanAnnualFlow: number; // m3/s
  currentEcologicalStatus: 'Cumple Óptimo' | 'Cumple Mínimo' | 'Alerta Déficit Moderado' | 'Alerta Déficit Crítico';
  deficitM3s: number;
}

export interface ScenarioDefinition {
  id: string;
  name: string;
  type: 'drought' | 'flash_flood' | 'industrial_spill' | 'climate_change_ssp';
  description: string;
  parameters: {
    deltaPrecipitationPercent: number;
    deltaTemperatureC: number;
    pollutantLoadKgDay?: number;
    irrigationWithdrawalMultiplier: number;
  };
  impactSummary: {
    qPeakChangePercent: number;
    lowFlowDurationDays: number;
    wqiDropPoints: number;
    criticalEflowDaysCount: number;
  };
}

export interface SatelliteLayerData {
  sensor: 'Sentinel-2 L2A' | 'GPM IMERG' | 'Sentinel-1 SAR' | 'SMAP';
  date: string;
  cloudCoverPercent: number;
  resolutionMeters: number;
  indices: {
    ndwiMean: number;
    mndwiMean: number;
    chlorophyllAMeanUgL: number;
    turbidityMeanNTU: number;
    waterSurfaceAreaKm2: number;
  };
  tileBounds: [number, number, number, number];
}

// ==========================================
// NUEVAS FASES: HIDRÁULICA, BALANCE, TRANSPORTE & IA
// ==========================================

export interface RiverCrossSection {
  km: number; // Distancia desde cabecera (0 a 102 km)
  name: string;
  subbasin: string;
  bedElevationM: number; // Cota de fondo (m s.n.m.)
  bankElevationM: number; // Cota de corona de dique / ribera
  manningN: number; // Rugosidad n de Manning
  waterDepthM: number; // Tirante hidráulico y (m)
  waterLevelM: number; // Cota de superficie libre (m s.n.m.)
  flowVelocityMs: number; // Velocidad media del flujo (m/s)
  froudeNumber: number; // Fr = v / sqrt(g*y)
  topWidthM: number; // Espejo de agua (m)
  wettedPerimeterM: number; // Perímetro mojado (m)
  hydraulicRadiusM: number; // Radio hidráulico (m)
  dischargeM3s: number; // Caudal que transita (m3/s)
  floodRiskLevel: 'Bajo' | 'Moderado' | 'Alto' | 'Extremo';
  isOverbankFlooded: boolean;
  freeboardM: number; // Bordo libre restante (m)
}

export interface FloodReturnPeriodSimulation {
  returnPeriodYears: number; // 10, 25, 50, 100, 500 años (El Niño)
  peakDischargeM3s: number;
  totalFloodedAreaHa: number;
  agriculturalAreaLossHa: number;
  urbanAreaAffectedHa: number;
  criticalPoints: string[];
  vulnerableInhabitants: number;
  evacuationRoutesActive: boolean;
}

export interface WaterDemandSector {
  id: string;
  name: string;
  subbasin: string;
  category: 'poblacional' | 'agricola' | 'industrial_minero' | 'ecologico';
  priorityRank: number; // 1: Primario/Ecológico, 2: Poblacional, 3: Agrícola, 4: Minero/Industrial
  concessionCode: string;
  requestedFlowM3s: number;
  allocatedFlowM3s: number;
  intakeName: string;
  intakeKm: number;
  gateStatus: '100% Abierta' | '75% Regulada' | '50% Restringida' | 'Cierre Preventivo';
  annualConcessionHm3: number;
  satisfactionRatePercent: number;
  monthlyConsumptionM3: number[];
}

export interface MonthlyWaterBalance {
  month: string;
  riverInflowHm3: number;
  ecologicalReserveHm3: number;
  poblacionalDemandHm3: number;
  agricolaDemandHm3: number;
  industrialDemandHm3: number;
  totalDemandHm3: number;
  allocatedSupplyHm3: number;
  deficitHm3: number;
  waterStressIndexPercent: number; // Falkenmark stress index
  status: 'Superávit Hídrico' | 'Equilibrio Sostenible' | 'Estrés Moderado' | 'Déficit Crítico';
}

export interface ContaminantDispersionPoint {
  km: number;
  locationName: string;
  subbasin: string;
  leadPb_mgL: number; // Plomo total (Límite ECA Cat 3: 0.05 mg/L, Cat 4: 0.0025 mg/L)
  arsenicAs_mgL: number; // Arsénico (ECA Cat 3: 0.1 mg/L, Cat 4: 0.01 mg/L)
  cadmiumCd_mgL: number; // Cadmio (ECA Cat 3: 0.01 mg/L, Cat 4: 0.00025 mg/L)
  ironFe_mgL: number; // Hierro (ECA Cat 3: 5.0 mg/L)
  ph: number;
  wqi: number;
  tmdlCapacityKgDay: number; // Carga máxima total admisible
  currentPollutantLoadKgDay: number;
  status: 'Conforme ECA' | 'Alerta Leve' | 'Superación Crítica ECA';
}

export type CopilotSpecialistMode =
  | 'general'
  | 'water_quality_dam'
  | 'flood_hydraulics'
  | 'regulatory_legal'
  | 'scada_allocation';

export interface ExecutableAction {
  id: string;
  label: string;
  actionType: 'navigate_tab' | 'run_simulation' | 'open_station' | 'download_dossier' | 'trigger_alert';
  targetTab?: string;
  payload?: any;
}

export interface AICopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  specialistMode?: CopilotSpecialistMode;
  actionProtocol?: {
    title: string;
    level: 'info' | 'warning' | 'critical';
    steps: string[];
    affectedZones: string[];
    recommendedGateActions: string[];
  };
  executableActions?: ExecutableAction[];
  citations?: string[];
}

export interface EarlyWarningThreshold {
  id: string;
  parameter: 'discharge_q' | 'water_level_h' | 'lead_pb' | 'arsenic_as' | 'ph_acid';
  name: string;
  unit: string;
  stationName: string;
  stationKm: number;
  greenLimit: number;
  yellowLimit: number;
  orangeLimit: number;
  redLimit: number;
  currentValue: number;
  currentAlertLevel: 'VERDE' | 'AMARILLO' | 'NARANJA' | 'ROJO';
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface CAPAlertBroadcast {
  identifier: string;
  sender: string;
  sentTime: string;
  status: 'Actual' | 'Exercise' | 'Test';
  msgType: 'Alert' | 'Update' | 'Cancel';
  scope: 'Public' | 'Restricted';
  category: 'Met' | 'Env' | 'Safety' | 'Geo';
  urgency: 'Immediate' | 'Expected' | 'Future';
  severity: 'Extreme' | 'Severe' | 'Moderate' | 'Minor';
  certainty: 'Observed' | 'Likely' | 'Possible';
  event: string;
  headline: string;
  description: string;
  instruction: string;
  areaDesc: string;
  polygonGeoJSON?: string;
  targetPopulation: number;
  disseminationChannels: ('SMS_CellBroadcast' | 'COER_INDECI_Link' | 'Acoustic_Sirens' | 'Radio_FM_VHF')[];
  statusDelivery: 'Emitido y Difundido' | 'En Cola' | 'Borrador';
}

export interface AcousticSirenNode {
  id: string;
  name: string;
  locationKm: number;
  zone: string;
  populationCovered: number;
  acousticRangeMeters: number;
  powerStatus: 'Solar/Batería 100%' | 'Red Eléctrica' | 'Batería de Respaldo 74%';
  telemetryLink: 'Radio VHF 450MHz' | 'Satélite Iridium' | '4G LTE';
  state: 'Silencioso (Standby)' | 'Pre-Alerta Sonora' | 'Evacuación Inmediata (115dB)' | 'Prueba Técnica';
  lastPing: string;
}


export interface HydraulicStructureSCADA {
  id: string;
  name: string;
  type: 'bocatoma' | 'represa_relaves' | 'canal_principal' | 'desarenador' | 'aliviadero';
  locationKm: number;
  subbasin: string;
  status: 'normal' | 'alerta' | 'emergencia' | 'mantenimiento';
  waterLevelM: number;
  maxDesignLevelM: number;
  inflowM3s: number;
  outflowM3s: number;
  sedimentDepositionPercent: number;
  gates: {
    gateId: string;
    gateName: string;
    gateType: 'radial' | 'deslizante' | 'vagón';
    openingPercent: number;
    flowPassingM3s: number;
    remoteControlEnabled: boolean;
  }[];
  actuatorStatus: 'En Línea (PLC Modbus TCP)' | 'Manual Local' | 'Falla Comunicación';
}

export interface DamBreakSimulationPoint {
  timeHours: number;
  peakFlowM3s: number;
  floodWaveDepthM: number;
  flowVelocityMs: number;
  heavyMetalsConcentrationMgL: number;
  impactZone: string;
  distanceFromDamKm: number;
  arrivalTimeMinutes: number;
  status: 'Sin Afectación' | 'Onda de Detritos' | 'Pico de Inundación' | 'Recesión';
}

export interface GroundwaterWell {
  id: string;
  code: string;
  name: string;
  sector: string;
  distanceToCoastKm: number;
  depthMeters: number;
  waterTableDepthM: number; // Nivel freático (m bajo superficie)
  hydraulicHeadMsl: number; // Cota piezométrica (msnm)
  extractionRateLs: number; // Tasa de bombeo (L/s)
  electricalConductivityUsCm: number; // Conductividad eléctrica (uS/cm)
  chloridesMgL: number; // Cloruros (mg/L)
  salinityRisk: 'Normal' | 'Leve' | 'Moderada' | 'Severa (Intrusión)';
  irrigationSuitability: 'Apto Sin Restricción' | 'Apto con Drenaje' | 'Restringido (Palto/Espárrago)' | 'No Apto (Salinizado)';
  latitude: number;
  longitude: number;
}

export interface AquiferRechargeBalance {
  naturalRechargeHm3: number;
  riverBedInfiltrationHm3: number;
  irrigationReturnHm3: number;
  agriculturalPumpingHm3: number;
  industrialPumpingHm3: number;
  domesticPumpingHm3: number;
  netAquiferBalanceHm3: number;
  saltWedgeInlandPenetrationKm: number;
}

export interface CalibrationParameter {
  id: string;
  name: string;
  symbol: string;
  description: string;
  unit: string;
  minBound: number;
  maxBound: number;
  initialValue: number;
  optimizedValue: number;
  sobolFirstOrderIndex: number; // S_i (0 a 1)
  sobolTotalOrderIndex: number; // S_Ti (0 a 1)
  sensitivityCategory: 'Alta' | 'Media' | 'Baja';
}

export interface CalibrationIterationStep {
  iteration: number;
  complex: number;
  nse: number; // Nash-Sutcliffe Efficiency (-inf a 1.0)
  kge: number; // Kling-Gupta Efficiency (-inf a 1.0)
  pbias: number; // Percent Bias (%)
  rmse: number; // Root Mean Square Error (m3/s)
  currentBestParams: { [key: string]: number };
}

export interface HydroCalibrationResult {
  algorithm: 'SCE-UA' | 'MCMC-DREAM' | 'PSO' | 'Genetic_Algorithm';
  status: 'convergido' | 'calibrando' | 'pausado' | 'inicial';
  totalEvaluations: number;
  totalComplexes: number;
  pointsPerComplex: number;
  bestNSE: number;
  bestKGE: number;
  bestPBIAS: number;
  bestRMSE: number;
  parameters: CalibrationParameter[];
  history: CalibrationIterationStep[];
  observedVsSimulated: {
    day: number;
    observedQ: number;
    initialSimulatedQ: number;
    calibratedSimulatedQ: number;
    precipitationMm: number;
  }[];
}

export interface OfficialReport {
  id: string;
  code: string;
  entity: 'ANA' | 'OEFA' | 'SENAMHI' | 'INDECI' | 'SEDALIB' | 'MIDAGRI';
  title: string;
  reportType: 'Auditoría Hidrológica' | 'Cumplimiento ECA-Agua & Metales' | 'Alerta de Inundación FEN' | 'Balance Piezométrico y Salinidad' | 'Seguridad de Presas';
  issueDate: string;
  generatedBy: string;
  digitalSignatureHash: string;
  status: 'Aprobado & Sellado' | 'En Revisión Técnica' | 'Emitido Oficialmente';
  executiveSummary: string;
  keyMetrics: { [key: string]: string | number };
  recommendations: string[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId?: string;
  userName: string;
  role: UserRole;
  action: string;
  module: string;
  details: string;
}
