
import React, { useState } from 'react';
import { CloseIcon, SettingsIcon, ShareIcon } from './icons';
import { platformService } from '../services/platformService';
import { RunSummary } from '../types';
import { useTelemetry } from '../hooks/useTelemetry';
import { CanSniffer } from './CanSniffer';

interface ToolsModalProps {
  onClose: () => void;
  runHistory: RunSummary[];
}

type Tab = 'system' | 'canbus';

export const ToolsModal: React.FC<ToolsModalProps> = ({ onClose, runHistory }) => {
  const [activeTab, setActiveTab] = useState<Tab>('system');
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [sensorStatus, setSensorStatus] = useState<string | null>(null);
  const [obdStatus, setObdStatus] = useState<string | null>(null);
  
  // Grab connection logic from hook
  const { connectOBD, disconnectOBD, isOBDConnected } = useTelemetry();

  const handleExport = () => {
    if (runHistory.length === 0) {
      setExportStatus('No runs to export.');
      setTimeout(() => setExportStatus(null), 2000);
      return;
    }
    const filename = `genesis-export-${new Date().toISOString().split('T')[0]}.json`;
    platformService.exportData(runHistory, filename);
    setExportStatus('Export started...');
    setTimeout(() => setExportStatus(null), 2000);
  };

  const handleSensorPermission = async () => {
    const granted = await platformService.requestMotionPermission();
    if (granted) {
      setSensorStatus('Sensors Active');
    } else {
      setSensorStatus('Permission Denied');
    }
    setTimeout(() => setSensorStatus(null), 3000);
  };
  
  const handleOBDConnection = async () => {
      if (isOBDConnected) {
          disconnectOBD();
          setObdStatus('Disconnected');
      } else {
          setObdStatus('Connecting...');
          const success = await connectOBD();
          setObdStatus(success ? 'Connected!' : 'Failed');
      }
      setTimeout(() => setObdStatus(null), 3000);
  }

  const handleFullscreen = () => {
      platformService.toggleFullscreen();
      // Don't close for fullscreen toggle, UX preference
  }

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="glass-pane border-cyan-500/30 rounded-lg box-glow-cyan w-full max-w-2xl flex flex-col relative transform transition-all animate-in fade-in zoom-in-95 h-[600px]"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/10 flex justify-between items-center">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-cyan-400">
                    <SettingsIcon className="w-5 h-5" />
                    <h2 className="text-lg font-bold font-orbitron text-white">Engineering Tools</h2>
                </div>
                <div className="flex gap-2 ml-4">
                    <button 
                        onClick={() => setActiveTab('system')}
                        className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${activeTab === 'system' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        SYSTEM
                    </button>
                    <button 
                         onClick={() => setActiveTab('canbus')}
                         className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${activeTab === 'canbus' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        CAN BUS SNIFFER
                    </button>
                </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                <CloseIcon className="w-5 h-5" />
            </button>
        </div>

        <div className="flex-grow overflow-hidden">
            {activeTab === 'system' && (
                <div className="p-4 space-y-4 overflow-y-auto h-full">
                    
                    {/* View Controls */}
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">View & Power</h3>
                        <button 
                            onClick={handleFullscreen}
                            className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors border border-white/5"
                        >
                            <span className="text-gray-200">Toggle Fullscreen</span>
                            <span className="text-xs bg-slate-900 px-2 py-1 rounded text-cyan-400 font-mono">F11</span>
                        </button>
                    </div>

                    {/* Hardware Controls */}
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Hardware & Sensors</h3>
                        <button 
                            onClick={handleSensorPermission}
                            className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors border border-white/5"
                        >
                            <span className="text-gray-200">Initialize Motion Sensors</span>
                            {sensorStatus ? (
                                <span className={`text-xs px-2 py-1 rounded font-bold ${sensorStatus === 'Sensors Active' ? 'text-green-400 bg-green-900/30' : 'text-red-400 bg-red-900/30'}`}>{sensorStatus}</span>
                            ) : (
                                platformService.isIOS() && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">iOS Required</span>
                            )}
                        </button>
                        
                        <button 
                            onClick={handleOBDConnection}
                            className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors border border-white/5 ${isOBDConnected ? 'bg-cyan-900/30 hover:bg-cyan-900/50' : 'bg-slate-800/50 hover:bg-slate-700/50'}`}
                        >
                            <span className="text-gray-200">{isOBDConnected ? 'Disconnect ELM327 / OBDII' : 'Connect ELM327 / OBDII (BLE)'}</span>
                            {obdStatus ? (
                                <span className="text-xs text-cyan-300 animate-pulse">{obdStatus}</span>
                            ) : (
                                isOBDConnected && <span className="text-xs bg-cyan-500/20 text-cyan-300 px-2 py-1 rounded">Active</span>
                            )}
                        </button>
                        <p className="text-[10px] text-gray-500 px-1">
                            Standard OBD-II Mode (ELM327 Compatible)
                        </p>
                    </div>

                    {/* Data Controls */}
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Data Management</h3>
                        <button 
                            onClick={handleExport}
                            className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors border border-white/5"
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-gray-200">Export Run History (JSON)</span>
                            </div>
                            <ShareIcon className="w-4 h-4 text-cyan-400" />
                        </button>
                        {exportStatus && (
                            <div className="text-center text-xs text-cyan-400 animate-pulse">{exportStatus}</div>
                        )}
                        <div className="text-[10px] text-gray-500 px-1 flex justify-between">
                            <span>Runs stored: {runHistory.length}</span>
                            <span>Total size: ~{(JSON.stringify(runHistory).length / 1024).toFixed(1)} KB</span>
                        </div>
                    </div>
                </div>
            )}
            
            {activeTab === 'canbus' && (
                <div className="h-full p-2">
                    <CanSniffer />
                </div>
            )}

        </div>
      </div>
    </div>
  );
};
