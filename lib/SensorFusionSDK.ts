
import { FusionTier } from "../types";

/**
 * Robust Matrix Math Implementation for 12-State EKF
 */
export class Matrix {
  data: number[][];
  rows: number;
  cols: number;

  constructor(rows: number, cols: number, data?: number[][]) {
    this.rows = rows;
    this.cols = cols;
    this.data = data || Array(rows).fill(0).map(() => Array(cols).fill(0));
  }

  static identity(size: number): Matrix {
    const m = new Matrix(size, size);
    for (let i = 0; i < size; i++) m.data[i][i] = 1;
    return m;
  }

  static zero(rows: number, cols: number): Matrix {
    return new Matrix(rows, cols);
  }

  multiply(other: Matrix): Matrix {
    if (this.cols !== other.rows) throw new Error(`Matrix dimension mismatch: ${this.rows}x${this.cols} vs ${other.rows}x${other.cols}`);
    const result = new Matrix(this.rows, other.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < other.cols; j++) {
        let sum = 0;
        for (let k = 0; k < this.cols; k++) {
          sum += this.data[i][k] * other.data[k][j];
        }
        result.data[i][j] = sum;
      }
    }
    return result;
  }

  multiplyScalar(scalar: number): Matrix {
    const result = new Matrix(this.rows, this.cols);
    for (let i = 0; i < this.rows; i++) {
        for(let j = 0; j < this.cols; j++) {
            result.data[i][j] = this.data[i][j] * scalar;
        }
    }
    return result;
  }

  add(other: Matrix): Matrix {
    if (this.rows !== other.rows || this.cols !== other.cols) throw new Error("Matrix dimension mismatch for add");
    const result = new Matrix(this.rows, this.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        result.data[i][j] = this.data[i][j] + other.data[i][j];
      }
    }
    return result;
  }

  subtract(other: Matrix): Matrix {
    if (this.rows !== other.rows || this.cols !== other.cols) throw new Error("Matrix dimension mismatch for subtract");
    const result = new Matrix(this.rows, this.cols);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        result.data[i][j] = this.data[i][j] - other.data[i][j];
      }
    }
    return result;
  }

  transpose(): Matrix {
    const result = new Matrix(this.cols, this.rows);
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        result.data[j][i] = this.data[i][j];
      }
    }
    return result;
  }

  // Gaussian elimination for general matrix inversion
  inverse(): Matrix {
    if (this.rows !== this.cols) throw new Error("Matrix must be square");
    const n = this.rows;
    const result = Matrix.identity(n);
    const copy = new Matrix(n, n);
    
    // Deep copy data
    for(let i=0; i<n; i++) for(let j=0; j<n; j++) copy.data[i][j] = this.data[i][j];

    for (let i = 0; i < n; i++) {
      let pivot = copy.data[i][i];
      if (Math.abs(pivot) < 1e-10) {
          // Attempt to swap with a lower row
          let swapped = false;
          for(let k=i+1; k<n; k++) {
              if(Math.abs(copy.data[k][i]) > 1e-10) {
                  // Swap rows in copy
                  [copy.data[i], copy.data[k]] = [copy.data[k], copy.data[i]];
                  // Swap rows in result
                  [result.data[i], result.data[k]] = [result.data[k], result.data[i]];
                  pivot = copy.data[i][i];
                  swapped = true;
                  break;
              }
          }
          // If singular, return Identity (fallback for stability in this demo)
          if(!swapped) return Matrix.identity(n);
      }

      for (let j = 0; j < n; j++) {
        copy.data[i][j] /= pivot;
        result.data[i][j] /= pivot;
      }

      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const factor = copy.data[k][i];
          for (let j = 0; j < n; j++) {
            copy.data[k][j] -= factor * copy.data[i][j];
            result.data[k][j] -= factor * result.data[i][j];
          }
        }
      }
    }
    return result;
  }
}

interface GeoPoint {
  lat: number;
  long: number;
  alt: number;
}

