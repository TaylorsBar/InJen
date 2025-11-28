
import React, { useEffect, useState } from 'react';
import { TelemetryStateObject, FusionTier } from '../types';
import { MPS_PER_MPH, MAX_RPM, SHIFT_RPM } from '../constants';
import { CameraFeed } from './CameraFeed';
import { FusionIcon, DashboardIcon } from './icons';
import { RaceMap } from './RaceMap';

// --- Visual Sub-Components ---

const Reticle: React.FC<{ pitch: number, roll: number }> = ({ pitch, roll }) => {
    // Pitch Ladder Logic
    // Pitch is in degrees. We want to show a ladder that moves up/down.
    // Roll rotates the entire ladder.
    
    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-60">
            <div 
                className="w-64 h-64 relative transition-transform duration-100 ease-linear"
                style={{ transform: `rotate(${-roll}deg)` }}
            >
                {/* Center Crosshair */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 border border-cyan-400/50 rounded-full flex items-center justify-center">
                    <div className="w-1 h-1 bg-cyan-400 rounded-full shadow-[0_0_10px_#22d3ee]"></div>
                </div>
                <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent"></div>

                {/* Artificial Horizon Lines */}
                <div 
                    className="absolute w-full h-full flex flex-col items-center justify-center gap-12 transition-transform duration-100 ease-linear"
                    style={{ transform: `translateY(${pitch * 4}px)` }}
                >
                    <div className="w-32 h-px bg-cyan-400/30 flex justify-between px-2 text-[8px] text-cyan-400 font-mono"><span>10</span><span>10</span></div>
                    <div className="w-48 h-px bg-cyan-400/50 flex justify-between px-2 text-[8px] text-cyan-400 font-mono"><span>0</span><span>0</span></div>
                    <div className="w-32 h-px bg-cyan-400/30 flex justify-between px-2 text-[8px] text-cyan-400 font-mono"><span>-10</span><span>-10</span></div>
                </div>
            </div>
        </div>
    );
};

const GForceComet: React.FC<{ lateral: number, longitudinal: number }> = ({ lateral, longitudinal }) => {
    const maxG = 1.5;
    const size = 160;
    const center = size / 2;
    // Normalize -1.5 to 1.5 G into chart space
    const x = center + (lateral / maxG) * (size * 0.4);
    const y = center - (longitudinal / maxG) * (size * 0.4);
    
    // Dynamic color based on intensity
    const totalG = Math.sqrt(lateral**2 + longitudinal**2);
    let color = '#22d3ee'; // Cyan
    let glow = '0 0 10px #22d3ee';
    
    if (totalG > 1.0) {
        color = '#facc15'; // Yellow
        glow = '0 0 15px #facc15';
    }
    if (totalG > 1.4) {
        color = '#ef4444'; // Red
        glow = '0 0 20px #ef4444';
    }

    return (
        <div className="relative w-40 h-40">
            {/* Concentric Rings */}
            <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full opacity-40">
                <circle cx={center} cy={center} r={size * 0.2} fill="none" stroke="#22d3ee" strokeWidth="1" strokeDasharray="4 4" />
                <circle cx={center} cy={center} r={size * 0.4} fill="none" stroke="#22d3ee" strokeWidth="1" strokeOpacity="0.5" />
                <line x1={center} y1={center - size*0.4} x2={center} y2={center + size*0.4} stroke="#22d3ee" strokeWidth="1" />
                <line x1={center - size*0.4} y1={center} x2={center + size*0.4} y2={center} stroke="#22d3ee" strokeWidth="1" />
            </svg>
            
            {/* The Comet */}
            <div 
                className="absolute w-4 h-4 rounded-full transition-all duration-75 ease-linear"
                style={{ 
                    left: x - 8, 
                    top: y - 8, 
                    backgroundColor: color,
                    boxShadow: glow
                }}
            />
            {/* Numeric Value */}
            <div className="absolute inset-0 flex items-center justify-center mt-8 pointer-events-none">
                <span className="font-orbitron font-bold text-xs text-cyan-100 tracking-wider bg-black/20 px-2 rounded">
                    {totalG.toFixed(2)} G
                </span>
            </div>
        </div>
    );
};

