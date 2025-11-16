
import React from 'react';
import { RunSummary } from '../types';
import { MPS_PER_MPH } from '../constants';
import { RaceMap } from './RaceMap';

interface RunHistoryProps {
  runHistory: RunSummary[];
  onViewRun: (run: RunSummary) => void;
}

const StatCard: React.FC<{ label: string; value: string | number; unit: string }> = ({ label, value, unit }) => (
    <div className="glass-pane p-2 rounded-lg text-center">
        <div className="text-gray-400 text-xs uppercase tracking-wider">{label}</div>
        <div className="text-cyan-300 text-2xl font-bold font-orbitron">{value}</div>
        <div className="text-gray-500 text-xs">{unit}</div>
    </div>
);


export const RunHistory: React.FC<RunHistoryProps> = ({ runHistory, onViewRun }) => {
  if (runHistory.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500">
          <h2 className="text-2xl font-orbitron">No Runs Recorded</h2>
          <p className="mt-2">Press "START RUN" to begin a telemetry session.</p>
        </div>
      </div>
    );
  }

  const sortedHistory = [...runHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-2">
        <h2 className="text-2xl font-bold font-orbitron text-cyan-400 border-b-2 border-cyan-500/20 pb-2">Run History</h2>
        <div className="max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            {sortedHistory.map((run, index) => (
                <div key={run.id} className="glass-pane p-3 mb-2 rounded-lg transition-colors duration-300">
                    <div className="flex flex-col md:flex-row justify-between md:items-center mb-3 gap-3">
                        <div className="flex-grow">
                            <h3 className="text-lg font-semibold font-orbitron text-white">Run #{sortedHistory.length - index}</h3>
                            <p className="text-sm text-gray-400">{new Date(run.date).toLocaleString()}</p>
                        </div>
                        {run.path && run.path.length > 1 && (
                            <div className="w-full md:w-32 h-20 rounded-md overflow-hidden glass-pane">
                                <RaceMap data={run.fullData} />
                            </div>
                        )}
                        <button 
                            onClick={() => onViewRun(run)}
                            className="bg-cyan-500/30 text-cyan-200 font-bold px-4 py-2 rounded-lg border border-cyan-400/50 hover:bg-cyan-500/50 hover:border-cyan-400 transition-colors h-fit"
                        >
                            View Details
                        </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <StatCard label="0-60 MPH" value={run.zeroToSixty ? run.zeroToSixty.toFixed(2) : '--'} unit="sec" />
                        <StatCard label="1/4 Mile" value={run.quarterMileTime ? run.quarterMileTime.toFixed(2) : '--'} unit="sec" />
                        <StatCard label="Trap Speed" value={run.quarterMileSpeed ? (run.quarterMileSpeed / MPS_PER_MPH).toFixed(1) : '--'} unit="mph" />
                        <StatCard label="Max Speed" value={(run.maxSpeed / MPS_PER_MPH).toFixed(1)} unit="mph" />
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
};