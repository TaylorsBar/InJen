
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
  
  // Mapbox Token State
  const [mapboxToken, setMapboxToken] = useState(localStorage.getItem('mapbox_token') || '');

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
  
  const saveMapboxToken = () => {
      localStorage.setItem('mapbox_token', mapboxToken);
      alert("Mapbox token saved. Please refresh the page or switch views to apply.");
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

  const TabButton = ({ id, label }: { id: typeof activeTab, label: string }) => (
      <button 
        onClick={() => setActiveTab(id)}
        className={`px-6 py-4 text-sm font-bold transition-all relative ${
            activeTab === id 
            ? `${theme.colors.accent} bg-white/5` 
            : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
        }`}
      >
        {label}
        {activeTab === id && (
            <span className={`absolute bottom-0 left-0 right-0 h-0.5 ${theme.colors.button}`}></span>
        )}
      </button>
  );

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className={`bg-slate-900 border ${theme.colors.border} rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col relative transform transition-all animate-in fade-in zoom-in-95 shadow-2xl overflow-hidden`}
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/20">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-white/5 border border-white/10 ${theme.colors.primary}`}>
                    <SettingsIcon className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-xl font-bold font-orbitron text-white">System Configuration</h2>
                    <p className="text-xs text-gray-500 font-mono tracking-widest uppercase">CartelWorx Diagnostics v2.4</p>
                </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors">
               <CloseIcon className="w-6 h-6" />
            </button>
        </header>

        <div className="flex border-b border-white/10 bg-black/40 overflow-x-auto">
            <TabButton id="general" label="GENERAL" />
            <TabButton id="obd" label="CONNNECTIVITY" />
            <TabButton id="diagnostics" label="DIAGNOSTICS" />
            <TabButton id="can" label="CAN SNIFFER" />
            <TabButton id="appearance" label="INTERFACE" />
        </div>

        <div className="flex-grow p-6 overflow-y-auto bg-gradient-to-br from-slate-900 to-black">
            {activeTab === 'general' && (
                <div className="max-w-2xl mx-auto space-y-6">
                    <div className="glass-pane p-6 rounded-xl border border-white/10">
                        <h3 className="text-lg font-bold text-white mb-1">Data Export</h3>
                        <p className="text-sm text-gray-400 mb-6">Manage local telemetry logs and export for external analysis.</p>
                        
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Full Backup</label>
                                <button 
                                    onClick={handleExport}
                                    className={`w-full sm:w-auto text-white font-bold py-2.5 px-6 rounded-lg transition-colors text-sm border border-white/10 ${theme.colors.button} ${theme.colors.buttonHover}`}
                                >
                                    Download Complete JSON History
                                </button>
                            </div>

                            <div className="pt-6 border-t border-white/10">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Single Session Export</label>
                                <div className="flex flex-col gap-3">
                                    <select 
                                        value={selectedRunId}
                                        onChange={(e) => setSelectedRunId(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                    >
                                        <option value="">Select a specific run...</option>
                                        {runHistory.map((run, i) => (
                                            <option key={run.id} value={run.id}>
                                                Run #{runHistory.length - i} • {new Date(run.date).toLocaleString()} • {(run.maxSpeed/0.447).toFixed(0)}mph Max
                                            </option>
                                        ))}
                                    </select>
                                    <div className="flex gap-3">
                                        <button 
                                            onClick={() => handleExportSelected('csv')}
                                            disabled={!selectedRunId}
                                            className="flex-1 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/40 disabled:opacity-50 text-sm font-bold py-2.5 px-4 rounded-lg transition-colors"
                                        >
                                            Export CSV (Excel)
                                        </button>
                                        <button 
                                            onClick={() => handleExportSelected('json')}
                                            disabled={!selectedRunId}
                                            className="flex-1 bg-slate-700/50 text-gray-300 border border-white/10 hover:bg-slate-700 disabled:opacity-50 text-sm font-bold py-2.5 px-4 rounded-lg transition-colors"
                                        >
                                            Export Raw JSON
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="pt-6 border-t border-white/10">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Map Configuration</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={mapboxToken}
                                        onChange={(e) => setMapboxToken(e.target.value)}
                                        placeholder="pk.eyJ1..."
                                        className="flex-grow bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                                    />
                                    <button 
                                        onClick={saveMapboxToken}
                                        className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors"
                                    >
                                        Save
                                    </button>
                                </div>
                                <p className="text-[10px] text-gray-500 mt-1">
                                    Required for Satellite and Street maps. Get a public token from <a href="https://mapbox.com" target="_blank" className="text-cyan-400 hover:underline">mapbox.com</a>.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'appearance' && (
                <div className="max-w-4xl mx-auto">
                    <h3 className="text-lg font-bold text-white mb-4">Visual Theme</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {availableThemes.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setThemeId(t.id)}
                                className={`group relative p-4 rounded-xl border flex flex-col gap-3 transition-all text-left overflow-hidden ${
                                    theme.id === t.id 
                                        ? `${theme.colors.border} bg-white/5 ring-1 ring-white/20` 
                                        : 'border-white/5 bg-black/20 hover:bg-white/5 hover:border-white/10'
                                }`}
                            >
                                <div className="flex items-center justify-between w-full relative z-10">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-lg shadow-inner bg-gradient-to-br ${t.colors.bg.replace('bg-', 'from-').split('/')[0]} to-black border ${t.colors.border}`}></div>
                                        <div>
                                            <span className={`block font-orbitron font-bold text-sm ${t.colors.primary}`}>{t.name}</span>
                                            <span className="text-xs text-gray-500 capitalize">{t.backgroundStyle.type}</span>
                                        </div>
                                    </div>
                                    <div className={`w-4 h-4 rounded-full border border-white/20 flex items-center justify-center ${theme.id === t.id ? t.colors.button : 'bg-transparent'}`}>
                                        {theme.id === t.id && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                    </div>
                                </div>
                                {/* Preview Elements */}
                                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden relative z-10">
                                    <div className={`h-full w-2/3 ${t.colors.button}`}></div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
            
            {activeTab === 'obd' && (
                 <div className="max-w-2xl mx-auto space-y-6">
                    <div className="glass-pane p-6 rounded-xl border border-white/10 flex flex-col items-center text-center">
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${isOBDConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-gray-500'}`}>
                            <SettingsIcon className="w-10 h-10" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Bluetooth OBD-II Adapter</h3>
                        <p className="text-gray-400 text-sm mb-6 max-w-md">Connect to a compatible ELM327 BLE adapter to unlock real-time engine telemetry (RPM, TPS, Coolant) and override simulated physics.</p>
                        
                        <div className="flex flex-col items-center gap-2 w-full max-w-xs">
                            <button 
                                onClick={handleOBDConnection}
                                className={`w-full font-bold py-3 px-6 rounded-xl transition-all shadow-lg ${
                                    isOBDConnected 
                                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/20' 
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'
                                }`}
                            >
                                {isOBDConnected ? 'Disconnect Device' : 'Scan & Connect'}
                            </button>
                            {obdStatus && <span className={`text-sm font-mono mt-2 ${theme.colors.accent} animate-pulse`}>{obdStatus}</span>}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'diagnostics' && (
                <div className="max-w-3xl mx-auto space-y-4">
                    <div className="glass-pane p-6 rounded-xl border border-white/10">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-white">ECU Scanner</h3>
                                <p className="text-sm text-gray-400">Read standard OBD-II Diagnostic Trouble Codes (DTCs).</p>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-bold border ${isOBDConnected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                                {isOBDConnected ? 'ECU ONLINE' : 'NO CONNECTION'}
                            </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-3 mb-6">
                            <button 
                                onClick={handleReadDTCs}
                                disabled={isScanningDTC}
                                className={`px-6 py-3 rounded-xl text-sm font-bold text-white shadow-lg transition-all ${theme.colors.button} ${theme.colors.buttonHover}`}
                            >
                                {isScanningDTC ? 'Scanning Bus...' : 'Scan For Codes'}
                            </button>
                            {dtcCodes.length > 0 && (
                                <button 
                                    onClick={handleAnalyzeDTCs}
                                    disabled={isDiagnosing}
                                    className={`px-6 py-3 rounded-xl text-sm font-bold text-slate-900 bg-cyan-400 hover:bg-cyan-300 flex items-center gap-2 shadow-[0_0_15px_rgba(34,211,238,0.3)] transition-all`}
                                >
                                    <ChatIcon className="w-4 h-4" />
                                    {isDiagnosing ? 'Analyzing...' : 'Ask Genesis AI'}
                                </button>
                            )}
                            <button 
                                onClick={handleClearDTCs}
                                className="px-6 py-3 rounded-xl text-sm font-bold text-white bg-red-900/50 border border-red-500/30 hover:bg-red-800 ml-auto transition-all"
                            >
                                Clear All
                            </button>
                        </div>

                        <div className="bg-black/60 rounded-xl border border-white/10 min-h-[120px] mb-4 overflow-hidden relative">
                            {dtcCodes.length === 0 ? (
                                <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-sm italic">
                                    No fault codes detected.
                                </div>
                            ) : (
                                <div className="divide-y divide-white/10">
                                    {dtcCodes.map((code, i) => (
                                        <div key={i} className="p-4 flex items-center gap-4 hover:bg-white/5 transition-colors">
                                            <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_red]"></div>
                                            <span className="text-red-400 font-mono text-lg font-bold">{code.split(' - ')[0]}</span>
                                            <span className="text-gray-300 text-sm">{code.split(' - ')[1]}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {aiDiagnosis && (
                            <div className="p-5 rounded-xl bg-cyan-950/30 border border-cyan-500/30 animate-in fade-in slide-in-from-top-2 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500"></div>
                                <h4 className="text-cyan-400 font-bold font-orbitron mb-3 flex items-center gap-2">
                                    <ChatIcon className="w-4 h-4" /> GENESIS DIAGNOSIS
                                </h4>
                                <div className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed opacity-90">
                                    {aiDiagnosis}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {activeTab === 'can' && (
                <div className="h-full flex flex-col bg-black rounded-xl border border-white/10 overflow-hidden shadow-2xl">
                    <CanSniffer />
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
