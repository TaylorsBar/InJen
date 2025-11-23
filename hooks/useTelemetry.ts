import { useState, useRef, useCallback, useEffect } from 'react';
import { TelemetryStateObject, RunSummary, FusionTier, LapData, LapSummary } from '../types';
import { getCoachingAdvice } from '../services/geminiService';
import { MPS_PER_MPH, METERS_PER_MILE, GRAVITY_MS2 } from '../constants';
import { VehiclePhysics } from '../lib/VehiclePhysics';
import { RealtimeCoachingService } from '../services/realtimeCoachingService';
import { LapTimingService } from '../services/lapTimingService';
import { SensorFusionSDK } from '../lib/SensorFusionSDK';
import { obdService, OBDData } from '../services/obdService';

const TICK_RATE_MS = 50; // 20 Hz for smoother physics

const INITIAL_POSITION = { lat: 37.7749, long: -122.4194 };

const INITIAL_LAP_DATA: LapData = {
    lap: 0,
    currentLapTime: 0,
    lastLapTime: null,
    bestLapTime: null,
};

const INITIAL_TELEMETRY: TelemetryStateObject = {
  timestamp: Date.now(),
  speed_mps: 0,
  acceleration_g: { longitudinal: 0, lateral: 0, vertical: 0 },
  tire_loads: { fl: 1, fr: 1, rl: 1, rr: 1 },
  position: INITIAL_POSITION,
  slope_percent: 0,
  pitch_angle: 0,
  inferred_gear: 1,
  event: null,
  fusionTier: FusionTier.TIER_4_INITIALIZING,
  rpm: 0,
  heading: 0,
  prediction: { delta: 0, predictedLapTime: null },
  uncertainty_m: 0
};

