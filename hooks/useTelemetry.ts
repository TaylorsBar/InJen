
import { useState, useEffect, useRef, useCallback } from 'react';
import { TelemetryStateObject, RunSummary, FusionTier, LapData, LapSummary } from '../types';
import { VehiclePhysics } from '../lib/VehiclePhysics';
import { SensorFusionSDK } from '../lib/SensorFusionSDK';
import { LapTimingService } from '../services/lapTimingService';
import { RealtimeCoachingService } from '../services/realtimeCoachingService';
import { getCoachingAdvice } from '../services/geminiService';
import { obdService, OBDData } from '../services/obdService';
import { platformService } from '../services/platformService';

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

    // Services Refs
    const physicsRef = useRef(new VehiclePhysics());
    const fusionRef = useRef(new SensorFusionSDK());
    const lapTimerRef = useRef<LapTimingService | null>(null);
    const coachRef = useRef<RealtimeCoachingService | null>(null);
    
    // Data Accumulators for Run
    const currentRunDataRef = useRef<TelemetryStateObject[]>([]);
    const currentRunLapsRef = useRef<LapSummary[]>([]);

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
        
        // Init Sensor Fusion with a default location or wait for GPS
        if ("geolocation" in navigator) {
             navigator.geolocation.getCurrentPosition(
                (pos) => fusionRef.current.init(pos.coords.latitude, pos.coords.longitude, pos.coords.altitude || 0),
                (err) => console.warn("GPS Init failed", err),
                { enableHighAccuracy: true }
             );
        }

        return () => {
             coachRef.current?.stop();
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


    // Main Loop
    useEffect(() => {
        let animationFrameId: number;
        let lastTime = Date.now();

        const loop = () => {
            const now = Date.now();
            const dt = now - lastTime;
            lastTime = now;
            
            // 1. Update Physics / OBD
            if (isOBDConnected && obdDataRef.current) {
                // Use OBD data
                const obd = obdDataRef.current;
                // Update physics state for continuity, but override values
                // speed from kmh to mps
                const speedMps = (obd.speed_kmh || 0) / 3.6;
                physicsRef.current.overrideState(speedMps, obd.rpm || 0);
            }
            
            // Step physics (calculates G-forces based on speed delta if not provided by IMU, or pure sim)
            const physicsState = physicsRef.current.update(dt, !isOBDConnected); 
            
            // 2. Sensor Fusion (Mocking inputs for demo if no real sensors)
            
            // Propagate EKF
            fusionRef.current.predict(dt / 1000, 
                { x: physicsState.acceleration_g.longitudinal * 9.81, y: physicsState.acceleration_g.lateral * 9.81, z: physicsState.acceleration_g.vertical * 9.81 },
                { x: 0, y: 0, z: (physicsState.acceleration_g.lateral / (physicsState.speed_mps || 1)) }, // Rough yaw rate approx
                physicsState.speed_mps // Pass speed for ZUPT
            );
            
            const fusionState = fusionRef.current.getState();

            // 3. Compose Telemetry Object
            const state: TelemetryStateObject = {
                timestamp: now,
                speed_mps: physicsState.speed_mps,
                acceleration_g: physicsState.acceleration_g,
                tire_loads: physicsState.tire_loads,
                position: fusionState.position, // Use fused position
                slope_percent: physicsState.slope_percent || 0,
                pitch_angle: physicsState.pitch_angle,
                inferred_gear: physicsState.inferred_gear,
                event: physicsState.event,
                fusionTier: fusionState.tier,
                rpm: physicsState.rpm,
                heading: fusionState.orientation_rpy.yaw * (180/Math.PI), // rad to deg
                prediction: { delta: 0, predictedLapTime: null }, // Placeholder
                uncertainty_m: fusionState.uncertainty,
                ekf_biases: fusionState.biases,
                obd_info: isOBDConnected && obdDataRef.current ? {
                    battery_voltage: obdDataRef.current.voltage || 12.0,
                    coolant_temp: obdDataRef.current.coolant_temp || 90,
                    throttle_pos: obdDataRef.current.throttle_pos || 0
                } : undefined
            };

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
    }, [isRunning, isOBDConnected, isCoachEnabled]);

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
        let zeroToSixty = null;
        let quarterMileTime = null;
        let quarterMileSpeed = null;
        let startTime = data[0].timestamp;
        let startDist = 0; // Simplified distance integration

        for (let i = 0; i < data.length; i++) {
            const p = data[i];
            const speedMph = p.speed_mps * 2.23694;
            if (p.speed_mps > maxSpeed) maxSpeed = p.speed_mps;
            if (p.acceleration_g.longitudinal > maxGLong) maxGLong = p.acceleration_g.longitudinal;

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
            maxGForce: { longitudinal: maxGLong, lateral: 0, vertical: 0 }, // Simplify for now
            path: data.map(d => ({ lat: d.position.lat, long: d.position.long, speed_mps: d.speed_mps })),
            fullData: data,
            laps: laps
        };
        
        // AI Analysis
        setCoaching(prev => ({ ...prev, isLoading: true }));
        // Add to history immediately
        setRunHistory(prev => [...prev, summary]);
        
        try {
            const advice = await getCoachingAdvice(summary);
            // Update the run with advice
            setRunHistory(prev => prev.map(r => r.id === summary.id ? { ...r, coachingAdvice: advice } : r));
            setCoaching(prev => ({ ...prev, isLoading: false, advice }));
        } catch (e) {
            setCoaching(prev => ({ ...prev, isLoading: false }));
        }
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
        isOBDConnected
    };
};
