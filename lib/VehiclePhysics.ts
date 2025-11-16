
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

  update(dt_ms: number) {
    const dt_s = dt_ms / 1000.0;

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
    const acceleration_ms2 = netForce / VEHICLE_MASS_KG;
    this.speed_mps += acceleration_ms2 * dt_s;
    if (this.speed_mps < 0) this.speed_mps = 0;

    // Calculate new RPM
    this.rpm = this.calculateRPM();
    if (this.rpm > MAX_RPM) {
        this.rpm = MAX_RPM;
        // Could also implement a rev limiter logic here
    }

    const nextEvent = this.isShifting ? `SHIFT ${this.gear - 1} > ${this.gear}` : null;
    
    return {
      speed_mps: this.speed_mps,
      acceleration_g: {
        longitudinal: acceleration_ms2 / GRAVITY_MS2,
        lateral: (Math.random() - 0.5) * 0.1 * (this.speed_mps / 50), // Scale lateral G with speed
        vertical: 1 + (Math.random() - 0.5) * 0.05,
      },
      rpm: this.rpm,
      inferred_gear: this.gear,
      event: nextEvent,
    };
  }
  
  private startShift(newGear: number) {
    this.isShifting = true;
    this.shiftTimer = SHIFT_TIME_MS;
    this.gear = newGear;
  }

  // Simplified engine torque curve: more torque at mid-range RPM
  private calculateEngineTorque(): number {
    if (this.rpm < IDLE_RPM) return 0;
    
    // Peak torque at 4500 RPM, max 400 Nm
    const peakTorqueRpm = 4500;
    const maxTorque = 400;

    // A simple parabolic curve for torque
    const rpmFactor = 1 - Math.pow((this.rpm - peakTorqueRpm) / (MAX_RPM - peakTorqueRpm + 1000), 2);
    return Math.max(0, maxTorque * rpmFactor * this.throttle);
  }

  private calculateRPM(): number {
      if (this.speed_mps < 0.1) return IDLE_RPM;
      const wheelRpm = (this.speed_mps / (2 * Math.PI * WHEEL_RADIUS_M)) * 60;
      const engineRpm = wheelRpm * GEAR_RATIOS[this.gear] * FINAL_DRIVE_RATIO;
      return Math.max(IDLE_RPM, engineRpm);
  }
}
