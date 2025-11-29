
import { useState, useEffect, useRef, useCallback } from 'react';
import { TelemetryStateObject, RunSummary, FusionTier, LapData, LapSummary } from '../types';
import { VehiclePhysics } from '../lib/VehiclePhysics';
import { SensorFusionSDK } from '../lib/SensorFusionSDK';
import { LapTimingService } from '../services/lapTimingService';
import { RealtimeCoachingService } from '../services/realtimeCoachingService';
import { getCoachingAdvice } from '../services/geminiService';
import { obdService, OBDData } from '../services/obdService';
import { useDeviceSensors } from './useDeviceSensors';

const INITIAL_STATE: TelemetryStateObject = {
  timestamp: Date.now(),
  speed_mps: 0,
  acceleration_g: { longitudinal: 0, lateral: 0, vertical: 1 },
  tire_loads: { fl: 1, fr: 1, rl: 1, rr: 1 },
  position: { lat: 37.7749, long: -122.4194 }, // Default to SF
  slope_percent: 0,
  pitch_angle: 0,
  inferred_gear: 1,
  event: null,
  fusionTier: FusionTier.TIER_4_INITIALIZING,
  rpm: 800,
  heading: 0,
  prediction: { delta: 0, predictedLapTime: null },
  uncertainty_m: 10,
  ekf_biases: { x: 0, y: 0, z: 0 },
  ekf_gyro_biases: { x: 0, y: 0, z: 0 },
  obd_info: { battery_voltage: 12.4, coolant_temp: 90, throttle_pos: 0 }
};

const INITIAL_LAP_DATA: LapData = {
    lap: 0,
    currentLapTime: 0,
    lastLapTime: null,
    bestLapTime: null
};