interface FusedState {
  position: GeoPoint;
  velocity_local: { x: number, y: number, z: number };
  orientation_rpy: { roll: number, pitch: number, yaw: number };
  biases: { x: number, y: number, z: number };
  uncertainty: number;
  tier: FusionTier;
}

/**
 * Genesis 12-State Extended Kalman Filter
 * 
 * State Vector (12x1):
 * [0-2]: Position (x, y, z) in Local Tangent Plane (ENU)
 * [3-5]: Velocity (vx, vy, vz) in Local Tangent Plane
 * [6-8]: Orientation (roll, pitch, yaw) in Radians
 * [9-11]: Accelerometer Bias (bax, bay, baz) in Body Frame
 */
export class SensorFusionSDK {
  // Core EKF Matrices
  private x: Matrix; // State Vector (12x1)
  private P: Matrix; // Covariance Matrix (12x12)
  private Q: Matrix; // Process Noise (12x12)
  
  // Coordinate System
  private originECEF: { x: number, y: number, z: number } | null = null;
  private originGeo: GeoPoint | null = null; 
  
  // Constants
  private readonly RE = 6378137.0; // WGS84 Semi-major axis
  private readonly FE = 1.0 / 298.257223563; // Flattening
  private readonly E2 = 2 * this.FE - this.FE * this.FE; 
  private readonly G = 9.81;

  constructor() {
    this.x = new Matrix(12, 1);
    this.P = Matrix.identity(12).multiplyScalar(100); 
    
    // Initialize Process Noise Q
    this.Q = Matrix.identity(12);
    // Position noise
    this.Q.data[0][0] = 1e-4; this.Q.data[1][1] = 1e-4; this.Q.data[2][2] = 1e-4;
    // Velocity noise
    this.Q.data[3][3] = 1e-2; this.Q.data[4][4] = 1e-2; this.Q.data[5][5] = 1e-2;
    // Orientation noise
    this.Q.data[6][6] = 1e-5; this.Q.data[7][7] = 1e-5; this.Q.data[8][8] = 1e-5;
    // Bias noise (Random Walk - very small)
    this.Q.data[9][9] = 1e-6; this.Q.data[10][10] = 1e-6; this.Q.data[11][11] = 1e-6;
  }

  public init(lat: number, long: number, alt: number = 0) {
    this.originGeo = { lat, long, alt };
    this.originECEF = this.llaToEcef(lat, long, alt);
    
    // Reset State
    this.x = new Matrix(12, 1);
    // Orientation and Biases init to 0
    
    // Reset Covariance
    this.P = Matrix.identity(12);
    this.P.data[0][0] = 5*5; // 5m position error
    this.P.data[1][1] = 5*5;
    this.P.data[2][2] = 10*10;
    this.P.data[9][9] = 0.1; // Bias uncertainty
    this.P.data[10][10] = 0.1;
    this.P.data[11][11] = 0.1;
  }

  public isInitialized(): boolean {
      return this.originECEF !== null;
  }

