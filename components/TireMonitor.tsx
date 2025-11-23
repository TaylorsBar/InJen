
import React from 'react';
import { TireLoads } from '../types';

interface TireMonitorProps {
  loads: TireLoads;
}

const TirePatch: React.FC<{ load: number, label: string }> = ({ load, label }) => {
    // Load ranges from roughly 0.5 to 1.5.
    // < 0.8 = Unloaded (Blue/Cold)
    // 0.8 - 1.2 = Optimal (Green)
    // > 1.2 = High Load (Red/Hot)
    
    let color = '';
    let glow = '';
    
    if (load > 1.2) {
        color = 'bg-red-500';
        glow = 'shadow-[0_0_15px_rgba(239,68,68,0.8)]';
    } else if (load < 0.8) {
        color = 'bg-blue-500';
        glow = 'shadow-[0_0_10px_rgba(59,130,246,0.5)]';
    } else {
        color = 'bg-emerald-500';
        glow = 'shadow-[0_0_10px_rgba(16,185,129,0.5)]';
    }

    // Scale width/height slightly with load for squash effect
    const scale = 0.8 + (load * 0.2);
    
    return (
        <div className="flex flex-col items-center justify-center w-12 h-16">
             <div className="text-[10px] font-mono text-gray-500 mb-1">{label}</div>
             <div 
                className={`w-6 h-10 rounded-sm ${color} ${glow} transition-all duration-100 ease-out`}
                style={{ transform: `scale(${scale})` }}
             />
             <div className="text-[10px] font-mono text-gray-300 mt-1">{load.toFixed(2)}</div>
        </div>
    );
}

export const TireMonitor: React.FC<TireMonitorProps> = ({ loads }) => {
  return (
    <div className="glass-pane p-2 rounded-lg flex flex-col items-center justify-center relative">
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
            {/* Chassis schematic */}
            <div className="w-16 h-32 border-2 border-gray-400 rounded-lg"></div>
            <div className="absolute w-0.5 h-32 bg-gray-600"></div>
            <div className="absolute w-16 h-0.5 bg-gray-600 top-8"></div>
             <div className="absolute w-16 h-0.5 bg-gray-600 bottom-8"></div>
        </div>
        
        <div className="grid grid-cols-2 gap-x-8 gap-y-6 relative z-10">
            <TirePatch load={loads.fl} label="FL" />
            <TirePatch load={loads.fr} label="FR" />
            <TirePatch load={loads.rl} label="RL" />
            <TirePatch load={loads.rr} label="RR" />
        </div>
        <div className="absolute bottom-1 text-[9px] text-gray-500 uppercase tracking-wider">Contact Patch Load</div>
    </div>
  );
};
