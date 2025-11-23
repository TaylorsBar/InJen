
import React from 'react';
import { TelemetryStateObject, FusionTier, LapData } from '../types';
import { Gauge } from './Gauge';
import { MPS_PER_MPH } from '../constants';
import { GearIcon, SlopeIcon, GPRIcon, FusionIcon, CoachIcon, SpeakerIcon } from './icons';
import { RealTimeChart } from './RealTimeChart';
import { GForceMeter } from './GForceMeter';
import { ToggleSwitch } from './ToggleSwitch';
import { LapTimer } from './LapTimer';
import { TireMonitor } from './TireMonitor';
import { DeltaTimer } from './DeltaTimer';

interface DashboardProps {
  telemetryData: TelemetryStateObject;
  livePath: TelemetryStateObject[];
  isCoachEnabled: boolean;
  isCoachSpeaking: boolean;
  onToggleCoach: () => void;
  lapData: LapData;
}

const InfoCard: React.FC<{ icon: React.ReactNode, value: string | number, label: string, colorClass?: string, subLabel?: string }> = ({ icon, value, label, colorClass = 'text-cyan-300', subLabel }) => (
    <div className="glass-pane p-2 rounded-lg flex flex-col items-center justify-center">
      {icon}
      <span className={`font-bold font-orbitron text-base ${colorClass}`}>{value}</span>
      <span className="text-gray-400 text-[9px] uppercase tracking-wider">{label}</span>
      {subLabel && <span className="text-gray-600 text-[8px] uppercase">{subLabel}</span>}
    </div>
);

export const Dashboard: React.FC<DashboardProps> = ({ telemetryData, livePath, isCoachEnabled, isCoachSpeaking, onToggleCoach, lapData }) => {
  const speedMph = telemetryData.speed_mps / MPS_PER_MPH;
  
  const fusionTierInfo = {
    [FusionTier.TIER_1_FULL_FIDELITY]: { text: 'EKF', color: 'text-cyan-300', sub: 'Locked' },
    [FusionTier.TIER_2_VISION_DEGRADED]: { text: 'EKF', color: 'text-orange-400', sub: 'Vision Loss' },
    [FusionTier.TIER_3_DEAD_RECKONING]: { text: 'DR', color: 'text-red-500', sub: 'Pred Only' },
    [FusionTier.TIER_4_INITIALIZING]: { text: 'INIT', color: 'text-gray-500', sub: 'Wait' },
  };
  const currentTier = fusionTierInfo[telemetryData.fusionTier];

  const chartMetrics = [
    { key: 'speed', name: 'Speed (MPH)', color: '#22d3ee', path: (d: TelemetryStateObject) => d.speed_mps / MPS_PER_MPH, yaxis: 'y' },
    { key: 'g-force', name: 'Long. G', color: '#f43f5e', path: (d: TelemetryStateObject) => d.acceleration_g.longitudinal, yaxis: 'y2' },
    { key: 'rpm', name: 'RPM', color: '#f59e0b', path: (d: TelemetryStateObject) => d.rpm, yaxis: 'y3' },
  ];

  return (
    <div className="flex flex-col space-y-2 h-full justify-between">
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-2">
             <Gauge
              value={speedMph}
              maxValue={200}
              label="SPEED"
              unit="MPH"
              accentColor="cyan"
            />
            <DeltaTimer delta={telemetryData.prediction.delta} />
        </div>
        <div className="grid grid-rows-2 gap-2">
            <div className="flex gap-2">
                 <GForceMeter gForce={telemetryData.acceleration_g} />
                 <TireMonitor loads={telemetryData.tire_loads} />
            </div>
        </div>
      </div>

      <LapTimer lapData={lapData} />

      <RealTimeChart dataHistory={livePath} metrics={chartMetrics} title="Live Telemetry" />
      
      <div className="grid grid-cols-4 gap-2 text-center text-sm">
        <InfoCard icon={<GearIcon className="w-4 h-4 mb-1 text-cyan-400"/>} value={telemetryData.inferred_gear} label="GEAR" />
        <InfoCard icon={<SlopeIcon className="w-4 h-4 mb-1 text-cyan-400"/>} value={`${telemetryData.slope_percent.toFixed(1)}%`} label="SLOPE" />
        <InfoCard icon={<GPRIcon className="w-4 h-4 mb-1 text-cyan-400"/>} value={`${telemetryData.pitch_angle.toFixed(1)}°`} label="PITCH" />
        <InfoCard 
            icon={<FusionIcon className={`w-4 h-4 mb-1 ${currentTier.color}`}/>} 
            value={currentTier.text} 
            label={currentTier.sub} 
            subLabel={`±${telemetryData.uncertainty_m.toFixed(1)}m`}
            colorClass={currentTier.color} 
        />
      </div>

      <div className="glass-pane p-2 rounded-lg flex items-center justify-between">
          <div className="flex items-center space-x-2">
              <div className={`transition-colors duration-300 ${isCoachEnabled ? 'text-cyan-400' : 'text-gray-500'}`}>
                {isCoachSpeaking ? <SpeakerIcon className="w-5 h-5 animate-pulse" /> : <CoachIcon className="w-5 h-5" />}
              </div>
              <span className={`text-sm font-semibold transition-colors duration-300 ${isCoachEnabled ? 'text-white' : 'text-gray-500'}`}>AI Coach</span>
          </div>
          <ToggleSwitch enabled={isCoachEnabled} onChange={onToggleCoach} />
      </div>
    </div>
  );
};
