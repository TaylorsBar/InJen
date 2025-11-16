
import React from 'react';
import { TelemetryStateObject, FusionTier } from '../types';
import { MPS_PER_MPH } from '../constants';
import { FusionIcon } from './icons';
import { RaceMap } from './RaceMap';
import { CameraFeed } from './CameraFeed';

interface VideoOverlayProps {
  telemetryData: TelemetryStateObject;
  livePath: TelemetryStateObject[];
  showHud?: boolean;
}

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


export const VideoOverlay: React.FC<VideoOverlayProps> = ({ telemetryData, livePath, showHud = true }) => {
  const speedMph = telemetryData.speed_mps / MPS_PER_MPH;
  const miniMapPath = livePath.slice(-200); // Show last N points of path

  return (
    <div className="w-full h-full bg-black relative overflow-hidden">
      <CameraFeed />
      
      {/* AR HUD Overlay */}
      {showHud && (
          <div className="absolute inset-0 p-2 flex flex-col justify-between pointer-events-none">
            {/* Top data */}
            <div className="flex justify-between items-start">
                <div className="flex flex-col items-start space-y-2">
                    <div className="glass-pane p-2 rounded-lg inline-block">
                        <div className="text-red-500 text-xs tracking-widest font-bold flex items-center"><span className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></span>REC</div>
                        <div className="text-white text-base font-mono">{new Date(telemetryData.timestamp).toLocaleTimeString()}</div>
                    </div>
                    <FusionStatusIndicator tier={telemetryData.fusionTier} />
                </div>
                {/* Mini Map */}
                {livePath.length > 1 && (
                    <div className="w-32 h-24 sm:w-40 sm:h-28 glass-pane rounded-lg p-1 pointer-events-auto">
                        <RaceMap 
                            data={miniMapPath}
                            currentPosition={telemetryData.position}
                        />
                    </div>
                )}
            </div>
            
            {/* Bottom center data */}
            <div className="flex justify-center items-end space-x-4 text-white text-center">
                <div className="w-24 glass-pane p-2 rounded-lg">
                    <div className="text-gray-300 text-sm uppercase tracking-wider">G-Force</div>
                    <div className="text-3xl font-bold font-orbitron">{telemetryData.acceleration_g.longitudinal.toFixed(2)}</div>
                </div>
                <div className="w-40 glass-pane p-2 rounded-lg">
                    <div className="text-cyan-400 text-xl uppercase tracking-widest">Speed</div>
                    <div className="text-cyan-300 text-7xl font-bold font-orbitron text-glow" >{Math.floor(speedMph)}</div>
                    <div className="text-cyan-400 text-xl">MPH</div>
                </div>
                <div className="w-24 glass-pane p-2 rounded-lg">
                    <div className="text-gray-300 text-sm uppercase tracking-wider">Gear</div>
                    <div className="text-3xl font-bold font-orbitron">{telemetryData.inferred_gear}</div>
                </div>
            </div>
          </div>
      )}
    </div>
  );
};
