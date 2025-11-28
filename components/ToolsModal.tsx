
import React, { useState } from 'react';
import { RunSummary, TelemetryStateObject } from '../types';
import { CloseIcon, SettingsIcon, ChatIcon } from './icons';
import { platformService } from '../services/platformService';
import { CanSniffer } from './CanSniffer';
import { useTheme } from '../hooks/useTheme';
import { diagnoseFaultCodes } from '../services/geminiService';

interface ToolsModalProps {
  onClose: () => void;
  runHistory: RunSummary[];
  connectOBD: () => Promise<{ success: boolean; error?: string }>;
  disconnectOBD: () => void;
  isOBDConnected: boolean;
}

export const ToolsModal: React.FC<ToolsModalProps> = ({ onClose, runHistory, connectOBD, disconnectOBD, isOBDConnected }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'obd' | 'can' | 'diagnostics' | 'appearance'>('general');
  const [obdStatus, setObdStatus] = useState<string | null>(null);
  
  // Theme Hook
  const { theme, setThemeId, availableThemes } = useTheme();

  // Export State
  const [selectedRunId, setSelectedRunId] = useState<string>('');

  const handleExport = () => {
      const data = JSON.stringify(runHistory, null, 2);
      platformService.exportData(data, `genesis_history_${new Date().toISOString()}.json`);
  };

  const handleExportSelected = (type: 'csv' | 'json') => {
      const run = runHistory.find(r => r.id === selectedRunId);
      if (!run) return;

      const filename = `genesis_run_${run.date.split('T')[0]}_${run.id.slice(-4)}`;

      if (type === 'json') {
          platformService.exportData(JSON.stringify(run, null, 2), `${filename}.json`, 'application/json');
      } else {
          const csv = convertToCSV(run);
          platformService.exportData(csv, `${filename}.csv`, 'text/csv');
      }
  };

  const convertToCSV = (run: RunSummary): string => {
      if (!run.fullData || run.fullData.length === 0) return '';
      
      const headers = [
          'timestamp', 'speed_mph', 'rpm', 'gear', 
          'long_g', 'lat_g', 'vert_g',
          'lat', 'long', 'elevation', 'slope', 'pitch', 'heading',
          'tire_fl', 'tire_fr', 'tire_rl', 'tire_rr',
          'ekf_bias_x', 'ekf_bias_y', 'ekf_bias_z', 'uncertainty_m',
          'coolant_c', 'voltage_v', 'throttle_pct'
      ].join(',');

      const rows = run.fullData.map((d: TelemetryStateObject) => {
          return [
              d.timestamp,
              (d.speed_mps * 2.23694).toFixed(2),
              d.rpm.toFixed(0),
              d.inferred_gear,
              d.acceleration_g.longitudinal.toFixed(3),
              d.acceleration_g.lateral.toFixed(3),
              d.acceleration_g.vertical.toFixed(3),
              d.position.lat.toFixed(6),
              d.position.long.toFixed(6),
              0, // Alt placeholder
              d.slope_percent.toFixed(1),
              d.pitch_angle.toFixed(1),
              d.heading.toFixed(1),
              d.tire_loads.fl.toFixed(2),
              d.tire_loads.fr.toFixed(2),
              d.tire_loads.rl.toFixed(2),
              d.tire_loads.rr.toFixed(2),
              d.ekf_biases.x.toFixed(4),
              d.ekf_biases.y.toFixed(4),
              d.ekf_biases.z.toFixed(4),
              d.uncertainty_m.toFixed(2),
              d.obd_info?.coolant_temp ?? '',
              d.obd_info?.battery_voltage ?? '',
              d.obd_info?.throttle_pos ?? ''
          ].join(',');
      }).join('\n');

      return `${headers}\n${rows}`;
  };

  const handleOBDConnection = async () => {
      if (isOBDConnected) {
          disconnectOBD();
          setObdStatus('Disconnected');
      } else {
          setObdStatus('Connecting...');
          const result = await connectOBD();
          if (result.success) {
              setObdStatus('Connected!');
          } else {
              setObdStatus(result.error || 'Failed');
          }
      }
      setTimeout(() => setObdStatus(null), 4000);
  };

  const [dtcCodes, setDtcCodes] = useState<string[]>([]);
  const [isScanningDTC, setIsScanningDTC] = useState(false);
  const [aiDiagnosis, setAiDiagnosis] = useState<string | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  const handleReadDTCs = async () => {
      setIsScanningDTC(true);
      setAiDiagnosis(null);
      // Simulate scan or use real OBD service if integrated
      setTimeout(() => {
          setDtcCodes(['P0300 - Random Misfire', 'P0171 - System Too Lean']);
          setIsScanningDTC(false);
      }, 1500);
  };

  const handleClearDTCs = async () => {
      if(confirm("Are you sure? This will reset the ECU check engine light.")) {
          setDtcCodes([]);
          setAiDiagnosis(null);
      }
  };

  const handleAnalyzeDTCs = async () => {
      if (dtcCodes.length === 0) return;
      setIsDiagnosing(true);
      const report = await diagnoseFaultCodes(dtcCodes);
      setAiDiagnosis(report);
      setIsDiagnosing(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-2" onClick={onClose}>
      <div 
        className={`glass-pane border rounded-lg ${theme.colors.glow} w-full max-w-4xl h-[80vh] flex flex-col relative transform transition-all animate-in fade-in zoom-in-95 ${theme.colors.border}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/10 flex justify-between items-center">
            <div className="flex items-center gap-2">
                <SettingsIcon className={`w-5 h-5 ${theme.colors.icon}`} />
                <h2 className={`text-xl font-bold font-orbitron ${theme.colors.primary}`}>System Utilities</h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white p-1 bg-white/5 rounded-full">
               <CloseIcon className="w-5 h-5" />
            </button>
        </div>

        <div className="flex border-b border-white/10 bg-black/20 overflow-x-auto">
            {['general', 'appearance', 'obd', 'diagnostics', 'can'].map((tab) => (
                <button 
                    key={tab}
                    onClick={() => setActiveTab(tab as any)} 
                    className={`px-4 py-3 text-sm font-semibold transition-colors capitalize whitespace-nowrap ${activeTab === tab ? `${theme.colors.accent} border-b-2 ${theme.colors.border}` : 'text-gray-400 hover:text-gray-200'}`}
                >
                    {tab}
                </button>
            ))}
        </div>

        <div className="flex-grow p-4 overflow-y-auto">
            {activeTab === 'general' && (
                <div className="space-y-4">
                    <div className={`glass-pane p-4 rounded-lg border ${theme.colors.border}`}>
                        <h3 className="text-lg font-bold text-white mb-2">Data Management</h3>
                        
                        <div className="mb-6">
                            <h4 className="text-sm font-semibold text-gray-300 mb-2">Full History Backup</h4>
                            <p className="text-gray-400 text-xs mb-3">Export all runs and telemetry logs.</p>
                            <button 
                                onClick={handleExport}
                                className={`text-white font-bold py-2 px-4 rounded transition-colors text-sm ${theme.colors.button} ${theme.colors.buttonHover}`}
                            >
                                Export JSON
                            </button>
                        </div>

                        <div className="border-t border-white/10 pt-4">
                            <h4 className="text-sm font-semibold text-gray-300 mb-2">Single Run Export</h4>
                            <p className="text-gray-400 text-xs mb-3">Select a specific run to export as CSV (Excel compatible) or raw JSON.</p>
                            
                            <div className="flex flex-col sm:flex-row gap-3">
                                <select 
                                    value={selectedRunId}
                                    onChange={(e) => setSelectedRunId(e.target.value)}
                                    className="bg-black/40 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                                >
                                    <option value="">-- Select a Run --</option>
                                    {runHistory.map((run, i) => (
                                        <option key={run.id} value={run.id}>
                                            Run #{runHistory.length - i} - {new Date(run.date).toLocaleString()}
                                        </option>
                                    ))}
                                </select>
                                <button 
                                    onClick={() => handleExportSelected('csv')}
                                    disabled={!selectedRunId}
                                    className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold py-2 px-4 rounded transition-colors text-sm"
                                >
                                    Export CSV
                                </button>
                                <button 
                                    onClick={() => handleExportSelected('json')}
                                    disabled={!selectedRunId}
                                    className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-bold py-2 px-4 rounded transition-colors text-sm"
                                >
                                    Export JSON
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'appearance' && (
                <div className="space-y-4">
                    <div className={`glass-pane p-4 rounded-lg border ${theme.colors.border}`}>
                        <h3 className="text-lg font-bold text-white mb-4">Interface Theme</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {availableThemes.map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => setThemeId(t.id)}
                                    className={`p-3 rounded-lg border flex items-center justify-between transition-all ${
                                        theme.id === t.id 
                                            ? `${theme.colors.border} bg-white/10 ${theme.colors.glow}` 
                                            : 'border-white/5 bg-black/20 hover:bg-white/5'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${t.colors.bg.replace('bg-', 'from-').split('/')[0]} to-black border ${t.colors.border}`}></div>
                                        <span className={`font-orbitron font-bold ${t.colors.primary}`}>{t.name}</span>
                                    </div>
                                    {theme.id === t.id && <div className={`w-2 h-2 rounded-full ${t.colors.button}`}></div>}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            
            {activeTab === 'obd' && (
                 <div className="space-y-4">
                    <div className={`glass-pane p-4 rounded-lg flex flex-col items-start gap-3 border ${theme.colors.border}`}>
                        <h3 className="text-lg font-bold text-white">OBD-II Bluetooth Adapter</h3>
                        <p className="text-gray-400 text-sm">Connect to a generic ELM327 Bluetooth LE adapter to read RPM, speed, throttle, and more.</p>
                        
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={handleOBDConnection}
                                className={`font-bold py-2 px-6 rounded transition-colors ${isOBDConnected ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                            >
                                {isOBDConnected ? 'Disconnect' : 'Connect Device'}
                            </button>
                            {obdStatus && <span className={`${theme.colors.accent} animate-pulse`}>{obdStatus}</span>}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'diagnostics' && (
                <div className="space-y-4">
                    <div className={`glass-pane p-4 rounded-lg border ${theme.colors.border}`}>
                        <h3 className="text-lg font-bold text-white mb-2">DTC Scanner</h3>
                        <p className="text-gray-400 text-sm mb-4">Read and clear diagnostic trouble codes from the ECU.</p>
                        
                        <div className="flex flex-wrap gap-2 mb-4">
                            <button 
                                onClick={handleReadDTCs}
                                disabled={isScanningDTC}
                                className={`px-4 py-2 rounded text-sm font-bold text-white ${theme.colors.button} ${theme.colors.buttonHover}`}
                            >
                                {isScanningDTC ? 'Scanning...' : 'Read Codes'}
                            </button>
                            {dtcCodes.length > 0 && (
                                <button 
                                    onClick={handleAnalyzeDTCs}
                                    disabled={isDiagnosing}
                                    className={`px-4 py-2 rounded text-sm font-bold text-slate-900 bg-cyan-400 hover:bg-cyan-300 flex items-center gap-2`}
                                >
                                    <ChatIcon className="w-4 h-4" />
                                    {isDiagnosing ? 'Analyzing...' : 'Analyze with Genesis AI'}
                                </button>
                            )}
                            <button 
                                onClick={handleClearDTCs}
                                className="px-4 py-2 rounded text-sm font-bold text-white bg-red-800 hover:bg-red-700 ml-auto"
                            >
                                Clear Codes
                            </button>
                        </div>

                        <div className="bg-black/40 rounded p-2 min-h-[100px] border border-white/5 mb-2">
                            {dtcCodes.length === 0 ? (
                                <div className="text-gray-500 text-sm italic p-2">No codes found or scan not run.</div>
                            ) : (
                                <ul className="space-y-1">
                                    {dtcCodes.map((code, i) => (
                                        <li key={i} className="text-red-400 font-mono text-sm border-b border-white/5 last:border-0 pb-1">{code}</li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {aiDiagnosis && (
                            <div className="mt-4 p-3 rounded-lg glass-pane border border-cyan-500/30 animate-in fade-in slide-in-from-top-2">
                                <h4 className="text-cyan-400 font-bold font-orbitron mb-2 flex items-center gap-2">
                                    <ChatIcon className="w-4 h-4" /> AI Diagnosis
                                </h4>
                                <div className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
                                    {aiDiagnosis}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {activeTab === 'can' && (
                <div className="h-full flex flex-col">
                    <CanSniffer />
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
