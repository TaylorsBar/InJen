
import React, { useState, useEffect } from 'react';
import { RunSummary, TelemetryStateObject } from '../types';
import { MPS_PER_MPH } from '../constants';
import { CoachIcon, CloseIcon } from './icons';
import { RaceMap } from './RaceMap';
import { TelemetryCharts } from '../lib/TelemetryCharts';

interface CoachingModalProps {
  isLoading: boolean;
  onClose: () => void;
  runSummary: RunSummary | null;
}

type AnalysisTab = 'map' | 'gg-diagram';

const formatTime = (timeMs: number): string => {
  const minutes = Math.floor(timeMs / 60000);
  const seconds = Math.floor((timeMs % 60000) / 1000);
  const milliseconds = Math.floor((timeMs % 1000) / 10);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
};

export const CoachingModal: React.FC<CoachingModalProps> = ({ isLoading, onClose, runSummary }) => {
  const [activeTab, setActiveTab] = useState<AnalysisTab>('map');

  useEffect(() => {
    let chartManager: TelemetryCharts | null = null;
    
    if (activeTab === 'gg-diagram' && runSummary?.fullData && runSummary.fullData.length > 0) {
      chartManager = new TelemetryCharts({ realTime: false });
      
      const ggData = runSummary.fullData.map(d => ({
        lateralG: d.acceleration_g.lateral,
        longitudinalG: d.acceleration_g.longitudinal,
        speed: d.speed_mps / MPS_PER_MPH,
      }));
      
      const chartContainerId = 'gg-diagram-container';
      
      const timeoutId = setTimeout(() => {
          try {
            if (document.getElementById(chartContainerId)) {
              chartManager?.createGGDiagram(chartContainerId, ggData);
            }
          } catch(e) {
            console.error("Failed to create G-G Diagram", e);
          }
      }, 50);

      return () => clearTimeout(timeoutId);
    }
    
    return () => {
      if (chartManager) {
        chartManager.dispose();
      }
    };
  }, [runSummary, activeTab]);

  if (!runSummary) return null;

  const coachingAdvice = runSummary.coachingAdvice || '';

  const TabButton: React.FC<{tab: AnalysisTab, label: string}> = ({ tab, label }) => (
      <button 
        onClick={() => setActiveTab(tab)}
        className={`pb-1 px-3 text-sm font-semibold transition-colors border-b-2 ${activeTab === tab ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-gray-400 hover:border-gray-500 hover:text-gray-200'}`}
      >
        {label}
      </button>
  );

  const getLapDataForMap = (): TelemetryStateObject[] => {
      if (!runSummary || !runSummary.laps || runSummary.laps.length === 0) {
          return runSummary.fullData;
      }
      
      let lapEndTimestamps = runSummary.laps.reduce((acc, lap) => {
          const lastTime = acc.length > 0 ? acc[acc.length - 1] : runSummary.fullData[0].timestamp;
          acc.push(lastTime + lap.time);
          return acc;
      }, [] as number[]);

      let currentLap = 1;
      let lapEndIndex = 0;
      
      return runSummary.fullData.map(d => {
          if (lapEndIndex < lapEndTimestamps.length && d.timestamp > lapEndTimestamps[lapEndIndex]) {
              currentLap++;
              lapEndIndex++;
          }
          return { ...d, lapNumber: currentLap };
      });
  }

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-2" onClick={onClose}>
      <div 
        className="glass-pane border-cyan-500/30 rounded-lg box-glow-cyan w-full max-w-4xl max-h-[95vh] flex flex-col relative transform transition-all animate-in fade-in zoom-in-95"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-400 hover:text-white z-10 p-1 bg-slate-800/50 rounded-full">
          <CloseIcon className="w-5 h-5" />
        </button>

        <div className="p-4 border-b border-white/10">
            <div className="flex items-center space-x-3">
                <CoachIcon className="w-6 h-6 text-cyan-400"/>
                <h2 className="text-xl font-bold font-orbitron text-cyan-400">Run Analysis</h2>
            </div>
        </div>
        
        <div className="flex-grow grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 overflow-y-auto">
            <div className="flex flex-col gap-2">
                <div className="border-b border-slate-700">
                    <TabButton tab="map" label="Race Map" />
                    <TabButton tab="gg-diagram" label="G-G Diagram" />
                </div>
                <div className="w-full aspect-square glass-pane rounded-lg">
                    {activeTab === 'map' && (
                        runSummary.fullData && runSummary.fullData.length > 1 ? (
                            <RaceMap data={getLapDataForMap()} showControls={true} />
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-500">No path data available.</div>
                        )
                    )}
                    {activeTab === 'gg-diagram' && (
                        <div id="gg-diagram-container" className="w-full h-full"></div>
                    )}
                </div>
                {runSummary.laps.length > 0 && (
                    <div className="glass-pane p-3 rounded-md">
                        <h4 className="text-sm font-semibold text-gray-300 mb-2">Lap Times</h4>
                        <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-sm">
                            {runSummary.laps.map(lap => (
                                <div key={lap.lapNumber} className="flex justify-between">
                                    <span className="text-gray-400">Lap {lap.lapNumber}:</span>
                                    <span className="font-mono font-bold text-white">{formatTime(lap.time)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            
            <div className="glass-pane p-3 rounded-lg flex flex-col">
                <h3 className="text-lg font-semibold text-cyan-300 mb-2">AI Driver Coaching</h3>
                 {isLoading ? (
                    <div className="flex-grow flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
                        <p className="ml-3 text-gray-300">Analyzing run data...</p>
                    </div>
                ) : (
                    <div className="text-gray-300 whitespace-pre-wrap leading-relaxed overflow-y-auto text-sm">
                        {coachingAdvice}
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};