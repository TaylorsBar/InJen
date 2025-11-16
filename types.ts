
export interface GForceData {
  longitudinal: number;
  lateral: number;
  vertical: number;
}

export enum FusionTier {
  TIER_1_FULL_FIDELITY = 'TIER_1_FULL_FIDELITY',
  TIER_3_DEAD_RECKONING = 'TIER_3_DEAD_RECKONING',
  TIER_4_INITIALIZING = 'TIER_4_INITIALIZING',
}

export interface TelemetryStateObject {
  timestamp: number;
  speed_mps: number;
  acceleration_g: GForceData;
  position: { lat: number; long: number };
  slope_percent: number;
  pitch_angle: number;
  inferred_gear: number;
  event: string | null;
  fusionTier: FusionTier;
  rpm: number;
  heading: number; // Added heading for lap timing vector math
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
