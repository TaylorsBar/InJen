
import React from 'react';
import { TelemetryStateObject, FusionTier, LapData } from '../types';
import { Gauge } from './Gauge';
import { MPS_PER_MPH, MAX_RPM, SHIFT_RPM } from '../constants';
import { GearIcon, SlopeIcon, GPRIcon, FusionIcon, CoachIcon, SpeakerIcon } from './icons';
import { RealTimeChart } from './RealTimeChart';
import { GForceMeter } from './GForceMeter';
import { ToggleSwitch } from './ToggleSwitch';
import { LapTimer } from './LapTimer';
import { TireMonitor } from './TireMonitor';
import { DeltaTimer } from './DeltaTimer';
import { AutometerTach } from './AutometerTach';
import { useTheme } from '../hooks/useTheme';

interface DashboardProps {
  telemetryData: TelemetryStateObject;
  livePath: TelemetryStateObject[];
  isCoachEnabled: boolean;
  isCoachSpeaking: boolean;
  onToggleCoach: () => void;
  lapData: LapData;
}

const InfoCard: React.FC<{ icon: React.ReactNode, value: string | number, label: string, colorClass?: string, subLabel?: string }> = ({ icon, value, label, colorClass, subLabel }) => {
    const { theme } = useTheme();
    return (
        <div className={`glass-pane p-2 rounded-xl flex flex-col items-center justify-center border border-white/5 relative overflow-hidden group`}>
            {/* Subtle Gradient Hover */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            
            <div className="mb-1 opacity-80">{icon}</div>
            <span className={`font-bold font-orbitron text-lg leading-none ${colorClass || theme.colors.accent} drop-shadow-sm`}>{value}</span>
            <span className="text-gray-500 text-[9px] uppercase tracking-widest font-semibold mt-1">{label}</span>
            {subLabel && <span className="text-gray-600 text-[9px] font-mono">{subLabel}</span>}
        </div>
    );
};

export const Dashboard: React.FC<DashboardProps> = ({ telemetryData, livePath, isCoachEnabled, isCoachSpeaking, onToggleCoach, lapData }) => {
  const { theme } = useTheme();
  const speedMph = telemetryData.speed_mps / MPS_PER_MPH;
  
  const fusionTierInfo = {
    [FusionTier.TIER_1_FULL_FIDELITY]: { text: 'EKF', color: theme.colors.accent, sub: 'LOCKED' },
    [FusionTier.TIER_2_VISION_DEGRADED]: { text: 'EKF', color: 'text-orange-400', sub: 'NO VIS' },
    [FusionTier.TIER_3_DEAD_RECKONING]: { text: 'IMU', color: 'text-red-500', sub: 'DR MODE' },
    [FusionTier.TIER_4_INITIALIZING]: { text: 'INIT', color: 'text-gray-500', sub: 'WAIT' },
  };
  const currentTier = fusionTierInfo[telemetryData.fusionTier];

  const chartMetrics = [
    { key: 'speed', name: 'Speed (MPH)', color: theme.id === 'rosso' ? '#ef4444' : '#22d3ee', path: (d: TelemetryStateObject) => d.speed_mps / MPS_PER_MPH, yaxis: 'y' },
    { key: 'g-force', name: 'Long. G', color: theme.id === 'trackday' ? '#f59e0b' : '#f43f5e', path: (d: TelemetryStateObject) => d.acceleration_g.longitudinal, yaxis: 'y2' },
    { key: 'rpm', name: 'RPM', color: '#a3a3a3', path: (d: TelemetryStateObject) => d.rpm, yaxis: 'y3' },
  ];

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Top Section: Tach, Speed, Physics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="flex flex-col gap-3">
             <div className="flex gap-3 h-40">
                 {/* Tachometer Container */}
                 <div className={`w-1/2 glass-pane rounded-2xl p-2 flex items-center justify-center border border-white/10 shadow-lg relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-transparent pointer-events-none"></div>
                    <AutometerTach 
                        rpm={telemetryData.rpm} 
                        maxRpm={MAX_RPM} 
                        shiftPoint={SHIFT_RPM} 
                        size="100%"
                        className="scale-95"
                    />
                 </div>
                 
                 {/* Speedometer Container */}
                 <div className="w-1/2 h-full">
                    <Gauge
                        value={speedMph}
                        maxValue={200}
                        label="SPEED"
                        unit="MPH"
                        accentColor={theme.id === 'rosso' ? 'red' : theme.id === 'trackday' ? 'yellow' : 'cyan'}
                    />
                 </div>
             </div>
             
             {/* Delta Timing */}
            <DeltaTimer delta={telemetryData.prediction.delta} />
        </div>

        {/* Physics Monitors */}
        <div className="grid grid-rows-1 gap-3 h-40">
            <div className="flex gap-3 h-full">
                 <div className="w-1/2 h-full"><GForceMeter gForce={telemetryData.acceleration_g} /></div>
                 <div className="w-1/2 h-full"><TireMonitor loads={telemetryData.tire_loads} /></div>
            </div>
        </div>
      </div>

      <LapTimer lapData={lapData} />

      <RealTimeChart dataHistory={livePath} metrics={chartMetrics} title="Live Telemetry Stream" />
      
      {/* Telemetry Grid */}
      <div className="grid grid-cols-4 gap-3 text-center">
        <InfoCard icon={<GearIcon className={`w-4 h-4 ${theme.colors.primary}`}/>} value={telemetryData.inferred_gear} label="GEAR" />
        <InfoCard icon={<SlopeIcon className={`w-4 h-4 ${theme.colors.primary}`}/>} value={`${telemetryData.slope_percent.toFixed(1)}%`} label="GRADE" />
        <InfoCard icon={<GPRIcon className={`w-4 h-4 ${theme.colors.primary}`}/>} value={`${telemetryData.pitch_angle.toFixed(1)}°`} label="PITCH" />
        <InfoCard 
            icon={<FusionIcon className={`w-4 h-4 ${currentTier.color}`}/>} 
            value={currentTier.text} 
            label={currentTier.sub} 
            subLabel={`±${telemetryData.uncertainty_m.toFixed(1)}m`}
            colorClass={currentTier.color} 
        />
      </div>

      {/* AI Coach Toggle */}
      <div className={`glass-pane px-4 py-3 rounded-xl flex items-center justify-between border border-white/5 bg-gradient-to-r from-transparent to-white/5`}>
          <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-full bg-black/40 ${isCoachEnabled ? theme.colors.accent : 'text-gray-500'}`}>
                {isCoachSpeaking ? <SpeakerIcon className="w-5 h-5 animate-pulse" /> : <CoachIcon className="w-5 h-5" />}
              </div>
              <div className="flex flex-col">
                  <span className={`text-sm font-bold font-orbitron tracking-wider ${isCoachEnabled ? 'text-white' : 'text-gray-500'}`}>GENESIS COACH</span>
                  <span className="text-[10px] text-gray-500">Real-time driver feedback</span>
              </div>
          </div>
          <ToggleSwitch enabled={isCoachEnabled} onChange={onToggleCoach} />
      </div>
    </div>
  );
};
