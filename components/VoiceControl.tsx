
import React from 'react';
import { MicrophoneIcon } from './icons';

interface VoiceControlProps {
  isListening: boolean;
  isSpeaking: boolean;
  isDisabled: boolean;
  onClick: () => void;
}

export const VoiceControl: React.FC<VoiceControlProps> = ({ isListening, isSpeaking, isDisabled, onClick }) => {
  const getButtonStateClasses = () => {
    if (isDisabled) {
      return 'bg-slate-800/50 text-gray-500 cursor-not-allowed';
    }
    if (isSpeaking) {
      return 'bg-yellow-500/30 text-yellow-400';
    }
    if (isListening) {
      return 'bg-red-500/30 text-red-400 animate-pulse';
    }
    return 'bg-slate-700/50 text-gray-300 hover:bg-slate-600/50';
  };
  
  const SoundWave: React.FC = () => (
    <div className="flex items-center justify-center space-x-1 w-6 h-6">
      <span className="w-1 h-2 bg-yellow-400 animate-[wave_1s_infinite_ease-in-out_0.1s] rounded-full"></span>
      <span className="w-1 h-4 bg-yellow-400 animate-[wave_1s_infinite_ease-in-out_0.2s] rounded-full"></span>
      <span className="w-1 h-5 bg-yellow-400 animate-[wave_1s_infinite_ease-in-out_0.3s] rounded-full"></span>
      <span className="w-1 h-3 bg-yellow-400 animate-[wave_1s_infinite_ease-in-out_0.4s] rounded-full"></span>
       <style>{`
        @keyframes wave {
          0%, 100% { transform: scaleY(0.5); }
          50% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-300 focus:outline-none focus:ring-4 focus:ring-cyan-500/50 ${getButtonStateClasses()}`}
      aria-label={isDisabled ? "Microphone access denied" : isListening ? 'Stop listening' : 'Start voice command'}
      title={isDisabled ? "Microphone access is denied in your browser settings." : undefined}
    >
      {isSpeaking ? <SoundWave /> : <MicrophoneIcon className="w-5 h-5" />}
    </button>
  );
};
