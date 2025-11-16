
import React, { useEffect, useState } from 'react';
import { LapData } from '../types';

interface LapTimerProps {
  lapData: LapData;
}

const formatTime = (timeMs: number): string => {
  const minutes = Math.floor(timeMs / 60000);
  const seconds = Math.floor((timeMs % 60000) / 1000);
  const milliseconds = Math.floor((timeMs % 1000) / 10);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
};

const LapColumn: React.FC<{
    label: string;
    value: string | number;
    isTime?: boolean;
    isBest?: boolean;
    highlightOnChange?: any;
}> = ({ label, value, isTime = false, isBest = false, highlightOnChange = null }) => {

    const [flash, setFlash] = useState(false);

    useEffect(() => {
        if (highlightOnChange !== null) {
            setFlash(true);
            const timer = setTimeout(() => setFlash(false), 700);
            return () => clearTimeout(timer);
        }
    }, [highlightOnChange]);

    const valueColor = isBest ? 'text-yellow-300 text-glow' : 'text-white';
    const flashClass = flash ? (isBest ? 'bg-yellow-400/20' : 'bg-cyan-500/20') : '';
    const valueSize = isTime ? 'text-xl' : 'text-3xl';
    
    return (
        <div className={`flex flex-col items-center justify-center px-2 py-1 rounded-md transition-colors duration-300 ${flashClass}`}>
            <div className="text-gray-400 text-xs uppercase tracking-wider">{label}</div>
            <div className={`${valueSize} font-bold font-orbitron ${valueColor}`}>{value}</div>
        </div>
    );
}

export const LapTimer: React.FC<LapTimerProps> = ({ lapData }) => {
  return (
    <div className="glass-pane p-1 rounded-lg grid grid-cols-4 divide-x divide-white/10 text-center">
        <LapColumn label="Lap" value={lapData.lap} />
        <LapColumn label="Current" value={formatTime(lapData.currentLapTime)} isTime />
        <LapColumn label="Last" value={lapData.lastLapTime !== null ? formatTime(lapData.lastLapTime) : '--:--.--'} isTime highlightOnChange={lapData.lastLapTime} />
        <LapColumn label="Best" value={lapData.bestLapTime !== null ? formatTime(lapData.bestLapTime) : '--:--.--'} isTime isBest={lapData.bestLapTime !== null && lapData.lastLapTime === lapData.bestLapTime} highlightOnChange={lapData.bestLapTime} />
    </div>
  );
};
