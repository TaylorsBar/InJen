import React, { useState } from 'react';
import { platformService } from '../services/platformService';
import { GPRIcon, CloseIcon } from './icons'; // Assuming CheckIcon exists or we can reuse others

interface SensorPermissionModalProps {
  onGranted: () => void;
  onSkipped: () => void;
}

export const SensorPermissionModal: React.FC<SensorPermissionModalProps> = ({ onGranted, onSkipped }) => {
  const [status, setStatus] = useState<'idle' | 'requesting' | 'denied'>('idle');

  const handleRequest = async () => {
    setStatus('requesting');
    const result = await platformService.requestMotionPermission();
    if (result === 'granted') {
      onGranted();
    } else {
      setStatus('denied');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[100] p-6">
      <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl w-full max-w-md p-6 shadow-[0_0_50px_rgba(6,182,212,0.15)] relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent"></div>
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl"></div>

        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center mb-4 border border-cyan-500/20">
            <GPRIcon className="w-8 h-8 text-cyan-400" />
          </div>

          <h2 className="text-xl font-bold font-orbitron text-white mb-2">Sensor Access Required</h2>
          <p className="text-gray-400 text-sm mb-6 leading-relaxed">
            Genesis requires access to your device's <strong>Accelerometer</strong> and <strong>Gyroscope</strong> to enable:
          </p>

          <div className="w-full space-y-3 mb-8 text-left">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_cyan]"></div>
                <span className="text-sm text-gray-200">Real-time G-Force Meter</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_cyan]"></div>
                <span className="text-sm text-gray-200">Dead Reckoning (Tunnel Navigation)</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_cyan]"></div>
                <span className="text-sm text-gray-200">Vehicle Pitch & Roll Detection</span>
            </div>
          </div>

          {status === 'denied' && (
            <div className="w-full p-3 mb-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">
              Access denied. Please check your browser settings or reload the page to try again.
            </div>
          )}

          <button
            onClick={handleRequest}
            className="w-full py-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold font-orbitron tracking-wider transition-all shadow-lg shadow-cyan-900/20 mb-3"
          >
            INITIALIZE SENSORS
          </button>
          
          <button
            onClick={onSkipped}
            className="text-gray-500 text-xs hover:text-white transition-colors"
          >
            Continue with simulated sensors
          </button>
        </div>
      </div>
    </div>
  );
};