export const useTelemetry = () => {
    const [isRunning, setIsRunning] = useState(false);
    const [telemetryData, setTelemetryData] = useState<TelemetryStateObject>(INITIAL_STATE);
    const [livePath, setLivePath] = useState<TelemetryStateObject[]>([]);
    const [runHistory, setRunHistory] = useState<RunSummary[]>([]);
    const [isCoachEnabled, setIsCoachEnabled] = useState(false);
    const [isCoachSpeaking, setIsCoachSpeaking] = useState(false);
    const [isSensorsEnabled, setIsSensorsEnabled] = useState(false);
    
    // Coaching loading/result state
    const [coaching, setCoaching] = useState<{ isLoading: boolean, advice: string | null, clear: () => void }>({
        isLoading: false,
        advice: null,
        clear: () => setCoaching(prev => ({ ...prev, advice: null }))
    });

    const [lapData, setLapData] = useState<LapData>(INITIAL_LAP_DATA);
    const [startFinishLine, setStartFinishLineState] = useState<{p1: {lat: number, long: number}, p2: {lat: number, long: number}} | null>(null);

    // OBD State
    const [isOBDConnected, setIsOBDConnected] = useState(false);
    const obdDataRef = useRef<OBDData | null>(null);
    
    // GPS State
    const gpsSpeedRef = useRef<number | null>(null);

    // Real Sensors
    const deviceSensorsRef = useDeviceSensors(isSensorsEnabled);

    // Services Refs
    const physicsRef = useRef(new VehiclePhysics());
    const fusionRef = useRef(new SensorFusionSDK());
    const lapTimerRef = useRef<LapTimingService | null>(null);
    const coachRef = useRef<RealtimeCoachingService | null>(null);
    
    // Data Accumulators for Run
    const currentRunDataRef = useRef<TelemetryStateObject[]>([]);
    const currentRunLapsRef = useRef<LapSummary[]>([]);

    // Anomaly Detection State
    const lastAnomalyTime = useRef(0);

    // Initialize Services
    useEffect(() => {
        lapTimerRef.current = new LapTimingService((lapSummary) => {
            currentRunLapsRef.current.push(lapSummary);
        });

        coachRef.current = new RealtimeCoachingService({
            onStateChange: (state) => {
                // Only update speaking state to avoid re-renders on enabled toggle which is local
                setIsCoachSpeaking(state.isSpeaking);
            }
        });
        
        // Init Sensor Fusion with GPS Watcher
        let watchId: number | null = null;
        if ("geolocation" in navigator) {
             // Initial fix for fast startup
             navigator.geolocation.getCurrentPosition(
                (pos) => fusionRef.current.init(pos.coords.latitude, pos.coords.longitude, pos.coords.altitude || 0),
                (err) => console.warn("GPS Init failed", err),
                { enableHighAccuracy: true }
             );

             // Continuous updates
             watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    const { latitude, longitude, altitude, accuracy, speed } = pos.coords;
                    // Update GPS speed ref for physics sync
                    gpsSpeedRef.current = speed;
                    
                    fusionRef.current.updateWithGNSS(
                        latitude,
                        longitude,
                        altitude || 0,
                        accuracy,
                        speed || 0
                    );
                },
                (err) => console.warn("GPS Watch failed", err),
                { 
                    enableHighAccuracy: true,
                    maximumAge: 0,
                    timeout: 27000
                }
             );
        }

        return () => {
             coachRef.current?.stop();
             if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        };
    }, []);

    // Toggle Coach
    const toggleRealtimeCoach = useCallback(() => {
        if (isCoachEnabled) {
            coachRef.current?.stop();
            setIsCoachEnabled(false);
        } else {
            coachRef.current?.start();
            setIsCoachEnabled(true);
        }
    }, [isCoachEnabled]);

    // Set Start/Finish
    const setStartFinishLine = useCallback(() => {
        if (telemetryData.position && telemetryData.heading !== undefined) {
             lapTimerRef.current?.setStartFinishLine(telemetryData.position, telemetryData.heading);
             setStartFinishLineState(lapTimerRef.current?.getStartFinishLine() || null);
        }
    }, [telemetryData]);

    // OBD Connect
    const connectOBD = async (): Promise<{ success: boolean, error?: string }> => {
        const result = await obdService.connect();
        setIsOBDConnected(result.success);
        if (result.success) {
            obdService.startPolling((data) => {
                obdDataRef.current = data;
            });
        }
        return result;
    };
    
    const disconnectOBD = useCallback(() => {
        obdService.disconnect();
        setIsOBDConnected(false);
        obdDataRef.current = null;
    }, []);
    
    const enableSensors = useCallback(() => {
        setIsSensorsEnabled(true);
    }, []);

    // Intelligent Anomaly Detection Check
    const checkAnomalies = (state: TelemetryStateObject) => {
        const now = Date.now();
        if (now - lastAnomalyTime.current < 5000) return null; // 5s cooldown

        if (state.obd_info) {
            if (state.obd_info.coolant_temp > 110) return "WARNING: HIGH COOLANT TEMP";
            if (state.obd_info.battery_voltage < 11.5) return "WARNING: LOW VOLTAGE";
        }
        
        // High G Event check (Crash detection logic placeholder)
        if (Math.abs(state.acceleration_g.longitudinal) > 2.0 || Math.abs(state.acceleration_g.lateral) > 2.0) {
            return "EVENT: HIGH G-FORCE";
        }

        return null;
    };


    // Main Loop
    useEffect(() => {
        let animationFrameId: number;
        let lastTime = Date.now();

        const loop = () => {
            const now = Date.now();
            const dt = now - lastTime;
            lastTime = now;
            
            // 1. Update Physics / OBD / GPS Sync
            if (isOBDConnected && obdDataRef.current) {
                // Use OBD data
                const obd = obdDataRef.current;
                const speedMps = (obd.speed_kmh || 0) / 3.6;
                physicsRef.current.overrideState(speedMps, obd.rpm || 0);
            } else if (gpsSpeedRef.current !== null) {
                // Use GPS data if no OBD (e.g. phone only mode)
                // We keep RPM at whatever physics engine had (likely idle or simulated revs)
                physicsRef.current.overrideState(gpsSpeedRef.current, physicsRef.current.rpm);
            }
            
            // Step physics (calculates G-forces, weight transfer, and simulates engine if not overridden)
            const physicsState = physicsRef.current.update(dt, !isOBDConnected && gpsSpeedRef.current === null); 
            
            // 2. Sensor Fusion
            // If real sensors are active, use them for EKF prediction
            let ekfAccel = { 
                x: physicsState.acceleration_g.longitudinal * 9.81, 
                y: physicsState.acceleration_g.lateral * 9.81, 
                z: physicsState.acceleration_g.vertical * 9.81 
            };
            let ekfGyro = { 
                x: 0, 
                y: 0, 
                z: (physicsState.acceleration_g.lateral / (physicsState.speed_mps || 1)) 
            };

            if (deviceSensorsRef.current.hasData) {
                const s = deviceSensorsRef.current;
                // Mapping Phone Frame to Vehicle Frame
                ekfAccel = { x: s.acceleration.y, y: s.acceleration.x, z: s.acceleration.z };
                const toRad = Math.PI / 180;
                ekfGyro = { 
                    x: s.rotationRate.gamma * toRad, // Roll 
                    y: s.rotationRate.beta * toRad,  // Pitch
                    z: s.rotationRate.alpha * toRad  // Yaw
                };
            }

            // Propagate EKF state forward
            fusionRef.current.predict(dt / 1000, ekfAccel, ekfGyro, physicsState.speed_mps);
            
            const fusionState = fusionRef.current.getState();

            // 3. Compose Telemetry Object
            const state: TelemetryStateObject = {
                timestamp: now,
                speed_mps: physicsState.speed_mps,
                acceleration_g: deviceSensorsRef.current.hasData ? {
                    longitudinal: ekfAccel.x / 9.81,
                    lateral: ekfAccel.y / 9.81,
                    vertical: ekfAccel.z / 9.81
                } : physicsState.acceleration_g, // Use real Gs if available for display
                tire_loads: physicsState.tire_loads,
                position: fusionState.position, // Use fused position
                slope_percent: physicsState.slope_percent || 0,
                pitch_angle: fusionState.orientation_rpy.pitch * (180/Math.PI), // Use fused pitch
                inferred_gear: physicsState.inferred_gear,
                event: physicsState.event,
                fusionTier: fusionState.tier,
                rpm: physicsState.rpm,
                heading: fusionState.orientation_rpy.yaw * (180/Math.PI), // rad to deg
                prediction: { delta: 0, predictedLapTime: null }, // Placeholder
                uncertainty_m: fusionState.uncertainty,
                ekf_biases: fusionState.biases,
                ekf_gyro_biases: fusionState.gyro_biases,
                obd_info: isOBDConnected && obdDataRef.current ? {
                    battery_voltage: obdDataRef.current.voltage || 12.0,
                    coolant_temp: obdDataRef.current.coolant_temp || 90,
                    throttle_pos: obdDataRef.current.throttle_pos || 0
                } : undefined
            };

            // Anomaly Check
            const anomaly = checkAnomalies(state);
            if (anomaly) {
                state.event = anomaly;
                lastAnomalyTime.current = now;
            }

            // 4. Update Lap Timer
            const currentLapData = lapTimerRef.current?.updatePosition(state);
            if (currentLapData) setLapData(currentLapData);

            // 5. Update Coaching
            if (isCoachEnabled) {
                coachRef.current?.analyze(state);
            }

            setTelemetryData(state);

            // 6. Record Data if Running
            if (isRunning) {
                currentRunDataRef.current.push(state);
                setLivePath(prev => [...prev, state]);
            } else {
                // Keep live path short when not recording (just trail)
                 setLivePath(prev => {
                     const keep = prev.slice(-100);
                     if (Math.random() > 0.5) return [...keep, state]; // Downsample slightly for idle visual
                     return keep;
                 });
            }

            animationFrameId = requestAnimationFrame(loop);
        };

        animationFrameId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animationFrameId);
    }, [isRunning, isOBDConnected, isCoachEnabled, isSensorsEnabled]); // Loop dependency updated

    const startRun = useCallback(() => {
        setIsRunning(true);
        currentRunDataRef.current = [];
        currentRunLapsRef.current = [];
        setLivePath([]);
        physicsRef.current.reset();
        lapTimerRef.current?.reset();
        // If start/finish exists, restore it to the reset timer
        if (startFinishLine) {
             lapTimerRef.current?.setStartFinishLine(startFinishLine.p1, 0); 
        }
    }, [startFinishLine]);

    const stopRun = useCallback(async () => {
        setIsRunning(false);
        const data = currentRunDataRef.current;
        const laps = currentRunLapsRef.current;
        
        if (data.length === 0) return;

        // Calculate Stats
        let maxSpeed = 0;
        let maxGLong = 0;
        let maxGLat = 0;
        let zeroToSixty = null;
        let quarterMileTime = null;
        let quarterMileSpeed = null;
        let startTime = data[0].timestamp;
        let startDist = 0; // Simplified distance integration

        for (let i = 0; i < data.length; i++) {
            const p = data[i];
            const speedMph = p.speed_mps * 2.23694;
            if (p.speed_mps > maxSpeed) maxSpeed = p.speed_mps;
            if (Math.abs(p.acceleration_g.longitudinal) > Math.abs(maxGLong)) maxGLong = p.acceleration_g.longitudinal;
            if (Math.abs(p.acceleration_g.lateral) > Math.abs(maxGLat)) maxGLat = p.acceleration_g.lateral;

            const t = (p.timestamp - startTime) / 1000;
            
            // 0-60
            if (zeroToSixty === null && speedMph >= 60) {
                zeroToSixty = t;
            }

            // Distance (Riemann sum)
            if (i > 0) {
                const dt = (p.timestamp - data[i-1].timestamp) / 1000;
                startDist += p.speed_mps * dt;
            }

            // 1/4 Mile (402.34m)
            if (quarterMileTime === null && startDist >= 402.34) {
                quarterMileTime = t;
                quarterMileSpeed = p.speed_mps;
            }
        }

        const summary: RunSummary = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            zeroToSixty,
            quarterMileTime,
            quarterMileSpeed,
            maxSpeed,
            maxGForce: { longitudinal: maxGLong, lateral: maxGLat, vertical: 0 },
            path: data.map(d => ({ lat: d.position.lat, long: d.position.long, speed_mps: d.speed_mps })),
            fullData: data,
            laps: laps
        };
        
        // --- Commercial Grade Feature: Automated AI Briefing ---
        setCoaching(prev => ({ ...prev, isLoading: true }));
        setRunHistory(prev => [...prev, summary]); // Save immediately
        
        // Trigger Async AI Analysis
        getCoachingAdvice(summary).then(advice => {
            setRunHistory(prev => prev.map(r => r.id === summary.id ? { ...r, coachingAdvice: advice } : r));
            setCoaching(prev => ({ ...prev, isLoading: false, advice }));
        }).catch(err => {
            console.error("Auto-briefing failed:", err);
            setCoaching(prev => ({ ...prev, isLoading: false }));
        });

    }, []);

    return {
        isRunning,
        telemetryData,
        livePath,
        runHistory,
        coaching,
        startRun,
        stopRun,
        setRunHistory,
        isCoachEnabled,
        isCoachSpeaking,
        toggleRealtimeCoach,
        lapData,
        setStartFinishLine,
        startFinishLine,
        connectOBD,
        disconnectOBD,
        isOBDConnected,
        enableSensors,
        isSensorsEnabled
    };
};
