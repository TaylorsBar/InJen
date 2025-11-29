
import React from 'react';
import { RunSummary } from '../types';
import { MPS_PER_MPH } from '../constants';
import { RaceMap } from './RaceMap';
import { useTheme } from '../hooks/useTheme';
import { CoachIcon } from './icons';

interface RunHistoryProps {
  runHistory: RunSummary[];
  onViewRun: (run: RunSummary) => void;
}

const StatItem: React.FC<{ label: string; value: string | number; unit?: string; highlight?: boolean }> = ({ label, value, unit, highlight }) => {
    const { theme } = useTheme();
    return (
        <div className="flex flex-col items-start p-2 rounded bg-black/20 border border-white/5 w-full">
            <span className="text-[9px] text-gray-500 uppercase tracking-wider font-bold mb-0.5">{label}</span>
            <div className="flex items-baseline gap-1">
                <span className={`text-lg font-bold font-orbitron ${highlight ? theme.colors.primary : 'text-gray-200'}`}>{value}</span>
                {unit && <span className="text-[10px] text-gray-500">{unit}</span>}
            </div>
        </div>
    );
}

export const RunHistory: React.FC<RunHistoryProps> = ({ runHistory, onViewRun }) => {
  const { theme } = useTheme();

  if (runHistory.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center opacity-60">
        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-600 animate-spin-slow"></div>
        </div>
        <h2 className="text-2xl font-orbitron font-bold text-gray-300">No Logs Found</h2>
        <p className="mt-2 text-gray-500 text-sm max-w-xs">Complete a telemetry session to populate your run history.</p>
      </div>
    );
  }

  const sortedHistory = [...runHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-4 h-full flex flex-col">
        <header className="flex items-center justify-between pb-2 border-b border-white/10 shrink-0">
            <h2 className={`text-xl font-bold font-orbitron ${theme.colors.primary}`}>Session Logs</h2>
            <span className="text-xs text-gray-500 font-mono">{runHistory.length} ENTRIES</span>
        </header>
        
        <div className="flex-grow overflow-y-auto pr-1 space-y-3 pb-20">
            {sortedHistory.map((run, index) => (
                <div 
                    key={run.id} 
                    onClick={() => onViewRun(run)}
                    className={`glass-pane p-1 rounded-xl border border-white/10 hover:border-white/20 transition-all duration-200 hover:bg-white/5 cursor-pointer group`}
                >
                    <div className="flex gap-2 h-32">
                        {/* Map Thumbnail */}
                        <div className="w-1/3 min-w-[120px] bg-black/40 rounded-lg overflow-hidden relative border border-white/5">
                            {run.path && run.path.length > 1 ? (
                                <div className="absolute inset-0 opacity-70 grayscale group-hover:grayscale-0 transition-all duration-500">
                                    <RaceMap data={run.fullData} showControls={false} className="pointer-events-none" />
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-full text-[10px] text-gray-600">NO GPS DATA</div>
                            )}
                            <div className="absolute top-1 left-1 bg-black/60 backdrop-blur px-1.5 py-0.5 rounded text-[9px] text-gray-300 font-mono">
                                #{sortedHistory.length - index}
                            </div>
                            {run.coachingAdvice && (
                                <div className="absolute bottom-1 right-1 bg-cyan-500/20 backdrop-blur px-1.5 py-0.5 rounded text-[8px] text-cyan-300 font-bold flex items-center gap-1">
                                    <CoachIcon className="w-2 h-2" /> AI DEBRIEF
                                </div>
                            )}
                        </div>

                        {/* Data Grid */}
                        <div className="flex-grow flex flex-col justify-between py-1 pr-1">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <div className="text-xs text-gray-400 font-bold">{new Date(run.date).toLocaleDateString()}</div>
                                    <div className="text-[10px] text-gray-600 font-mono">{new Date(run.date).toLocaleTimeString()}</div>
                                </div>
                                <div className={`text-[10px] px-2 py-0.5 rounded-full border bg-opacity-10 ${run.laps.length > 0 ? 'bg-cyan-500 border-cyan-500 text-cyan-400' : 'bg-orange-500 border-orange-500 text-orange-400'}`}>
                                    {run.laps.length > 0 ? `${run.laps.length} LAPS` : 'DRAG'}
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-1">
                                <StatItem label="0-60" value={run.zeroToSixty ? run.zeroToSixty.toFixed(2) : '--'} unit="s" highlight />
                                <StatItem label="1/4 Mile" value={run.quarterMileTime ? run.quarterMileTime.toFixed(2) : '--'} unit="s" />
                                <StatItem label="Top Speed" value={(run.maxSpeed / MPS_PER_MPH).toFixed(0)} unit="mph" />
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
};
