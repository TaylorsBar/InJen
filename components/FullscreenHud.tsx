
import React from 'react';
import { TelemetryStateObject, FusionTier } from '../types';
import { MPS_PER_MPH } from '../constants';
import { CameraFeed } from './CameraFeed';
import { FusionIcon, DashboardIcon } from './icons';
import { RaceMap } from './RaceMap';

// --- Sub-components for the HUD ---

const FusionStatusIndicator: React.FC<{ tier: FusionTier }> = ({ tier }) => {
    const tierInfo = {
        [FusionTier.TIER_1_FULL_FIDELITY]: { text: 'GNSS LOCK', color: 'text-cyan-100 border-cyan-400/50' },
        [FusionTier.TIER_3_DEAD_RECKONING]: { text: 'DEAD RECKONING', color: 'text-yellow-100 border-yellow-400/50' },
        [FusionTier.TIER_4_INITIALIZING]: { text: 'INITIALIZING', color: 'text-gray-200 border-gray-500/50' },
    };
    const current = tierInfo[tier];

    return (
        <div className={`glass-pane flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold border ${current.color}`}>
            <FusionIcon className="w-3 h-3" />
            <span>{current.text}</span>
        </div>
    );
};

const GForceDisplay: React.FC<{ lateral: number, longitudinal: number }> = ({ lateral, longitudinal }) => {
    const maxG = 2.0;
    const size = 120;
    const center = size / 2;
    const plotRadius = size * 0.4;

    const x = center + (lateral / maxG) * plotRadius;
    const y = center - (longitudinal / maxG) * plotRadius; // Y is inverted

    return (
        <div className="w-full h-28 relative flex flex-col glass-pane p-1 rounded-lg">
            <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
                {/* Grid */}
                <circle cx={center} cy={center} r={plotRadius * 0.5} stroke="#374151" strokeWidth="0.5" fill="none" />
                <circle cx={center} cy={center} r={plotRadius} stroke="#475569" strokeWidth="0.5" fill="none" />
                <line x1={center} y1={center - plotRadius} x2={center} y2={center + plotRadius} stroke="#374151" strokeWidth="0.5" />
                <line x1={center - plotRadius} y1={center} x2={center + plotRadius} y2={center} stroke="#374151" strokeWidth="0.5" />
                {/* Dot */}
                <circle
                    cx={x} cy={y} r={4} fill="#22d3ee" stroke="#0f172a" strokeWidth="1"
                    className="transition-all duration-100 ease-linear"
                    style={{ filter: 'drop-shadow(0 0 3px #22d3ee)' }}
                />
            </svg>
            <div className="flex justify-between mt-0.5 px-1">
                <div className="text-[10px] font-mono"><span className="text-gray-400">LAT:</span> {lateral.toFixed(2)}</div>
                <div className="text-[10px] font-mono"><span className="text-gray-400">LON:</span> {longitudinal.toFixed(2)}</div>
            </div>
        </div>
    );
}

const RpmArcGauge: React.FC<{ rpm: number; maxRpm: number }> = ({ rpm, maxRpm }) => {
  const size = 300;
  const strokeWidth = 12;
  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = Math.PI * radius; // Semicircle

  const percentage = Math.min(rpm / maxRpm, 1);
  const offset = circumference - percentage * circumference;

  const getColor = () => {
    if (percentage > 0.9) return 'stroke-red-500';
    if (percentage > 0.75) return 'stroke-yellow-400';
    return 'stroke-cyan-400';
  };

  const glowClass = () => {
    if (percentage > 0.9) return 'drop-shadow-[0_0_5px_rgba(239,68,68,0.9)]';
    if (percentage > 0.75) return 'drop-shadow-[0_0_5px_rgba(250,204,21,0.9)]';
    return 'drop-shadow-[0_0_5px_rgba(34,211,238,0.9)]';
  }

  return (
    <svg width={size} height={size / 2} viewBox={`0 0 ${size} ${size / 2}`} className="overflow-visible">
      <path
        d={`M ${strokeWidth},${center} A ${radius},${radius} 0 0 1 ${size - strokeWidth},${center}`}
        className="stroke-slate-700/50"
        strokeWidth={strokeWidth}
        fill="transparent"
        strokeLinecap="round"
      />
      <path
        d={`M ${strokeWidth},${center} A ${radius},${radius} 0 0 1 ${size - strokeWidth},${center}`}
        className={`${getColor()} ${glowClass()} transition-stroke duration-100`}
        strokeWidth={strokeWidth}
        fill="transparent"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
    </svg>
  );
};


// --- Main HUD Component ---
interface FullscreenHudProps {
  telemetryData: TelemetryStateObject;
  livePath: TelemetryStateObject[];
  onExit: () => void;
}

export const FullscreenHud: React.FC<FullscreenHudProps> = ({ telemetryData, livePath, onExit }) => {
    const speedMph = telemetryData.speed_mps / MPS_PER_MPH;
    const miniMapPath = livePath.slice(-200);

    return (
        <div className="fixed inset-0 bg-black w-screen h-screen font-inter">
            <div className="absolute inset-0">
                <CameraFeed />
            </div>
            <div className="absolute inset-0 p-2 text-white pointer-events-none flex flex-col justify-between">
                {/* TOP ROW */}
                <div className="w-full flex justify-between items-start pointer-events-auto">
                    <div className="flex items-center gap-2">
                         <button 
                            onClick={onExit}
                            className="bg-slate-900/60 p-2 rounded-full border border-white/10 hover:bg-slate-800/80 transition-colors backdrop-blur-md"
                        >
                            <DashboardIcon className="w-5 h-5 text-gray-300" />
                        </button>
                        <FusionStatusIndicator tier={telemetryData.fusionTier} />
                    </div>
                    {livePath.length > 1 && (
                        <div className="w-40 h-28 glass-pane rounded-lg p-1">
                            <RaceMap 
                                data={miniMapPath}
                                currentPosition={telemetryData.position}
                            />
                        </div>
                    )}
                </div>

                {/* MAIN TELEMETRY ROW */}
                <div className="flex items-end justify-between w-full">
                    <div className="w-40">
                       <GForceDisplay lateral={telemetryData.acceleration_g.lateral} longitudinal={telemetryData.acceleration_g.longitudinal} />
                    </div>

                    <div className="flex flex-col items-center flex-grow mx-2">
                        <RpmArcGauge rpm={telemetryData.rpm} maxRpm={8000} />
                        <div className="flex items-baseline -mt-[72px]">
                            <span className="text-8xl font-orbitron font-black text-glow" style={{fontFeatureSettings: '"tnum"'}}>{Math.floor(speedMph).toString().padStart(3,'\u00A0')}</span>
                            <span className="text-3xl font-orbitron ml-2">MPH</span>
                        </div>
                         <div className="font-orbitron text-xl font-bold text-glow -mt-2">
                            {Math.round(telemetryData.rpm)} <span className="text-base">RPM</span>
                        </div>
                    </div>

                    <div className="w-40 text-center glass-pane p-2 rounded-lg flex flex-col justify-center h-28">
                        <div className="text-gray-400 uppercase tracking-widest text-base">Gear</div>
                        <div className="text-7xl font-orbitron font-black text-glow">{telemetryData.inferred_gear}</div>
                    </div>
                </div>
                
                {/* BOTTOM ROW (Exit message) */}
                 <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-center text-xs text-gray-400 bg-black/40 px-2 py-0.5 rounded-md">
                   Rotate device to portrait or click icon to exit
                 </div>
            </div>
        </div>
    );
};
