
import {
  VEHICLE_MASS_KG,
  DRAG_COEFFICIENT,
  FRONTAL_AREA_M2,
  ROLLING_RESISTANCE_COEFFICIENT,
  AIR_DENSITY_KG_M3,
  GRAVITY_MS2,
  FINAL_DRIVE_RATIO,
  GEAR_RATIOS,
  SHIFT_RPM,
  IDLE_RPM,
  MAX_RPM,
  WHEEL_RADIUS_M,
  SHIFT_TIME_MS,
} from '../constants';
import { TireLoads } from '../types';

export class VehiclePhysics {
  // State
  speed_mps: number = 0;
  rpm: number = 0;
  gear: number = 1;

  // Internal state
  private isShifting: boolean = false;
  private shiftTimer: number = 0;
  private throttle: number = 0; // 0 to 1

  reset() {
    this.speed_mps = 0;
    this.rpm = IDLE_RPM;
    this.gear = 1;
    this.isShifting = false;
    this.shiftTimer = 0;
    this.throttle = 0;
  }

  setThrottle(value: number) {
    this.throttle = Math.max(0, Math.min(1, value));
  }
  
  // New method to override physics state with real OBD data
  overrideState(speedMps: number, rpm: number) {
      this.speed_mps = speedMps;
      this.rpm = rpm;
      // Infer gear based on speed/rpm relationship if needed, 
      // but for now we keep the physics engine's gear logic or reset it.
  }

  update(dt_ms: number, useSimulatedPhysics: boolean = true) {
    const dt_s = dt_ms / 1000.0;
    let acceleration_ms2 = 0;
    let nextEvent: string | null = null;

    if (useSimulatedPhysics) {
        // Handle gear shifting logic
        if (this.isShifting) {
        this.shiftTimer -= dt_ms;
        if (this.shiftTimer <= 0) {
            this.isShifting = false;
        }
        } else {
        if (this.rpm > SHIFT_RPM && this.gear < GEAR_RATIOS.length - 1) {
            this.startShift(this.gear + 1);
        }
        }

        // Calculate forces
        const engineTorque = this.isShifting ? 0 : this.calculateEngineTorque();
        const driveForce = (engineTorque * GEAR_RATIOS[this.gear] * FINAL_DRIVE_RATIO) / WHEEL_RADIUS_M;

        const dragForce = 0.5 * AIR_DENSITY_KG_M3 * this.speed_mps * this.speed_mps * DRAG_COEFFICIENT * FRONTAL_AREA_M2;
        const rollingResistance = ROLLING_RESISTANCE_COEFFICIENT * VEHICLE_MASS_KG * GRAVITY_MS2;
        const netForce = driveForce - dragForce - rollingResistance;

        // Calculate acceleration and new speed
        acceleration_ms2 = netForce / VEHICLE_MASS_KG;
        this.speed_mps += acceleration_ms2 * dt_s;
        if (this.speed_mps < 0) this.speed_mps = 0;

        // Calculate new RPM
        this.rpm = this.calculateRPM();
        if (this.rpm > MAX_RPM) {
            this.rpm = MAX_RPM;
        }

        nextEvent = this.isShifting ? `SHIFT ${this.gear - 1} > ${this.gear}` : null;
    } else {
        // In OBD mode, we derive acceleration from speed change over time (backward differentiation)
        // This is handled in the main loop or sensor fusion, but we can reset internal forces here.
        // We update inferred gear based on ratio.
        this.gear = this.inferGearFromRpmSpeed(this.rpm, this.speed_mps);
    }
    
    // --- Advanced Sensor Fusion Simulation ---
    // If using physics, acceleration is calculated.
    // If using OBD, acceleration must be derived or provided by IMU external to this class.
    // Here we calculate the Gs based on the 'acceleration_ms2' derived above ONLY if simulating.
    // If OBD is active, the caller usually overwrites G-force with IMU data.
    
    const longitudinalG = acceleration_ms2 / GRAVITY_MS2;
    // Simulate lateral G based on a mock cornering model (purely for demo visuals)
    const lateralG = (Math.random() - 0.5) * 0.2 * (this.speed_mps / 30) + (Math.sin(Date.now() / 2000) * (this.speed_mps / 100));
    
    // Simulate pitch based on longitudinal acceleration (approx 2 degrees per G)
    const pitch_angle = longitudinalG * 2.0;

    const tireLoads = this.calculateWeightTransfer(longitudinalG, lateralG);

    return {
      speed_mps: this.speed_mps,
      acceleration_g: {
        longitudinal: longitudinalG,
        lateral: lateralG,
        vertical: 1 + (Math.random() - 0.5) * 0.05,
      },
      tire_loads: tireLoads,
      rpm: this.rpm,
      inferred_gear: this.gear,
      pitch_angle,
      event: nextEvent,
    };
  }
  
  // Calculates virtual load on tires (0.0 to 2.0, where 1.0 is static load)
  private calculateWeightTransfer(longG: number, latG: number): TireLoads {
      // Constants for weight transfer (simplified)
      // Weight moves opposite to acceleration
      const pitchFactor = 0.3; // Sensitivity of pitch weight transfer
      const rollFactor = 0.3;  // Sensitivity of roll weight transfer
      
      const deltaFront = -longG * pitchFactor;
      const deltaRear = longG * pitchFactor;
      
      const deltaLeft = latG * rollFactor;
      const deltaRight = -latG * rollFactor;
      
      return {
          fl: Math.max(0.1, 1.0 + deltaFront + deltaLeft),
          fr: Math.max(0.1, 1.0 + deltaFront + deltaRight),
          rl: Math.max(0.1, 1.0 + deltaRear + deltaLeft),
          rr: Math.max(0.1, 1.0 + deltaRear + deltaRight),
      };
  }

  private startShift(newGear: number) {
    this.isShifting = true;
    this.shiftTimer = SHIFT_TIME_MS;
    this.gear = newGear;
  }

  private calculateEngineTorque(): number {
    if (this.rpm < IDLE_RPM) return 0;
    const peakTorqueRpm = 4500;
    const maxTorque = 400;
    const rpmFactor = 1 - Math.pow((this.rpm - peakTorqueRpm) / (MAX_RPM - peakTorqueRpm + 1000), 2);
    return Math.max(0, maxTorque * rpmFactor * this.throttle);
  }

  private calculateRPM(): number {
      if (this.speed_mps < 0.1) return IDLE_RPM;
      const wheelRpm = (this.speed_mps / (2 * Math.PI * WHEEL_RADIUS_M)) * 60;
      const engineRpm = wheelRpm * GEAR_RATIOS[this.gear] * FINAL_DRIVE_RATIO;
      return Math.max(IDLE_RPM, engineRpm);
  }

  private inferGearFromRpmSpeed(rpm: number, speed_mps: number): number {
      if (speed_mps < 1) return 1;
      // Ratio = EngineRPM / WheelRPM
      const wheelRpm = (speed_mps / (2 * Math.PI * WHEEL_RADIUS_M)) * 60;
      const currentRatio = rpm / (wheelRpm * FINAL_DRIVE_RATIO);
      
      // Find closest gear
      let closestGear = 1;
      let minDiff = 100;
      
      for(let i=1; i<GEAR_RATIOS.length; i++) {
          const diff = Math.abs(currentRatio - GEAR_RATIOS[i]);
          if(diff < minDiff) {
              minDiff = diff;
              closestGear = i;
          }
      }
      return closestGear;
  }
}
