
export interface GForceData {
  longitudinal: number;
  lateral: number;
  vertical: number;
}

export interface TireLoads {
  fl: number; // Front Left (0-1 normalized)
  fr: number; // Front Right
  rl: number; // Rear Left
  rr: number; // Rear Right
}

export enum FusionTier {
  TIER_1_FULL_FIDELITY = 'TIER_1_FULL_FIDELITY',
  TIER_2_VISION_DEGRADED = 'TIER_2_VISION_DEGRADED',
  TIER_3_DEAD_RECKONING = 'TIER_3_DEAD_RECKONING',
  TIER_4_INITIALIZING = 'TIER_4_INITIALIZING',
}

export interface TelemetryStateObject {
  timestamp: number;
  speed_mps: number;
  acceleration_g: GForceData;
  tire_loads: TireLoads;
  position: { lat: number; long: number };
  slope_percent: number;
  pitch_angle: number;
  inferred_gear: number;
  event: string | null;
  fusionTier: FusionTier;
  rpm: number;
  heading: number;
  prediction: {
      delta: number; // Time difference vs best lap (+/- seconds)
      predictedLapTime: number | null;
  };
  uncertainty_m: number; // EKF estimated position error in meters
}

export interface LapSummary {
  lapNumber: number;
  time: number;
}

export interface RunSummary {
  id: string;
  date: string;
  zeroToSixty: number | null;
  quarterMileTime: number | null;
  quarterMileSpeed: number | null;
  maxSpeed: number;
  maxGForce: GForceData;
  coachingAdvice?: string;
  path: { lat: number; long: number; speed_mps: number }[];
  fullData: TelemetryStateObject[];
  laps: LapSummary[];
}

export enum UnitSystem {
  METRIC = 'METRIC',
  IMPERIAL = 'IMPERIAL',
}

export interface LapData {
    lap: number;
    currentLapTime: number;
    lastLapTime: number | null;
    bestLapTime: number | null;
}