const RPMBarTop: React.FC<{ rpm: number, maxRpm: number, shiftPoint: number }> = ({ rpm, maxRpm, shiftPoint }) => {
    const pct = Math.min(rpm / maxRpm, 1) * 100;
    const isShift = rpm >= shiftPoint;
    
    return (
        <div className="absolute top-0 left-0 right-0 h-6 z-20 flex items-center justify-center gap-1 overflow-hidden">
            {/* Left Bar */}
            <div className="h-2 flex-grow bg-slate-800/50 skew-x-12 origin-right transform translate-x-2">
                <div 
                    className={`h-full transition-all duration-75 ease-linear ${isShift ? 'bg-red-500 animate-pulse' : 'bg-gradient-to-r from-transparent to-cyan-400'}`}
                    style={{ width: `${pct}%`, marginLeft: 'auto' }}
                />
            </div>
            {/* Center Diamond */}
            <div className={`w-3 h-3 rotate-45 border-2 ${isShift ? 'bg-red-500 border-red-500 animate-pulse shadow-[0_0_20px_red]' : 'border-cyan-400 bg-black'}`} />
            {/* Right Bar */}
            <div className="h-2 flex-grow bg-slate-800/50 -skew-x-12 origin-left transform -translate-x-2">
                <div 
                    className={`h-full transition-all duration-75 ease-linear ${isShift ? 'bg-red-500 animate-pulse' : 'bg-gradient-to-l from-transparent to-cyan-400'}`}
                    style={{ width: `${pct}%`, marginRight: 'auto' }}
                />
            </div>
        </div>
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
    const [mountAnim, setMountAnim] = useState(false);

    useEffect(() => {
        setMountAnim(true);
    }, []);

    // Color logic based on RPM
    const rpmColor = telemetryData.rpm > SHIFT_RPM ? 'text-red-500 text-glow' : 'text-cyan-400';

    return (
        <div className="fixed inset-0 bg-black w-screen h-screen font-inter overflow-hidden select-none">
            <CameraFeed />
            
            {/* Vignette & Scanlines Overlay */}
            <div className="absolute inset-0 pointer-events-none z-0" 
                 style={{ 
                     background: 'radial-gradient(circle at center, transparent 60%, black 100%)',
                     backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
                     backgroundSize: '100% 2px, 3px 100%'
                 }} 
            />

            {/* Top RPM Bar */}
            <RPMBarTop rpm={telemetryData.rpm} maxRpm={MAX_RPM} shiftPoint={SHIFT_RPM} />

            {/* Main HUD Container */}
            <div className={`absolute inset-0 p-4 flex flex-col justify-between transition-opacity duration-1000 ${mountAnim ? 'opacity-100' : 'opacity-0'}`}>
                
                {/* Top Row: Meta Info & Exit */}
                <div className="flex justify-between items-start z-10 pointer-events-auto">
                    <div className="flex flex-col gap-1">
                        <button 
                            onClick={onExit}
                            className="flex items-center gap-2 bg-black/40 backdrop-blur-md border border-cyan-500/30 px-3 py-1.5 rounded-br-xl hover:bg-cyan-900/40 transition-colors group"
                        >
                            <DashboardIcon className="w-4 h-4 text-cyan-400 group-hover:text-white" />
                            <span className="text-[10px] font-bold text-cyan-400 font-orbitron group-hover:text-white">EXIT HUD</span>
                        </button>
                        <div className="flex items-center gap-2 px-2">
                            <FusionIcon className={`w-3 h-3 ${telemetryData.fusionTier === FusionTier.TIER_1_FULL_FIDELITY ? 'text-cyan-400' : 'text-yellow-500'}`} />
                            <span className="text-[9px] text-cyan-200 font-mono tracking-widest">{telemetryData.fusionTier.replace('TIER_', '')}</span>
                        </div>
                    </div>

                    {livePath.length > 5 && (
                        <div className="w-48 h-24 bg-black/40 backdrop-blur-md rounded-bl-xl border-b border-l border-cyan-500/20 overflow-hidden relative">
                            <div className="absolute inset-0 opacity-70 grayscale contrast-125">
                                <RaceMap data={miniMapPath} currentPosition={telemetryData.position} />
                            </div>
                            <div className="absolute bottom-1 right-2 text-[9px] text-cyan-400 font-orbitron">TRACK MAP</div>
                        </div>
                    )}
                </div>

                {/* Center: Reticle & Horizon */}
                <Reticle pitch={telemetryData.pitch_angle} roll={telemetryData.acceleration_g.lateral * -5} />

                {/* Bottom Row: The "Cockpit" */}
                <div className="relative flex items-end justify-between w-full pb-2 z-10">
                    
                    {/* Left Wing: G-Force */}
                    <div className="w-1/4 min-w-[150px] flex flex-col items-start gap-2 transform origin-bottom-left skew-x-3">
                        <div className="bg-black/60 backdrop-blur-md border-t border-r border-cyan-500/30 rounded-tr-3xl p-4 w-full relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/50"></div>
                            <h3 className="text-[10px] text-cyan-300 font-bold uppercase tracking-widest mb-2 opacity-70">G-Force</h3>
                            <div className="flex justify-center -skew-x-3">
                                <GForceComet lateral={telemetryData.acceleration_g.lateral} longitudinal={telemetryData.acceleration_g.longitudinal} />
                            </div>
                        </div>
                    </div>

                    {/* Center Stack: Speed & Gear */}
                    <div className="flex flex-col items-center flex-grow mx-4 mb-4">
                        {/* Speed */}
                        <div className="relative">
                            <h1 className="text-9xl font-black font-orbitron text-white italic tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" style={{ lineHeight: '0.8' }}>
                                {Math.floor(speedMph)}
                            </h1>
                            <span className="absolute -right-12 bottom-4 text-xl font-bold text-cyan-400 font-orbitron tracking-widest rotate-90 origin-left">MPH</span>
                        </div>
                        
                        {/* Gear & RPM */}
                        <div className="flex items-center gap-6 mt-2 bg-black/40 backdrop-blur px-8 py-2 rounded-full border border-white/10">
                            <div className="flex flex-col items-center">
                                <span className={`text-3xl font-black font-orbitron ${rpmColor} tabular-nums`}>{telemetryData.rpm.toFixed(0)}</span>
                                <span className="text-[9px] text-gray-400 font-bold tracking-[0.2em]">RPM</span>
                            </div>
                            <div className="w-px h-10 bg-white/20"></div>
                            <div className="flex flex-col items-center">
                                <span className="text-5xl font-black font-orbitron text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]">
                                    {telemetryData.inferred_gear}
                                </span>
                                <span className="text-[9px] text-gray-400 font-bold tracking-[0.2em]">GEAR</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Wing: Telemetry Data */}
                    <div className="w-1/4 min-w-[150px] flex flex-col items-end gap-2 transform origin-bottom-right -skew-x-3">
                        <div className="bg-black/60 backdrop-blur-md border-t border-l border-cyan-500/30 rounded-tl-3xl p-4 w-full relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-1 h-full bg-cyan-500/50"></div>
                            <h3 className="text-[10px] text-cyan-300 font-bold uppercase tracking-widest mb-2 opacity-70 text-right -skew-x-[-3deg]">Metrics</h3>
                            
                            <div className="space-y-3 -skew-x-[-3deg]">
                                <div className="flex justify-between items-end border-b border-white/10 pb-1">
                                    <span className="text-[9px] text-gray-400 uppercase">Delta</span>
                                    <span className={`text-xl font-mono font-bold ${telemetryData.prediction.delta > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                        {telemetryData.prediction.delta > 0 ? '+' : ''}{telemetryData.prediction.delta.toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-end border-b border-white/10 pb-1">
                                    <span className="text-[9px] text-gray-400 uppercase">Throttle</span>
                                    <span className="text-xl font-mono font-bold text-white">{telemetryData.obd_info?.throttle_pos || 0}<span className="text-xs text-gray-500">%</span></span>
                                </div>
                                <div className="flex justify-between items-end">
                                    <span className="text-[9px] text-gray-400 uppercase">Temp</span>
                                    <span className="text-xl font-mono font-bold text-white">{telemetryData.obd_info?.coolant_temp || 90}<span className="text-xs text-gray-500">°C</span></span>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
