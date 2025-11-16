
export const MPS_PER_MPH = 0.44704;
export const METERS_PER_MILE = 1609.34;

// Vehicle Physics Constants (Production Model)
export const VEHICLE_MASS_KG = 1800; // Mass of the car
export const DRAG_COEFFICIENT = 0.28; // Aerodynamic drag
export const FRONTAL_AREA_M2 = 2.3;
export const ROLLING_RESISTANCE_COEFFICIENT = 0.015;
export const AIR_DENSITY_KG_M3 = 1.225;
export const GRAVITY_MS2 = 9.81;

// Drivetrain
export const FINAL_DRIVE_RATIO = 3.1;
export const GEAR_RATIOS = [0, 3.6, 2.2, 1.5, 1.1, 0.85, 0.65]; // 6-speed + R
export const SHIFT_RPM = 7000;
export const DOWNSHIFT_RPM = 3000;
export const IDLE_RPM = 800;
export const MAX_RPM = 7500;
export const WHEEL_RADIUS_M = 0.34; // Approx for a 27" tire
export const SHIFT_TIME_MS = 150; // Time for a gear change
