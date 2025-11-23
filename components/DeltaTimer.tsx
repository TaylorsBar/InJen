
import React from 'react';

interface DeltaTimerProps {
    delta: number;
}

export const DeltaTimer: React.FC<DeltaTimerProps> = ({ delta }) => {
    const isPositive = delta > 0; // Slower
    const color = isPositive ? 'text-red-500' : 'text-emerald-400';
    const sign = isPositive ? '+' : '';
    const formatted = delta.toFixed(3);
    
    return (
        <div className="glass-pane p-2 rounded-lg flex flex-col items-center justify-center w-full">
            <div className="text-gray-400 text-xs uppercase tracking-widest">Predicted Delta</div>
            <div className={`text-4xl font-bold font-orbitron tabular-nums tracking-tight ${color} drop-shadow-lg`}>
                {sign}{formatted}
            </div>
        </div>
    );
};