  /**
   * Calculates the Jacobian matrix (F) of the state transition function.
   * This accounts for the dependency of position/velocity on orientation (via rotation matrix)
   * and the effect of biases.
   */
  private computeStateTransitionJacobian(
    dt: number,
    accelBody: { x: number, y: number, z: number },
    gyroBody: { x: number, y: number, z: number }
  ): Matrix {
    const F = Matrix.identity(12);

    // Indices
    // P:0-2, V:3-5, ATT:6-8, BIAS:9-11

    // Extract State needed for Jacobian
    const roll = this.x.data[6][0];
    const pitch = this.x.data[7][0];
    const yaw = this.x.data[8][0];
    const bax = this.x.data[9][0];
    const bay = this.x.data[10][0];
    const baz = this.x.data[11][0];

    // Corrected Acceleration
    const ax = accelBody.x - bax;
    const ay = accelBody.y - bay;
    const az = accelBody.z - baz;

    // Rotation Matrix R
    const R = this.getRotationMatrix(roll, pitch, yaw);

    // --- Block: d(Pos)/d(Vel) ---
    F.data[0][3] = dt;
    F.data[1][4] = dt;
    F.data[2][5] = dt;

    // --- Block: d(Pos)/d(Att) & d(Vel)/d(Att) ---
    // We need partial derivatives of R * accel_corrected w.r.t roll, pitch, yaw
    const dR_dRoll = this.getRotationMatrixDerivRoll(roll, pitch, yaw);
    const dR_dPitch = this.getRotationMatrixDerivPitch(roll, pitch, yaw);
    const dR_dYaw = this.getRotationMatrixDerivYaw(roll, pitch, yaw);

    const applyDeriv = (dR: Matrix) => {
        const dx = dR.data[0][0]*ax + dR.data[0][1]*ay + dR.data[0][2]*az;
        const dy = dR.data[1][0]*ax + dR.data[1][1]*ay + dR.data[1][2]*az;
        const dz = dR.data[2][0]*ax + dR.data[2][1]*ay + dR.data[2][2]*az;
        return { x: dx, y: dy, z: dz };
    };

    const dAdRoll = applyDeriv(dR_dRoll);
    const dAdPitch = applyDeriv(dR_dPitch);
    const dAdYaw = applyDeriv(dR_dYaw);

    // d(Vel)/d(Roll) = dAdRoll * dt
    F.data[3][6] = dAdRoll.x * dt; F.data[4][6] = dAdRoll.y * dt; F.data[5][6] = dAdRoll.z * dt;
    // d(Vel)/d(Pitch)
    F.data[3][7] = dAdPitch.x * dt; F.data[4][7] = dAdPitch.y * dt; F.data[5][7] = dAdPitch.z * dt;
    // d(Vel)/d(Yaw)
    F.data[3][8] = dAdYaw.x * dt; F.data[4][8] = dAdYaw.y * dt; F.data[5][8] = dAdYaw.z * dt;

    // d(Pos)/d(Att) = 0.5 * d(Vel)/d(Att) * dt
    F.data[0][6] = 0.5 * F.data[3][6] * dt; F.data[1][6] = 0.5 * F.data[4][6] * dt; F.data[2][6] = 0.5 * F.data[5][6] * dt;
    F.data[0][7] = 0.5 * F.data[3][7] * dt; F.data[1][7] = 0.5 * F.data[4][7] * dt; F.data[2][7] = 0.5 * F.data[5][7] * dt;
    F.data[0][8] = 0.5 * F.data[3][8] * dt; F.data[1][8] = 0.5 * F.data[4][8] * dt; F.data[2][8] = 0.5 * F.data[5][8] * dt;


    // --- Block: d(Vel)/d(Bias) ---
    // Vel = Vel_prev + (R * (a_m - bias) - g) * dt
    // d(Vel)/d(Bias) = -R * dt
    for(let r=0; r<3; r++) {
        for(let c=0; c<3; c++) {
            F.data[3+r][9+c] = -R.data[r][c] * dt;
        }
    }

    // --- Block: d(Pos)/d(Bias) ---
    // Pos = Pos_prev + ... + 0.5 * (R * (a_m - bias)) * dt^2
    // d(Pos)/d(Bias) = -0.5 * R * dt^2
    for(let r=0; r<3; r++) {
        for(let c=0; c<3; c++) {
            F.data[0+r][9+c] = -0.5 * R.data[r][c] * dt * dt;
        }
    }

    // --- Block: d(Att)/d(Att) ---
    // Simplified: Identity (assuming small angles and decoupled axes for this step)
    // Full Euler rate Jacobian is computationally expensive and often singular at pitch=90.
    
    return F;
  }

