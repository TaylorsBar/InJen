
import { useState, useRef, useCallback, useEffect } from 'react';
import { TelemetryStateObject, RunSummary, FusionTier, LapData, LapSummary } from '../types';
import { getCoachingAdvice } from '../services/geminiService';
import { MPS_PER_MPH, METERS_PER_MILE } from '../constants';
import { VehiclePhysics } from '../lib/VehiclePhysics';
import { RealtimeCoachingService } from '../services/realtimeCoachingService';
import { LapTimingService } from '../services/lapTimingService';

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
  position: INITIAL_POSITION,
  slope_percent: 0,
  pitch_angle: 0,
  inferred_gear: 1,
  event: null,
  fusionTier: FusionTier.TIER_4_INITIALIZING,
  rpm: 0,
  heading: 0,
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

  const intervalRef = useRef<number | null>(null);
  const currentRunDataRef = useRef<TelemetryStateObject[]>([]);
  const currentRunLapsRef = useRef<LapSummary[]>([]);
  const startTimeRef = useRef<number>(0);
  const geoWatchIdRef = useRef<number | null>(null);
  const physicsModelRef = useRef<VehiclePhysics>(new VehiclePhysics());
  const coachServiceRef = useRef<RealtimeCoachingService | null>(null);
  const lapTimerServiceRef = useRef<LapTimingService | null>(null);


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
      navigator.geolocation.getCurrentPosition(() => {
        setHasGeoPermission(true);
        if (!isRunning) {
            setTelemetryData(prev => ({...prev, fusionTier: FusionTier.TIER_1_FULL_FIDELITY}));
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
    };
  }, [isRunning]);


  const clearCoaching = () => setCoaching({ advice: null, isLoading: false });
  
  const setStartFinishLine = useCallback(() => {
    lapTimerServiceRef.current?.setStartFinishLine(telemetryData.position, telemetryData.heading);
    // Force a state update to make the line appear on the map
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
    setTelemetryData(prev => ({
        ...INITIAL_TELEMETRY,
        timestamp: Date.now(),
        position: prev.position,
        fusionTier: hasGeoPermission ? FusionTier.TIER_1_FULL_FIDELITY : FusionTier.TIER_3_DEAD_RECKONING
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
    physicsModelRef.current.setThrottle(1); // Full throttle for the run
    if(isCoachEnabled) {
      coachServiceRef.current?.start();
    }
    
    let initialPosition = telemetryData.position;

     setTelemetryData({
      ...INITIAL_TELEMETRY,
      timestamp: startTimeRef.current,
      event: 'Launch Initiated',
      position: initialPosition,
      fusionTier: hasGeoPermission ? FusionTier.TIER_1_FULL_FIDELITY : FusionTier.TIER_3_DEAD_RECKONING,
    });
    
    if (hasGeoPermission) {
        geoWatchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
                setTelemetryData(prev => ({
                    ...prev,
                    position: { lat: pos.coords.latitude, long: pos.coords.longitude },
                    heading: pos.coords.heading || prev.heading,
                    fusionTier: FusionTier.TIER_1_FULL_FIDELITY
                }));
            },
            () => {
                 setTelemetryData(prev => ({ ...prev, fusionTier: FusionTier.TIER_3_DEAD_RECKONING }));
            },
            { enableHighAccuracy: true, maximumAge: 0 }
        );
    }

    // A simulated heading for path generation when in dead reckoning mode
    let simHeading = Math.random() * 360;

    intervalRef.current = window.setInterval(() => {
      const physicsState = physicsModelRef.current.update(TICK_RATE_MS);

      setTelemetryData(prevData => {
        let newPosition = { ...prevData.position };
        let newHeading = prevData.heading;

        // If we are in dead reckoning mode, simulate position path
        if (prevData.fusionTier === FusionTier.TIER_3_DEAD_RECKONING) {
            const distance = physicsState.speed_mps * (TICK_RATE_MS / 1000);
            const earthRadius = 6371000;
            const headingChange = (Math.random() - 0.5) * 5 * (physicsState.speed_mps / 50);
            simHeading = (simHeading + headingChange + 360) % 360;
            newHeading = simHeading;

            const headingRad = simHeading * Math.PI / 180;
            const latRad = prevData.position.lat * Math.PI / 180;
            const dLat = distance * Math.cos(headingRad) / earthRadius;
            const dLon = distance * Math.sin(headingRad) / (earthRadius * Math.cos(latRad));

            newPosition.lat += dLat * 180 / Math.PI;
            newPosition.long += dLon * 180 / Math.PI;
        }

        const newData: TelemetryStateObject = {
          timestamp: Date.now(),
          speed_mps: physicsState.speed_mps,
          acceleration_g: physicsState.acceleration_g,
          position: newPosition,
          slope_percent: (Math.random() - 0.5) * 0.5,
          pitch_angle: (Math.random() - 0.5) * 0.3,
          inferred_gear: physicsState.inferred_gear,
          event: physicsState.event,
          fusionTier: prevData.fusionTier,
          rpm: physicsState.rpm,
          heading: newHeading
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
        // If not running, just toggle the state. It will be started when a run begins.
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
      startFinishLine: lapTimerServiceRef.current?.getStartFinishLine()
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
