
import React from 'react';
import { PinIcon } from './icons';

interface TranscriptOverlayProps {
  userTranscript: string;
  modelTranscript: string;
  groundingChunks?: any[];
  isVisible: boolean;
}

export const TranscriptOverlay: React.FC<TranscriptOverlayProps> = ({ userTranscript, modelTranscript, isVisible, groundingChunks }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed top-20 left-0 right-0 p-2 z-50 pointer-events-none flex flex-col items-center">
      <div className="glass-pane p-3 rounded-lg text-center max-w-2xl w-full transition-opacity duration-300 animate-in fade-in slide-in-from-top-4 border-cyan-500/20 box-glow-cyan">
        {userTranscript && (
          <p className="text-lg text-cyan-300">
            <span className="font-bold text-gray-400">You:</span> {userTranscript}
          </p>
        )}
        {modelTranscript && (
          <div className="mt-1">
            <p className="text-lg text-yellow-300">
              <span className="font-bold text-gray-400">Genesis:</span> {modelTranscript}
            </p>
            {groundingChunks && groundingChunks.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-600/50 text-left text-sm flex flex-wrap gap-2 justify-center pointer-events-auto">
                {groundingChunks.map((chunk, index) => {
                  if (chunk.maps) {
                    return (
                      <a
                        key={index}
                        href={chunk.maps.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-cyan-500/20 text-cyan-300 px-3 py-1.5 rounded-lg hover:bg-cyan-500/40 transition-colors"
                      >
                        <PinIcon className="w-4 h-4" />
                        <span className="font-semibold">{chunk.maps.title}</span>
                      </a>
                    );
                  }
                  return null;
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