  /**
   * Prediction Step: Propagate state using IMU
   */
  public predict(
    dt_sec: number,
    accelBody: { x: number, y: number, z: number },
    gyroBody: { x: number, y: number, z: number } 
  ) {
    if (!this.isInitialized()) return;

    // 1. Current State
    const px=this.x.data[0][0], py=this.x.data[1][0], pz=this.x.data[2][0];
    const vx=this.x.data[3][0], vy=this.x.data[4][0], vz=this.x.data[5][0];
    const roll=this.x.data[6][0], pitch=this.x.data[7][0], yaw=this.x.data[8][0];
    const bax=this.x.data[9][0], bay=this.x.data[10][0], baz=this.x.data[11][0];

    // 2. Bias Corrected Inputs
    const ax_corr = accelBody.x - bax;
    const ay_corr = accelBody.y - bay;
    const az_corr = accelBody.z - baz;

    // 3. Transform Acceleration
    const R = this.getRotationMatrix(roll, pitch, yaw);
    const ax_local = R.data[0][0]*ax_corr + R.data[0][1]*ay_corr + R.data[0][2]*az_corr;
    const ay_local = R.data[1][0]*ax_corr + R.data[1][1]*ay_corr + R.data[1][2]*az_corr;
    const az_local = R.data[2][0]*ax_corr + R.data[2][1]*ay_corr + R.data[2][2]*az_corr - this.G;

    // 4. Update State (Euler Integration)
    // Pos
    this.x.data[0][0] += vx * dt_sec + 0.5 * ax_local * dt_sec * dt_sec;
    this.x.data[1][0] += vy * dt_sec + 0.5 * ay_local * dt_sec * dt_sec;
    this.x.data[2][0] += vz * dt_sec + 0.5 * az_local * dt_sec * dt_sec;
    // Vel
    this.x.data[3][0] += ax_local * dt_sec;
    this.x.data[4][0] += ay_local * dt_sec;
    this.x.data[5][0] += az_local * dt_sec;
    // Att (Simplified rate integration)
    this.x.data[6][0] += gyroBody.x * dt_sec;
    this.x.data[7][0] += gyroBody.y * dt_sec;
    this.x.data[8][0] += gyroBody.z * dt_sec;
    
    // Normalize Yaw
    this.x.data[8][0] = Math.atan2(Math.sin(this.x.data[8][0]), Math.cos(this.x.data[8][0]));

    // 5. Compute Jacobian
    const F = this.computeStateTransitionJacobian(dt_sec, accelBody, gyroBody);

    // 6. Update Covariance: P = FPF' + Q
    // Adaptive Q based on motion
    const motionMag = Math.sqrt(ax_corr**2 + ay_corr**2);
    this.Q.data[3][3] = 0.01 + motionMag * 0.005; 
    this.Q.data[4][4] = 0.01 + motionMag * 0.005;

    this.P = F.multiply(this.P).multiply(F.transpose()).add(this.Q.multiplyScalar(dt_sec));
  }

  /**
   * Correction Step: GNSS
   * z = [x, y, z, vel_mag]
   */
  public updateWithGNSS(lat: number, long: number, alt: number, accuracy: number, speed_mps: number) {
    if (!this.isInitialized()) {
        this.init(lat, long, alt);
        return;
    }

    const ecef = this.llaToEcef(lat, long, alt);
    const enu = this.ecefToEnu(ecef.x, ecef.y, ecef.z);
    
    // z vector (4x1)
    const z = new Matrix(4, 1, [[enu.x], [enu.y], [enu.z], [speed_mps]]);

    // Predicted Measurement h(x)
    const px = this.x.data[0][0], py = this.x.data[1][0], pz = this.x.data[2][0];
    const vx = this.x.data[3][0], vy = this.x.data[4][0], vz = this.x.data[5][0];
    const velMag = Math.sqrt(vx*vx + vy*vy + vz*vz);
    
    const hx = new Matrix(4, 1, [[px], [py], [pz], [velMag]]);

    // Jacobian H (4x12)
    const H = Matrix.zero(4, 12);
    H.data[0][0] = 1; H.data[1][1] = 1; H.data[2][2] = 1;
    
    const safeVel = velMag < 0.1 ? 1 : velMag;
    H.data[3][3] = vx / safeVel;
    H.data[3][4] = vy / safeVel;
    H.data[3][5] = vz / safeVel;

    // Noise R
    const R = Matrix.identity(4);
    const posVar = Math.max(accuracy * accuracy, 2.0);
    R.data[0][0] = posVar;
    R.data[1][1] = posVar;
    R.data[2][2] = posVar * 4;
    R.data[3][3] = 1.5; 

    // Update
    const y_residual = z.subtract(hx);
    const S = H.multiply(this.P).multiply(H.transpose()).add(R);
    const K = this.P.multiply(H.transpose()).multiply(S.inverse());
    
    this.x = this.x.add(K.multiply(y_residual));
    const I = Matrix.identity(12);
    this.P = I.subtract(K.multiply(H)).multiply(this.P);
  }

