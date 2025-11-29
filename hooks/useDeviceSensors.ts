
import { useState, useEffect, useRef } from 'react';

export interface MotionData {
  acceleration: { x: number, y: number, z: number };
  rotationRate: { alpha: number, beta: number, gamma: number }; // deg/s
  hasData: boolean;
}

export const useDeviceSensors = (isEnabled: boolean) => {
  const [hasData, setHasData] = useState(false);
  
  // Use refs for high-frequency updates to avoid re-renders in the logic loop
  const sensorsRef = useRef<MotionData>({
    acceleration: { x: 0, y: 0, z: 0 },
    rotationRate: { alpha: 0, beta: 0, gamma: 0 },
    hasData: false
  });

  useEffect(() => {
    if (!isEnabled) return;

    const handleMotion = (event: DeviceMotionEvent) => {
      if (event.accelerationIncludingGravity) {
        // Normalize Android vs iOS coordinates if necessary, 
        // but standard web API is:
        // x: East, y: North, z: Up (screen facing up)
        
        // SensorFusionSDK expects body frame: 
        // x: Forward, y: Right, z: Down (standard automotive) or similar mapping.
        // Phones are usually held portrait. 
        // Portrait Phone: Y is Up (Longitudinal), X is Right (Lateral), Z is forward/back.
        
        // Let's store raw here, remapping happens in consumption
        sensorsRef.current.acceleration = {
            x: event.accelerationIncludingGravity.x || 0,
            y: event.accelerationIncludingGravity.y || 0,
            z: event.accelerationIncludingGravity.z || 0
        };
        
        if (event.rotationRate) {
            sensorsRef.current.rotationRate = {
                alpha: event.rotationRate.alpha || 0, // Z axis (Yaw)
                beta: event.rotationRate.beta || 0,   // X axis (Pitch)
                gamma: event.rotationRate.gamma || 0  // Y axis (Roll)
            };
        }
        
        sensorsRef.current.hasData = true;
        if (!hasData) setHasData(true);
      }
    };

    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [isEnabled, hasData]);

  return sensorsRef;
};