export const useTelemetry = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [telemetryData, setTelemetryData] = useState<TelemetryStateObject>(INITIAL_TELEMETRY);
  const [livePath, setLivePath] = useState<TelemetryStateObject[]>([]);
  const [runHistory, setRunHistory] = useState<RunSummary[]>([]);
  const [coaching, setCoaching] = useState<{ advice: string | null; isLoading: boolean }>({ advice: null, isLoading: false });
  const [hasGeoPermission, setHasGeoPermission] = useState(false);
  const [isCoachEnabled, setIsCoachEnabled] = useState(false);
  const [isCoachSpeaking, setIsCoachSpeaking] = useState(false);
  const [lapData, setLapData] = useState<LapData>(INITIAL_LAP_DATA);
  
  // OBD State
  const [isOBDConnected, setIsOBDConnected] = useState(false);
  const obdDataRef = useRef<OBDData | null>(null);

  const intervalRef = useRef<number | null>(null);
  const currentRunDataRef = useRef<TelemetryStateObject[]>([]);
  const currentRunLapsRef = useRef<LapSummary[]>([]);
  const startTimeRef = useRef<number>(0);
  const geoWatchIdRef = useRef<number | null>(null);
  const physicsModelRef = useRef<VehiclePhysics>(new VehiclePhysics());
  const coachServiceRef = useRef<RealtimeCoachingService | null>(null);
  const lapTimerServiceRef = useRef<LapTimingService | null>(null);
  const sensorFusionRef = useRef<SensorFusionSDK>(new SensorFusionSDK());
  
  // State for IMU derivation
  const prevHeadingRef = useRef<number>(0);
  const prevPitchRef = useRef<number>(0);
  const prevSpeedRef = useRef<number>(0); // For OBD-based acceleration derivation


  useEffect(() => {
    coachServiceRef.current = new RealtimeCoachingService({
      onStateChange: (state) => {
        setIsCoachEnabled(state.isEnabled);
        setIsCoachSpeaking(state.isSpeaking);
      }
    });
    
    lapTimerServiceRef.current = new LapTimingService((lapSummary) => {
        currentRunLapsRef.current.push(lapSummary);
    });
  }, []);

  // Real geolocation handling
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setHasGeoPermission(true);
        // Initialize EKF origin with Altitude if available
        sensorFusionRef.current.init(pos.coords.latitude, pos.coords.longitude, pos.coords.altitude || 0);
        
        if (!isRunning) {
            setTelemetryData(prev => ({
                ...prev, 
                position: { lat: pos.coords.latitude, long: pos.coords.longitude },
                fusionTier: FusionTier.TIER_1_FULL_FIDELITY
            }));
        }
      }, (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          console.warn("Geolocation permission denied.");
        }
        setHasGeoPermission(false);
        if (!isRunning) {
            setTelemetryData(prev => ({...prev, fusionTier: FusionTier.TIER_3_DEAD_RECKONING}));
        }
      });
    }
    
    return () => {
      if (geoWatchIdRef.current) {
        navigator.geolocation.clearWatch(geoWatchIdRef.current);
      }
      obdService.disconnect();
    };
  }, [isRunning]);

  // OBD Connection Handler
  const connectOBD = async () => {
      const connected = await obdService.connect();
      setIsOBDConnected(connected);
      if (connected) {
          obdService.startPolling((data) => {
              obdDataRef.current = data;
          });
      }
      return connected;
  };

  const disconnectOBD = () => {
      obdService.disconnect();
      setIsOBDConnected(false);
      obdDataRef.current = null;
  }


  const clearCoaching = () => setCoaching({ advice: null, isLoading: false });
  
  const setStartFinishLine = useCallback(() => {
    lapTimerServiceRef.current?.setStartFinishLine(telemetryData.position, telemetryData.heading);
    setTelemetryData(prev => ({...prev}));
  }, [telemetryData]);

  const stopRun = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (geoWatchIdRef.current) {
        navigator.geolocation.clearWatch(geoWatchIdRef.current);
        geoWatchIdRef.current = null;
    }
    setIsRunning(false);
    coachServiceRef.current?.stop();
    
    // Reset to last known state but stopped
    const lastState = sensorFusionRef.current.getState();
    setTelemetryData(prev => ({
        ...INITIAL_TELEMETRY,
        timestamp: Date.now(),
        position: { lat: lastState.position.lat, long: lastState.position.long },
        heading: prev.heading,
        fusionTier: lastState.tier
    }));
    setLivePath([]);
    setLapData(INITIAL_LAP_DATA);

    // Process the run
    const runData = currentRunDataRef.current;
    if (runData.length > 2) {
      const runSummary = processRunData(runData, currentRunLapsRef.current);
      setCoaching({ advice: null, isLoading: true });
      getCoachingAdvice(runSummary).then(advice => {
        const coachedSummary = { ...runSummary, coachingAdvice: advice };
        setRunHistory(prev => [...prev, coachedSummary]);
        setCoaching({ advice, isLoading: false });
      }).catch(err => {
        console.error("Error getting coaching advice:", err);
        const coachedSummary = { ...runSummary, coachingAdvice: "Could not get AI coaching advice due to an error." };
        setRunHistory(prev => [...prev, coachedSummary]);
        setCoaching({ advice: "An error occurred while getting coaching advice.", isLoading: false });
      });
    }
    currentRunDataRef.current = [];
    currentRunLapsRef.current = [];
  }, [hasGeoPermission]);

  const startRun = () => {
    setIsRunning(true);
    startTimeRef.current = Date.now();
    currentRunDataRef.current = [];
    currentRunLapsRef.current = [];
    lapTimerServiceRef.current?.reset();
    physicsModelRef.current.reset();
    
    if (!isOBDConnected) {
        physicsModelRef.current.setThrottle(1); // Full throttle for simulation
    }
    
    // Re-init EKF if needed
    const currentPos = telemetryData.position;
    sensorFusionRef.current.init(currentPos.lat, currentPos.long, 0);

    if(isCoachEnabled) {
      coachServiceRef.current?.start();
    }
    
     setTelemetryData({
      ...INITIAL_TELEMETRY,
      timestamp: startTimeRef.current,
      event: 'Launch Initiated',
      position: currentPos,
      fusionTier: hasGeoPermission ? FusionTier.TIER_1_FULL_FIDELITY : FusionTier.TIER_3_DEAD_RECKONING,
    });
    
    if (hasGeoPermission) {
        geoWatchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
                sensorFusionRef.current.updateWithGNSS(
                    pos.coords.latitude, 
                    pos.coords.longitude, 
                    pos.coords.altitude || 0,
                    pos.coords.accuracy,
                    pos.coords.speed || 0
                );
            },
            () => {
                 // Error callback
            },
            { enableHighAccuracy: true, maximumAge: 0 }
        );
    }

    // Initialize heading simulation vars
    let simHeading = 0;
    prevHeadingRef.current = 0;
    prevPitchRef.current = 0;
    prevSpeedRef.current = 0;

    intervalRef.current = window.setInterval(() => {
      const dt_ms = TICK_RATE_MS;
      const dt_s = dt_ms / 1000.0;
      
      let physicsState;
      let accelLong = 0;

      if (isOBDConnected && obdDataRef.current) {
          // --- OBD MODE ---
          const obd = obdDataRef.current;
          const speedMps = (obd.speed_kmh || 0) / 3.6;
          const rpm = obd.rpm || 0;
          
          // Inject OBD data into physics model to update gear/rpm/speed state container
          physicsModelRef.current.overrideState(speedMps, rpm);
          
          // Calculate Longitudinal G from speed derivative
          const dv = speedMps - prevSpeedRef.current;
          accelLong = (dv / dt_s) / GRAVITY_MS2;
          prevSpeedRef.current = speedMps;

          // Update physics model with NO simulation (false), just for derived props like loads
          physicsState = physicsModelRef.current.update(dt_ms, false);
          
          // Override calculated G with our derived G
          physicsState.acceleration_g.longitudinal = accelLong;

      } else {
          // --- SIMULATION MODE ---
          physicsState = physicsModelRef.current.update(dt_ms, true);
          
          // Simulate heading change for the demo loop (Driving in circles/figure 8)
          const headingChange = (Math.random() - 0.5) * 5 * (physicsState.speed_mps / 50);
          simHeading = (simHeading + headingChange + 360) % 360;
      }

      
      // Calculate angular velocities (Gyro Simulation - effectively "Soft Gyro" if using phone sensors later)
      // Note: In a real app we would use DeviceMotion event here.
      // For now, we simulate heading behavior or use previous simHeading
      
      const currentHeading = isOBDConnected ? prevHeadingRef.current : simHeading; // In OBD mode, heading assumes straight/locked unless we integrate compass
      
      const headingRad = currentHeading * (Math.PI / 180);
      const pitchRad = physicsState.pitch_angle * (Math.PI / 180);
      
      const yawRate = (headingRad - (prevHeadingRef.current * Math.PI / 180)) / dt_s;
      const pitchRate = (pitchRad - (prevPitchRef.current * Math.PI / 180)) / dt_s;
      const rollRate = 0; 

      prevHeadingRef.current = currentHeading;
      prevPitchRef.current = physicsState.pitch_angle;

      // EKF Prediction Step
      const accelBody = {
          x: physicsState.acceleration_g.longitudinal * GRAVITY_MS2, 
          y: physicsState.acceleration_g.lateral * GRAVITY_MS2,
          z: physicsState.acceleration_g.vertical * GRAVITY_MS2
      };
      
      const gyroBody = { x: rollRate, y: pitchRate, z: yawRate };

      sensorFusionRef.current.predict(dt_s, accelBody, gyroBody);

      // Vision Update (Simulated or Real if we had CV)
      // If OBD is connected, we use OBD speed as the "Vision" truth for now to stabilize GPS
      const measurementSpeed = physicsState.speed_mps;
      const measurementConf = isOBDConnected ? 0.99 : 0.98;
      
      sensorFusionRef.current.updateWithVision(measurementSpeed, measurementConf);

      const fusedState = sensorFusionRef.current.getState();

      setTelemetryData(prevData => {
        const newData: TelemetryStateObject = {
          timestamp: Date.now(),
          speed_mps: physicsState.speed_mps,
          acceleration_g: physicsState.acceleration_g,
          tire_loads: physicsState.tire_loads,
          position: { lat: fusedState.position.lat, long: fusedState.position.long },
          slope_percent: (Math.random() - 0.5) * 0.5,
          pitch_angle: fusedState.orientation_rpy.pitch * (180 / Math.PI), 
          inferred_gear: physicsState.inferred_gear,
          event: physicsState.event,
          fusionTier: isOBDConnected ? FusionTier.TIER_1_FULL_FIDELITY : fusedState.tier, // OBD elevates confidence
          rpm: physicsState.rpm,
          heading: fusedState.orientation_rpy.yaw * (180 / Math.PI),
          prediction: {
              delta: (Math.sin(Date.now() / 3000) * 0.5), 
              predictedLapTime: null 
          },
          uncertainty_m: fusedState.uncertainty
        };
        
        coachServiceRef.current?.analyze(newData);
        currentRunDataRef.current.push(newData);
        setLivePath([...currentRunDataRef.current]);
        
        const newLapData = lapTimerServiceRef.current!.updatePosition(newData);
        setLapData(newLapData);

        return newData;
      });
    }, TICK_RATE_MS);
  };

  const toggleRealtimeCoach = useCallback(() => {
    const wasEnabled = isCoachEnabled;
    if (wasEnabled) {
      coachServiceRef.current?.stop();
    } else if (isRunning) {
      coachServiceRef.current?.start();
    } else {
        setIsCoachEnabled(true);
    }
  }, [isCoachEnabled, isRunning]);
  
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { 
      isRunning, 
      telemetryData, 
      livePath, 
      runHistory, 
      setRunHistory, 
      coaching: { ...coaching, clear: clearCoaching }, 
      startRun, 
      stopRun, 
      isCoachEnabled, 
      isCoachSpeaking, 
      toggleRealtimeCoach,
      lapData,
      setStartFinishLine,
      startFinishLine: lapTimerServiceRef.current?.getStartFinishLine(),
      connectOBD,
      disconnectOBD,
      isOBDConnected
  };
};


