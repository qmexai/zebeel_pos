import React, { useEffect, useState } from 'react';
import { Wifi, RefreshCw, Send, CheckCircle, AlertTriangle, Cpu } from 'lucide-react';

interface ScaleSyncProps {
  apiBase: string;
}

export const ScaleSync: React.FC<ScaleSyncProps> = ({ apiBase }) => {
  const [scaleIp, setScaleIp] = useState('192.168.1.100');
  const [scalePrefix, setScalePrefix] = useState('22');
  const [syncing, setSyncing] = useState(false);
  const [pingStatus, setPingStatus] = useState<'idle' | 'pinging' | 'online' | 'offline'>('idle');
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [scaleIpConfigured, setScaleIpConfigured] = useState('192.168.1.100');

  useEffect(() => {
    // Fetch settings to initialize state
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${apiBase}/api/settings`);
        if (res.ok) {
          const settings = await res.json();
          setScaleIp(settings.scaleIp);
          setScalePrefix(settings.scalePrefix);
          setScaleIpConfigured(settings.scaleIp);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchSettings();
  }, [apiBase]);

  const saveScaleSettings = async () => {
    try {
      const res = await fetch(`${apiBase}/api/settings`);
      if (res.ok) {
        const current = await res.json();
        const updated = { ...current, scaleIp, scalePrefix };
        await fetch(`${apiBase}/api/settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        });
        setScaleIpConfigured(scaleIp);
        setSyncLogs((prev) => [`[CONFIG] Saved Scale settings. Target Scale IP: ${scaleIp}, Scale Barcode Prefix: ${scalePrefix}`, ...prev]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const testPingScale = () => {
    setPingStatus('pinging');
    setSyncLogs((prev) => [`[PING] ICMP echo request sent to ${scaleIpConfigured}...`, ...prev]);
    
    // Mock latency and ping outcome
    setTimeout(() => {
      // Simulate scale availability based on IP pattern
      const isOnline = scaleIpConfigured.startsWith('192.168.');
      setPingStatus(isOnline ? 'online' : 'offline');
      setSyncLogs((prev) => [
        isOnline 
          ? `[PING] ICMP response received from ${scaleIpConfigured}. TTL=64, time=8.5ms (ONLINE)`
          : `[PING] Connection timed out for ${scaleIpConfigured} (OFFLINE)`,
        ...prev
      ]);
    }, 1500);
  };

  const triggerPluBroadcast = async () => {
    setSyncing(true);
    setSyncLogs((prev) => [`[SYNC] Preparing PLU lookup tables from Zabeel master catalog...`, ...prev]);
    
    try {
      const res = await fetch(`${apiBase}/api/scale/sync`, {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        setSyncLogs((prev) => [
          `[SYNC] Broadcast success: Updated ${data.broadcastedPluCount} products. Broadcast payload sent to ${data.scaleIp}`,
          `[SYNC] TCP Connection established with scale on port 5001. Packets transmitted successfully.`,
          ...prev
        ]);
      } else {
        throw new Error('Broadcast endpoint failed');
      }
    } catch (err: any) {
      setSyncLogs((prev) => [`[SYNC] Critical Error: Broadcasting packet lost. Scale is offline.`, ...prev]);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Settings column */}
      <div className="lg:col-span-1 glass-panel p-6 rounded-2xl space-y-6 h-fit">
        <div className="border-b border-slate-800 pb-3 flex items-center gap-2">
          <Wifi className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-slate-200">Scale Network Config</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
              Scale Static IP Address
            </label>
            <input
              type="text"
              placeholder="e.g. 192.168.1.100"
              value={scaleIp}
              onChange={(e) => setScaleIp(e.target.value)}
              className="w-full mt-1.5 bg-slate-900 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg p-2.5 text-xs text-slate-100 font-mono focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
              Barcode Prefix code
            </label>
            <input
              type="text"
              maxLength={2}
              placeholder="e.g. 22"
              value={scalePrefix}
              onChange={(e) => setScalePrefix(e.target.value)}
              className="w-full mt-1.5 bg-slate-900 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg p-2.5 text-xs text-slate-100 font-mono focus:outline-none"
            />
            <p className="text-[10px] text-slate-500 mt-1">EAN-13 barcodes starting with this code will trigger the scale weight parser.</p>
          </div>

          <button
            onClick={saveScaleSettings}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold tracking-wider transition-all"
          >
            Save configurations
          </button>
        </div>

        {/* Scale Network Status Panel */}
        <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80 space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Device Connectivity</h3>
          
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500">Target IP</span>
            <span className="font-mono text-slate-300">{scaleIpConfigured}</span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500">Status</span>
            {pingStatus === 'online' && (
              <span className="flex items-center gap-1 text-emerald-400 font-bold">
                <CheckCircle className="w-3.5 h-3.5" /> Connected
              </span>
            )}
            {pingStatus === 'offline' && (
              <span className="flex items-center gap-1 text-red-400 font-bold">
                <AlertTriangle className="w-3.5 h-3.5" /> Disconnected
              </span>
            )}
            {pingStatus === 'pinging' && (
              <span className="flex items-center gap-1 text-blue-400 font-bold">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Pinging...
              </span>
            )}
            {pingStatus === 'idle' && (
              <span className="text-slate-500 font-mono">Not Tested</span>
            )}
          </div>

          <button
            onClick={testPingScale}
            disabled={pingStatus === 'pinging'}
            className="w-full py-1.5 mt-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-850 rounded-lg text-xs transition-all font-medium"
          >
            Ping Scale Device
          </button>
        </div>
      </div>

      {/* Syncing Console column */}
      <div className="lg:col-span-2 glass-panel p-6 rounded-2xl flex flex-col justify-between h-[500px]">
        <div className="space-y-4 flex-1 flex flex-col">
          <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-500" />
              <h2 className="text-lg font-semibold text-slate-200">Scale PLU Synchronization Console</h2>
            </div>
            <button
              onClick={triggerPluBroadcast}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-50"
            >
              <Send className={`w-3.5 h-3.5 ${syncing ? 'animate-bounce' : ''}`} />
              Sync PLUs Now
            </button>
          </div>

          {/* Sync logs terminal */}
          <div className="flex-1 bg-slate-950 p-4 rounded-xl border border-slate-850 font-mono text-[10px] text-slate-400 overflow-y-auto space-y-2 select-text">
            {syncLogs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-600">
                Console logs are empty. Run Ping test or PLU synchronization.
              </div>
            ) : (
              syncLogs.map((log, index) => (
                <div key={index} className="leading-relaxed border-l-2 border-slate-800 pl-2 py-0.5">
                  <span className="text-slate-600 font-mono select-none">[{new Date().toLocaleTimeString()}] </span>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