  public updateWithVision(velocity_mps: number, confidence: number) {
      if (!this.isInitialized() || confidence < 0.5) return;

      const z = new Matrix(1, 1, [[velocity_mps]]);
      
      const vx = this.x.data[3][0], vy = this.x.data[4][0], vz = this.x.data[5][0];
      const velMag = Math.sqrt(vx*vx + vy*vy + vz*vz);
      const hx = new Matrix(1, 1, [[velMag]]);

      // H (1x12)
      const H = Matrix.zero(1, 12);
      const safeVel = velMag < 0.1 ? 1 : velMag;
      H.data[0][3] = vx / safeVel;
      H.data[0][4] = vy / safeVel;
      H.data[0][5] = vz / safeVel;

      const variance = (1.1 - confidence) * 2.0; 
      const R = new Matrix(1, 1, [[variance]]);

      const y_residual = z.subtract(hx);
      const S = H.multiply(this.P).multiply(H.transpose()).add(R);
      const K = this.P.multiply(H.transpose()).multiply(S.inverse());

      this.x = this.x.add(K.multiply(y_residual));
      const I = Matrix.identity(12);
      this.P = I.subtract(K.multiply(H)).multiply(this.P);
  }

  public getState(): FusedState {
    if (!this.originGeo) {
        return {
            position: { lat: 0, long: 0, alt: 0 },
            velocity_local: { x: 0, y: 0, z: 0 },
            orientation_rpy: { roll: 0, pitch: 0, yaw: 0 },
            biases: { x: 0, y: 0, z: 0 },
            uncertainty: 100,
            tier: FusionTier.TIER_4_INITIALIZING
        };
    }

    const enuX = this.x.data[0][0];
    const enuY = this.x.data[1][0];
    const enuZ = this.x.data[2][0];
    const lla = this.enuToLla(enuX, enuY, enuZ);

    const uncertainty = Math.sqrt(this.P.data[0][0] + this.P.data[1][1]);
    
    let tier = FusionTier.TIER_1_FULL_FIDELITY;
    if (uncertainty > 15) tier = FusionTier.TIER_3_DEAD_RECKONING;
    else if (uncertainty > 5) tier = FusionTier.TIER_2_VISION_DEGRADED;

    return {
        position: lla,
        velocity_local: {
            x: this.x.data[3][0],
            y: this.x.data[4][0],
            z: this.x.data[5][0]
        },
        orientation_rpy: {
            roll: this.x.data[6][0],
            pitch: this.x.data[7][0],
            yaw: this.x.data[8][0]
        },
        biases: {
            x: this.x.data[9][0],
            y: this.x.data[10][0],
            z: this.x.data[11][0]
        },
        uncertainty,
        tier
    };
  }

  // --- Rotation Matrix Helpers ---

  private getRotationMatrix(r: number, p: number, y: number): Matrix {
    const cr = Math.cos(r), sr = Math.sin(r);
    const cp = Math.cos(p), sp = Math.sin(p);
    const cy = Math.cos(y), sy = Math.sin(y);

    return new Matrix(3, 3, [
      [cy*cp, cy*sp*sr - sy*cr, cy*sp*cr + sy*sr],
      [sy*cp, sy*sp*sr + cy*cr, sy*sp*cr - cy*sr],
      [-sp,   cp*sr,            cp*cr]
    ]);
  }