const processRunData = (runData: TelemetryStateObject[], laps: LapSummary[]): RunSummary => {
    if (runData.length === 0) throw new Error("Cannot process empty run data");

    const startTime = runData[0].timestamp;
    let zeroToSixty: number | null = null;
    let quarterMileTime: number | null = null;
    let quarterMileSpeed: number | null = null;
    let distanceMeters = 0;
    
    let maxSpeed = 0;
    const maxGForce = { longitudinal: 0, lateral: 0, vertical: 0 };
    
    for(let i = 1; i < runData.length; i++) {
        const prevPoint = runData[i-1];
        const currentPoint = runData[i];
        
        const dt = (currentPoint.timestamp - prevPoint.timestamp) / 1000;
        distanceMeters += prevPoint.speed_mps * dt;

        // update maxes
        if (currentPoint.speed_mps > maxSpeed) maxSpeed = currentPoint.speed_mps;
        if (Math.abs(currentPoint.acceleration_g.longitudinal) > maxGForce.longitudinal) maxGForce.longitudinal = currentPoint.acceleration_g.longitudinal;
        if (Math.abs(currentPoint.acceleration_g.lateral) > maxGForce.lateral) maxGForce.lateral = Math.abs(currentPoint.acceleration_g.lateral);

        // 0-60
        const sixtyMphInMps = 60 * MPS_PER_MPH;
        if (!zeroToSixty && currentPoint.speed_mps >= sixtyMphInMps) {
            zeroToSixty = (currentPoint.timestamp - startTime) / 1000;
        }

        // Quarter mile
        const quarterMileInMeters = METERS_PER_MILE / 4;
        if(!quarterMileTime && distanceMeters >= quarterMileInMeters) {
            quarterMileTime = (currentPoint.timestamp - startTime) / 1000;
            quarterMileSpeed = currentPoint.speed_mps;
        }
    }
    
    const path = runData.map(p => ({ lat: p.position.lat, long: p.position.long, speed_mps: p.speed_mps }));

    return {
        id: `run-${startTime}`,
        date: new Date(startTime).toISOString(),
        zeroToSixty,
        quarterMileTime,
        quarterMileSpeed,
        maxSpeed,
        maxGForce,
        path,
        fullData: runData,
        laps,
    };
};