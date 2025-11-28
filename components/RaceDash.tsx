
import React from 'react';
import { TelemetryStateObject, LapData } from '../types';
import { MPS_PER_MPH, MAX_RPM, SHIFT_RPM } from '../constants';
import { AutometerTach } from './AutometerTach';
import { useTheme } from '../hooks/useTheme';

interface RaceDashProps {
  telemetryData: TelemetryStateObject;
  lapData: LapData;
}

const DigitalReadout: React.FC<{ label: string; value: string | number; unit?: string; size?: 'sm' | 'md' | 'lg'; color?: string }> = ({ 
    label, value, unit, size = 'md', color = 'text-white' 
}) => {
    const sizeClasses = {
        sm: 'text-2xl',
        md: 'text-4xl',
        lg: 'text-6xl sm:text-7xl',
    };
    const { theme } = useTheme();

    return (
        <div className={`bg-slate-900/90 border ${theme.colors.border} rounded-lg p-2 flex flex-col items-center justify-center shadow-lg w-full h-full relative overflow-hidden group`}>
            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none"></div>
            
            <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">{label}</span>
            <div className={`font-orbitron font-bold tabular-nums leading-none ${sizeClasses[size]} ${color} drop-shadow-md z-10`}>
                {value}
                {unit && <span className="text-sm sm:text-base text-gray-400 ml-1 font-sans font-normal">{unit}</span>}
            </div>
        </div>
    );
};

export const RaceDash: React.FC<RaceDashProps> = ({ telemetryData, lapData }) => {
    const speedMph = telemetryData.speed_mps / MPS_PER_MPH;
    const { theme } = useTheme();

    return (
        <div className="w-full h-full bg-slate-950 relative overflow-hidden flex p-2 gap-2">
             {/* Background Texture based on Theme */}
            <div className="absolute inset-0 opacity-30 pointer-events-none" 
                 style={{ 
                     backgroundImage: `radial-gradient(circle at center, ${theme.id === 'rosso' ? '#450a0a' : '#334155'} 0%, #020617 100%)`,
                     backgroundSize: '100% 100%'
                 }}>
            </div>
             <div className="absolute inset-0 opacity-10 pointer-events-none"
                style={{
                    backgroundImage: `linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000), linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000)`,
                    backgroundSize: '4px 4px',
                    backgroundPosition: '0 0, 2px 2px'
                }}
             ></div>

            {/* Left Column: Secondary Gauges */}
            <div className="flex flex-col gap-2 w-1/4 max-w-[150px] z-10">
                 <DigitalReadout 
                    label="Water" 
                    value={telemetryData.obd_info?.coolant_temp || '--'} 
                    unit="°C" 
                    color={telemetryData.obd_info?.coolant_temp && telemetryData.obd_info.coolant_temp > 105 ? 'text-red-500' : theme.colors.accent}
                    size="sm"
                 />
                 <DigitalReadout 
                    label="Volts" 
                    value={telemetryData.obd_info?.battery_voltage.toFixed(1) || '--'} 
                    unit="V" 
                    color={telemetryData.obd_info?.battery_voltage && telemetryData.obd_info.battery_voltage < 12 ? 'text-red-500' : 'text-green-300'}
                    size="sm"
                 />
                 <DigitalReadout 
                    label="TPS" 
                    value={telemetryData.obd_info?.throttle_pos.toFixed(0) || '--'} 
                    unit="%" 
                    color="text-yellow-300"
                    size="sm"
                 />
                 <div className={`flex-grow bg-slate-900/90 border ${theme.colors.border} rounded-lg p-2 flex flex-col items-center justify-center`}>
                     <span className="text-[10px] text-gray-500 font-bold uppercase mb-1">Delta</span>
                     <span className={`text-2xl font-orbitron font-bold ${telemetryData.prediction.delta <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                         {telemetryData.prediction.delta > 0 ? '+' : ''}{telemetryData.prediction.delta.toFixed(2)}
                     </span>
                 </div>
            </div>

            {/* Center: Monster Tach */}
            <div className="flex-grow flex items-center justify-center z-10 relative">
                <div className="w-full max-w-[600px] aspect-square flex items-center justify-center">
                    <AutometerTach 
                        rpm={telemetryData.rpm} 
                        maxRpm={MAX_RPM} 
                        shiftPoint={SHIFT_RPM} 
                        redline={8000} 
                    />
                </div>
            </div>

            {/* Right Column: Speed & Gear */}
            <div className="flex flex-col gap-2 w-1/3 max-w-[200px] z-10">
                <div className="h-1/3">
                    <DigitalReadout 
                        label="Gear" 
                        value={telemetryData.inferred_gear} 
                        size="lg"
                        color="text-yellow-400"
                    />
                </div>
                <div className="h-1/3">
                     <DigitalReadout 
                        label="Speed" 
                        value={Math.floor(speedMph)} 
                        unit="MPH"
                        size="lg"
                        color={theme.colors.accent}
                    />
                </div>
                 <div className={`h-1/3 bg-slate-900/90 border ${theme.colors.border} rounded-lg p-2 flex flex-col items-center justify-center`}>
                     <span className="text-[10px] text-gray-500 font-bold uppercase mb-1">Last Lap</span>
                     <span className="text-3xl font-orbitron font-bold text-white">
                         {lapData.lastLapTime ? (lapData.lastLapTime/1000).toFixed(2) : '--.--'}
                     </span>
                 </div>
            </div>
        </div>
    );
};
