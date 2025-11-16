
import React from 'react';
import { RecordIcon } from './icons';

interface RecordingControlProps {
  status: 'idle' | 'recording' | 'stopped';
  timer: number;
  onStart: () => void;
  onStop: () => void;
}

const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}

export const RecordingControl: React.FC<RecordingControlProps> = ({ status, timer, onStart, onStop }) => {
    const isRecording = status === 'recording';

    const handleClick = () => {
        if (isRecording) {
            onStop();
        } else {
            onStart();
        }
    };
    
    return (
        <div className={`flex items-center rounded-full transition-colors duration-300 ${isRecording ? 'bg-red-500/20' : ''}`}>
            <button
                onClick={handleClick}
                className={`p-2 rounded-full transition-colors duration-300 ${isRecording ? 'text-red-400' : 'text-gray-400 hover:bg-slate-700/50'}`}
                aria-label={isRecording ? "Stop Recording" : "Start Recording"}
            >
               <RecordIcon className="w-5 h-5" />
            </button>
            {isRecording && <span className="font-mono text-sm font-semibold text-red-400 pr-3 animate-pulse">{formatTimer(timer)}</span>}
        </div>
    );
};