  // dR / dRoll
  private getRotationMatrixDerivRoll(r: number, p: number, y: number): Matrix {
      const cr = Math.cos(r), sr = Math.sin(r);
      const cp = Math.cos(p), sp = Math.sin(p);
      const cy = Math.cos(y), sy = Math.sin(y);

      // d(Rx)/dr
      // 0  0   0
      // 0 -sr -cr
      // 0  cr -sr
      // Multiply Rz * Ry * dRx/dr
      
      return new Matrix(3, 3, [
          [0, cy*sp*cr + sy*sr, -cy*sp*sr + sy*cr],
          [0, sy*sp*cr - cy*sr, -sy*sp*sr - cy*cr],
          [0, cp*cr,            -cp*sr]
      ]);
  }

  // dR / dPitch
  private getRotationMatrixDerivPitch(r: number, p: number, y: number): Matrix {
      const cr = Math.cos(r), sr = Math.sin(r);
      const cp = Math.cos(p), sp = Math.sin(p);
      const cy = Math.cos(y), sy = Math.sin(y);

      return new Matrix(3, 3, [
          [-cy*sp, cy*cp*sr, cy*cp*cr],
          [-sy*sp, sy*cp*sr, sy*cp*cr],
          [-cp,    -sp*sr,   -sp*cr]
      ]);
  }
  
  // dR / dYaw
  private getRotationMatrixDerivYaw(r: number, p: number, y: number): Matrix {
      const cr = Math.cos(r), sr = Math.sin(r);
      const cp = Math.cos(p), sp = Math.sin(p);
      const cy = Math.cos(y), sy = Math.sin(y);

      return new Matrix(3, 3, [
          [-sy*cp, -sy*sp*sr - cy*cr, -sy*sp*cr + cy*sr],
          [cy*cp,  cy*sp*sr - sy*cr,  cy*sp*cr + sy*sr],
          [0,      0,                 0]
      ]);
  }

  // --- Geodetic Helpers ---

  private llaToEcef(lat: number, lon: number, alt: number) {
    const latRad = lat * (Math.PI / 180);
    const lonRad = lon * (Math.PI / 180);
    const N = this.RE / Math.sqrt(1 - this.E2 * Math.sin(latRad) * Math.sin(latRad));
    
    const x = (N + alt) * Math.cos(latRad) * Math.cos(lonRad);
    const y = (N + alt) * Math.cos(latRad) * Math.sin(lonRad);
    const z = (N * (1 - this.E2) + alt) * Math.sin(latRad);
    return { x, y, z };
  }

  private ecefToEnu(x: number, y: number, z: number) {
    if (!this.originECEF || !this.originGeo) return { x: 0, y: 0, z: 0 };
    
    const dx = x - this.originECEF.x;
    const dy = y - this.originECEF.y;
    const dz = z - this.originECEF.z;
    
    const latRad = this.originGeo.lat * (Math.PI / 180);
    const lonRad = this.originGeo.long * (Math.PI / 180);
    const sinLat = Math.sin(latRad), cosLat = Math.cos(latRad);
    const sinLon = Math.sin(lonRad), cosLon = Math.cos(lonRad);

    const e = -sinLon * dx + cosLon * dy;
    const n = -sinLat * cosLon * dx - sinLat * sinLon * dy + cosLat * dz;
    const u = cosLat * cosLon * dx + cosLat * sinLon * dy + sinLat * dz;

    return { x: e, y: n, z: u };
  }

  private enuToLla(e: number, n: number, u: number): GeoPoint {
      if(!this.originGeo) return { lat: 0, long: 0, alt: 0 };
      
      const latRad = this.originGeo.lat * (Math.PI / 180);
      const metersPerDegLat = 111132.92 - 559.82 * Math.cos(2 * latRad) + 1.175 * Math.cos(4 * latRad);
      const metersPerDegLon = 111412.84 * Math.cos(latRad) - 93.5 * Math.cos(3 * latRad);

      return {
          lat: this.originGeo.lat + (n / metersPerDegLat),
          long: this.originGeo.long + (e / metersPerDegLon),
          alt: this.originGeo.alt + u
      };
  }
}
