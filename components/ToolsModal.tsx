
import React, { useState, useEffect } from 'react';
import { CloseIcon, SettingsIcon, ShareIcon } from './icons';
import { platformService } from '../services/platformService';
import { RunSummary } from '../types';
import { useTelemetry } from '../hooks/useTelemetry';
import { CanSniffer } from './CanSniffer';
import { MPS_PER_MPH } from '../constants';

interface ToolsModalProps {
  onClose: () => void;
  runHistory: RunSummary[];
}

type Tab = 'system' | 'canbus';

const convertToCSV = (run: RunSummary): string => {
    // Detailed headers for professional analysis
    const headers = [
        'Timestamp', 
        'Time_Offset_Sec', 
        'Speed_MPH', 
        'RPM', 
        'Gear', 
        'Latitude', 
        'Longitude', 
        'G_Long', 
        'G_Lat', 
        'G_Vert', 
        'Heading',
        'Tire_FL_Load',
        'Tire_FR_Load',
        'Tire_RL_Load',
        'Tire_RR_Load',
        'Fusion_Tier',
        'Inferred_Pitch',
        'EKF_Bias_X', // IP Extraction: Accel Bias X
        'EKF_Bias_Y', // IP Extraction: Accel Bias Y
        'EKF_Bias_Z', // IP Extraction: Accel Bias Z
        'Uncertainty_M'
    ];
    const startTime = run.fullData.length > 0 ? run.fullData[0].timestamp : 0;
    
    const rows = run.fullData.map((pt) => {
        const timeOffset = (pt.timestamp - startTime) / 1000;
        return [
            new Date(pt.timestamp).toISOString(),
            timeOffset.toFixed(3),
            (pt.speed_mps / MPS_PER_MPH).toFixed(2),
            Math.round(pt.rpm),
            pt.inferred_gear,
            pt.position.lat.toFixed(6),
            pt.position.long.toFixed(6),
            pt.acceleration_g.longitudinal.toFixed(3),
            pt.acceleration_g.lateral.toFixed(3),
            pt.acceleration_g.vertical.toFixed(3),
            pt.heading.toFixed(1),
            pt.tire_loads.fl.toFixed(2),
            pt.tire_loads.fr.toFixed(2),
            pt.tire_loads.rl.toFixed(2),
            pt.tire_loads.rr.toFixed(2),
            pt.fusionTier,
            pt.pitch_angle.toFixed(2),
            pt.ekf_biases?.x.toFixed(5) || '0',
            pt.ekf_biases?.y.toFixed(5) || '0',
            pt.ekf_biases?.z.toFixed(5) || '0',
            pt.uncertainty_m.toFixed(2)
        ].join(',');
    });
    return [headers.join(','), ...rows].join('\n');
};

export const ToolsModal: React.FC<ToolsModalProps> = ({ onClose, runHistory }) => {
  const [activeTab, setActiveTab] = useState<Tab>('system');
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [sensorStatus, setSensorStatus] = useState<string | null>(null);
  const [obdStatus, setObdStatus] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  
  // Grab connection logic from hook
  const { connectOBD, disconnectOBD, isOBDConnected } = useTelemetry();

  useEffect(() => {
      if (runHistory.length > 0 && !selectedRunId) {
          setSelectedRunId(runHistory[runHistory.length - 1].id);
      }
  }, [runHistory, selectedRunId]);

  const handleExportAll = () => {
    if (runHistory.length === 0) {
      setExportStatus('No runs to export.');
      setTimeout(() => setExportStatus(null), 2000);
      return;
    }
    const filename = `genesis-history-${new Date().toISOString().split('T')[0]}.json`;
    platformService.exportData(runHistory, filename);
    setExportStatus('Full History Exported');
    setTimeout(() => setExportStatus(null), 2000);
  };

  const handleExportSelected = (format: 'json' | 'csv') => {
      const run = runHistory.find(r => r.id === selectedRunId);
      if (!run) {
          setExportStatus('Select a run first');
          setTimeout(() => setExportStatus(null), 2000);
          return;
      }

      const dateStr = new Date(run.date).toISOString().split('T')[0];
      const filename = `genesis-run-${dateStr}-${run.id.slice(-4)}.${format}`;

      if (format === 'json') {
          platformService.exportData(run, filename, 'application/json');
      } else {
          const csvContent = convertToCSV(run);
          platformService.exportData(csvContent, filename, 'text/csv');
      }
      setExportStatus(`Exported ${format.toUpperCase()}`);
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
  }

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="glass-pane border-cyan-500/30 rounded-lg box-glow-cyan w-full max-w-2xl flex flex-col relative transform transition-all animate-in fade-in zoom-in-95 h-[650px]"
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
                        
                        {/* Bulk Export */}
                        <button 
                            onClick={handleExportAll}
                            className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors border border-white/5"
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-gray-200">Export All History (JSON)</span>
                            </div>
                            <ShareIcon className="w-4 h-4 text-cyan-400" />
                        </button>
                        <div className="text-[10px] text-gray-500 px-1 flex justify-between">
                            <span>Runs stored: {runHistory.length}</span>
                            <span>Total size: ~{(JSON.stringify(runHistory).length / 1024).toFixed(1)} KB</span>
                        </div>

                        {/* Single Export */}
                        <div className="pt-2 border-t border-white/5 space-y-2">
                             <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Single Run Export</h4>
                             {runHistory.length > 0 ? (
                                 <div className="space-y-2">
                                     <select 
                                        value={selectedRunId} 
                                        onChange={(e) => setSelectedRunId(e.target.value)}
                                        className="w-full bg-slate-800 text-gray-200 text-xs rounded p-2 border border-slate-600 outline-none focus:border-cyan-500"
                                     >
                                         {runHistory.slice().reverse().map((run, idx) => (
                                             <option key={run.id} value={run.id}>
                                                 Run #{runHistory.length - idx} - {new Date(run.date).toLocaleString()}
                                             </option>
                                         ))}
                                     </select>
                                     <div className="flex gap-2">
                                         <button
                                            onClick={() => handleExportSelected('csv')}
                                            className="flex-1 bg-slate-800/80 hover:bg-slate-700/80 text-cyan-400 text-xs font-bold py-2 rounded border border-cyan-900/50 transition-colors"
                                         >
                                            Export CSV
                                         </button>
                                         <button
                                            onClick={() => handleExportSelected('json')}
                                            className="flex-1 bg-slate-800/80 hover:bg-slate-700/80 text-yellow-400 text-xs font-bold py-2 rounded border border-yellow-900/50 transition-colors"
                                         >
                                            Export JSON
                                         </button>
                                     </div>
                                 </div>
                             ) : (
                                 <p className="text-xs text-gray-500 italic">No runs recorded yet.</p>
                             )}
                        </div>
                        
                        {exportStatus && (
                            <div className="text-center text-xs text-cyan-400 animate-pulse pt-2">{exportStatus}</div>
                        )}
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
