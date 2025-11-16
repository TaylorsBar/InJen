
import React from 'react';
import { CloseIcon, ShareIcon } from './icons';

interface RecordingModalProps {
    videoUrl: string | null;
    onClose: () => void;
}

export const RecordingModal: React.FC<RecordingModalProps> = ({ videoUrl, onClose }) => {
    if (!videoUrl) return null;

    const handleShare = async () => {
        try {
            const response = await fetch(videoUrl);
            const blob = await response.blob();
            const file = new File([blob], `genesis-run-${new Date().toISOString()}.webm`, { type: 'video/webm' });
            
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: 'Genesis Telemetry Run',
                    text: 'Check out my latest telemetry run recorded with Genesis!',
                    files: [file],
                });
            } else {
                alert("Sharing is not supported on your browser/device. You can download the video instead.");
            }
        } catch (error) {
            console.error("Error sharing video:", error);
            alert("An error occurred while trying to share the video.");
        }
    }

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-2" onClick={onClose}>
            <div
                className="glass-pane border-cyan-500/30 rounded-lg box-glow-cyan w-full max-w-4xl max-h-[95vh] flex flex-col relative transform transition-all animate-in fade-in zoom-in-95"
                onClick={e => e.stopPropagation()}
            >
                <header className="p-4 border-b border-white/10 flex justify-between items-center">
                    <h2 className="text-xl font-bold font-orbitron text-cyan-400">Recording Complete</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white p-1 bg-slate-800/50 rounded-full">
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </header>

                <main className="flex-grow p-4 overflow-y-auto">
                    <video src={videoUrl} controls autoPlay loop className="w-full rounded-lg bg-black aspect-video"></video>
                </main>
                
                <footer className="p-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-end gap-3">
                    <button onClick={onClose} className="w-full sm:w-auto px-4 py-2 rounded-lg text-gray-300 bg-slate-700/50 hover:bg-slate-600/50 transition-colors">Discard</button>
                    {navigator.share && (
                         <button onClick={handleShare} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white bg-cyan-600 hover:bg-cyan-500 transition-colors font-semibold">
                            <ShareIcon className="w-4 h-4" />
                            Share
                        </button>
                    )}
                    <a 
                        href={videoUrl} 
                        download={`genesis-run-${new Date().toISOString()}.webm`}
                        className="w-full sm:w-auto text-center px-6 py-2 rounded-lg text-slate-900 bg-cyan-400 hover:bg-cyan-300 transition-colors font-bold"
                    >
                        Download
                    </a>
                </footer>
            </div>
        </div>
    );
};
