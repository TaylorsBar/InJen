
import React, { useState, useEffect, useRef } from 'react';
import { useCanBus } from '../hooks/useCanBus';
import { CanBitrate } from '../services/canService';
import { SettingsIcon, PinIcon } from './icons';

export const CanSniffer: React.FC = () => {
  const { isConnected, frames, connect, disconnect, configure, sendFrame, clearFrames } = useCanBus();
  const [selectedBitrate, setSelectedBitrate] = useState<CanBitrate>(500000);
  const [txId, setTxId] = useState('7E0');
  const [txData, setTxData] = useState('02 01 0C 00 00 00 00 00');
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleConnect = async () => {
    if (isConnected) {
        disconnect();
    } else {
        await connect();
    }
  };

  const handleSend = () => {
      const id = parseInt(txId, 16);
      const data = txData.split(' ').map(byte => parseInt(byte, 16)).filter(n => !isNaN(n));
      sendFrame(id, data);
  };

  const handleBitrateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const rate = parseInt(e.target.value) as CanBitrate;
      setSelectedBitrate(rate);
      if (isConnected) configure(rate);
  };

  return (
    <div className="flex flex-col h-full text-sm">
        {/* Toolbar */}
        <div className="flex items-center justify-between p-2 border-b border-cyan-900/50 bg-slate-900/50 rounded-t-lg">
            <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500'}`} />
                <span className="font-orbitron font-bold text-gray-300">MCP2515 INTERFACE</span>
            </div>
            <div className="flex items-center gap-2">
                <select 
                    value={selectedBitrate}
                    onChange={handleBitrateChange}
                    disabled={!isConnected} // Some hardwares require reconnect to change, others don't. Safe to allow.
                    className="bg-slate-800 text-cyan-300 border border-slate-600 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-cyan-500 outline-none"
                >
                    <option value={125000}>125 kbps</option>
                    <option value={250000}>250 kbps</option>
                    <option value={500000}>500 kbps</option>
                    <option value={1000000}>1 Mbps</option>
                </select>
                <button 
                    onClick={handleConnect}
                    className={`px-3 py-1 rounded text-xs font-bold transition-colors ${isConnected ? 'bg-red-900/50 text-red-300 hover:bg-red-800' : 'bg-cyan-900/50 text-cyan-300 hover:bg-cyan-800'}`}
                >
                    {isConnected ? 'DISCONNECT' : 'CONNECT'}
                </button>
            </div>
        </div>

        {/* Bus Traffic Log */}
        <div className="flex-grow bg-black font-mono overflow-y-auto p-2 space-y-1 relative" ref={scrollRef}>
            {frames.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-700 pointer-events-none">
                    <div className="text-center">
                        <p>Waiting for bus traffic...</p>
                        <p className="text-xs mt-1">Check TJA1050 termination</p>
                    </div>
                </div>
            )}
            {frames.map((frame, i) => (
                <div key={i} className={`flex gap-3 border-b border-gray-900 pb-0.5 ${frame.direction === 'tx' ? 'text-yellow-200' : 'text-cyan-100'}`}>
                    <span className="text-gray-500 w-16">{new Date(frame.timestamp).toLocaleTimeString([], {fractionalSecondDigits: 3} as any).split(' ')[0]}</span>
                    <span className={`w-8 font-bold ${frame.direction === 'tx' ? 'text-yellow-400' : 'text-cyan-400'}`}>{frame.direction.toUpperCase()}</span>
                    <span className="w-12 text-blue-300">ID:{frame.id.toString(16).toUpperCase().padStart(3, '0')}</span>
                    <span className="w-8 text-gray-400">[{frame.dlc}]</span>
                    <span className="flex-grow tracking-wider">
                        {frame.data.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}
                    </span>
                </div>
            ))}
        </div>

        {/* Injector Panel */}
        <div className="p-3 bg-slate-900/80 border-t border-cyan-900/50 rounded-b-lg flex flex-col gap-2">
            <div className="flex justify-between items-center">
                <span className="text-xs text-cyan-400 uppercase tracking-widest font-bold">Packet Injector</span>
                <button onClick={clearFrames} className="text-xs text-gray-500 hover:text-white">Clear Log</button>
            </div>
            <div className="flex gap-2">
                <div className="flex flex-col gap-1 w-24">
                    <label className="text-[10px] text-gray-500">ID (HEX)</label>
                    <input 
                        type="text" 
                        value={txId} 
                        onChange={e => setTxId(e.target.value.toUpperCase())}
                        className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white font-mono text-sm focus:border-cyan-500 outline-none"
                    />
                </div>
                <div className="flex flex-col gap-1 flex-grow">
                    <label className="text-[10px] text-gray-500">DATA (HEX BYTES)</label>
                    <input 
                        type="text" 
                        value={txData} 
                        onChange={e => setTxData(e.target.value.toUpperCase())}
                        className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white font-mono text-sm focus:border-cyan-500 outline-none"
                    />
                </div>
                <div className="flex flex-col justify-end">
                    <button 
                        onClick={handleSend}
                        disabled={!isConnected}
                        className="h-8 px-4 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded flex items-center gap-2 text-xs"
                    >
                        SEND
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};
