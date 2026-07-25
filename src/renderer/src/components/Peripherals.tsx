import React, { useEffect, useState } from 'react';
import { Settings, Sliders, Database, Printer, ToggleLeft, ToggleRight, Server, RefreshCw, CheckCircle } from 'lucide-react';

interface AppSettings {
  databaseUrl: string;
  serverIp: string;
  serverPort: number;
  isServerMode: boolean;
  scaleIp: string;
  scalePrefix: string;
  receiptWidth: '58mm' | '80mm';
  printerDriverPath: string;
}

interface PeripheralsProps {
  apiBase: string;
  onSettingsChange?: () => void;
}

export const Peripherals: React.FC<PeripheralsProps> = ({ apiBase, onSettingsChange }) => {
  const [settings, setSettings] = useState<AppSettings>({
    databaseUrl: '',
    serverIp: '',
    serverPort: 5000,
    isServerMode: true,
    scaleIp: '',
    scalePrefix: '',
    receiptWidth: '80mm',
    printerDriverPath: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/settings`);
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [apiBase]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch(`${apiBase}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        setSaveSuccess(true);
        if (onSettingsChange) onSettingsChange();
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-white">
          Hardware & Peripherals Setup
        </h1>
        <p className="text-slate-400 mt-1">Configure thermal receipt printer rolls, scale IPs, local network databases, and node server endpoints</p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-500 text-sm">Loading peripheral configs...</div>
      ) : (
        <form onSubmit={handleSaveSettings} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main settings options */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Database & Network mode */}
            <div className="glass-panel p-6 rounded-2xl space-y-4">
              <div className="border-b border-slate-800 pb-3 flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-400" />
                <h3 className="font-semibold text-slate-200 text-sm">Local Server & Database Configuration</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-[10px] text-slate-450 uppercase tracking-wider block font-semibold">
                    PostgreSQL Connection URL (Prisma Syntax)
                  </label>
                  <input
                    type="text"
                    value={settings.databaseUrl}
                    onChange={(e) => setSettings((prev) => ({ ...prev, databaseUrl: e.target.value }))}
                    className="w-full mt-1.5 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-xs text-slate-100 font-mono focus:outline-none"
                    required
                  />
                  <p className="text-[9px] text-slate-500 mt-1">
                    Only required for the designated "Local Server PC". (Format: postgresql://user:pass@host:port/dbname)
                  </p>
                </div>

                <div>
                  <label className="text-[10px] text-slate-450 uppercase tracking-wider block font-semibold font-mono">
                    Local API Server Host IP (Auto-Detected)
                  </label>
                  <input
                    type="text"
                    value={settings.serverIp}
                    className="w-full mt-1.5 bg-slate-950/60 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-400 font-mono focus:outline-none cursor-not-allowed opacity-60"
                    readOnly
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-450 uppercase tracking-wider block font-semibold font-mono">
                    Local Server port
                  </label>
                  <input
                    type="number"
                    value={settings.serverPort}
                    onChange={(e) => setSettings((prev) => ({ ...prev, serverPort: parseInt(e.target.value) || 5000 }))}
                    className="w-full mt-1.5 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-xs text-slate-100 font-mono focus:outline-none"
                    required
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 bg-slate-950/40 rounded-xl border border-slate-850/80 md:col-span-2">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-slate-200 block">Server Mode (Primary Host Node)</span>
                    <span className="text-[10px] text-slate-550 block">
                      Enables the local PostgreSQL backend database queries. Disable if this machine is a client billing terminal.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSettings((prev) => ({ ...prev, isServerMode: !prev.isServerMode }))}
                    className="text-slate-400 hover:text-slate-100 transition-colors"
                  >
                    {settings.isServerMode ? (
                      <ToggleRight className="w-10 h-10 text-blue-500" />
                    ) : (
                      <ToggleLeft className="w-10 h-10 text-slate-650" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Thermal Receipt Roll setup */}
            <div className="glass-panel p-6 rounded-2xl space-y-4">
              <div className="border-b border-slate-800 pb-3 flex items-center gap-2">
                <Printer className="w-5 h-5 text-blue-400" />
                <h3 className="font-semibold text-slate-200 text-sm">Receipt Printer Layout</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-slate-450 uppercase tracking-wider block font-semibold">
                    Thermal Paper Width
                  </label>
                  <select
                    value={settings.receiptWidth}
                    onChange={(e) => setSettings((prev) => ({ ...prev, receiptWidth: e.target.value as '58mm' | '80mm' }))}
                    className="w-full mt-1.5 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="80mm">Standard Wide roll (80mm - Recommended)</option>
                    <option value="58mm">Compact checkout roll (58mm)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-450 uppercase tracking-wider block font-semibold">
                    Silent Printer Device Path
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. /dev/usb/lp0 or LPT1"
                    value={settings.printerDriverPath}
                    onChange={(e) => setSettings((prev) => ({ ...prev, printerDriverPath: e.target.value }))}
                    className="w-full mt-1.5 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-xs text-slate-100 font-mono focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Smart Weighing Scale Settings */}
            <div className="glass-panel p-6 rounded-2xl space-y-4">
              <div className="border-b border-slate-800 pb-3 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-400" />
                <h3 className="font-semibold text-slate-200 text-sm">Smart Weighing Scale Configuration</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-slate-450 uppercase tracking-wider block font-semibold font-mono">
                    Weight Barcode Prefix (EAN-13)
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    placeholder="e.g. 22"
                    value={settings.scalePrefix}
                    onChange={(e) => setSettings((prev) => ({ ...prev, scalePrefix: e.target.value }))}
                    className="w-full mt-1.5 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-xs text-slate-100 font-mono focus:outline-none"
                    required
                  />
                  <p className="text-[9px] text-slate-500 mt-1">
                    Prefix code denoting weigh labels (usually 22).
                  </p>
                </div>

                <div>
                  <label className="text-[10px] text-slate-450 uppercase tracking-wider block font-semibold font-mono">
                    Smart Scale IP Address
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 192.168.1.100"
                    value={settings.scaleIp}
                    onChange={(e) => setSettings((prev) => ({ ...prev, scaleIp: e.target.value }))}
                    className="w-full mt-1.5 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-xs text-slate-100 font-mono focus:outline-none"
                    required
                  />
                  <p className="text-[9px] text-slate-500 mt-1">
                    Static IP of the weighing scale machine in local network.
                  </p>
                </div>
              </div>

              {/* PLU Broadcast action */}
              <div className="pt-3.5 border-t border-slate-850 flex justify-between items-center gap-4">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-slate-350 block">Broadcast PLU Master Table</span>
                  <span className="text-[10px] text-slate-550 block">Pushes price list updates directly to the scale over local Wi-Fi.</span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await fetch(`${apiBase}/api/scale/sync`, { method: 'POST' });
                      const json = await res.json();
                      if (res.ok) {
                        alert(json.message || 'PLUs synced successfully!');
                      } else {
                        alert('Sync failed: ' + json.error);
                      }
                    } catch (err: any) {
                      alert('Network connection error: ' + err.message);
                    }
                  }}
                  className="px-4 py-2.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow transition-all active:scale-[0.98]"
                >
                  Broadcast PLUs
                </button>
              </div>
            </div>

          </div>

          {/* Quick diagnostics column */}
          <div className="lg:col-span-1 space-y-6">
            <div className="glass-panel p-6 rounded-2xl space-y-6">
              <div className="border-b border-slate-800 pb-3 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-400" />
                <h3 className="font-semibold text-slate-200 text-sm">Save & Apply Settings</h3>
              </div>

              <p className="text-[11px] text-slate-450 leading-relaxed">
                Applying database URL modifications will prompt Electron to reboot the internal Prisma Client pool. Make sure the credentials are correct before saving.
              </p>

              {saveSuccess && (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Settings saved and applied successfully.
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold font-display shadow-lg shadow-blue-600/10 transition-all disabled:opacity-50"
              >
                {saving ? 'Applying settings...' : 'Save Configuration'}
              </button>

              <button
                type="button"
                onClick={fetchSettings}
                className="w-full py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Discard Changes
              </button>
            </div>

            {/* Receipt format mock visualization */}
            <div className="glass-panel p-4 rounded-2xl flex flex-col items-center">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-3">Receipt Size Preview ({settings.receiptWidth})</span>
              <div
                className="bg-white text-black p-4 rounded shadow-md font-mono text-[9px] leading-tight select-none"
                style={{ width: settings.receiptWidth === '80mm' ? '180px' : '140px' }}
              >
                <div className="text-center font-bold border-b border-dashed border-black pb-1.5 mb-1.5">
                  <span className="text-[10px]">ZABEEL SUPERMARKET</span>
                  <br />
                  <span>TAX INVOICE</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>1. Item Name</span>
                    <span>150.00</span>
                  </div>
                  <div className="flex justify-between text-[8px] text-slate-650 pl-2">
                    <span>CGST @9.0%: 11.44</span>
                    <span>SGST @9.0%: 11.44</span>
                  </div>
                </div>
                <div className="border-t border-dashed border-black pt-1.5 mt-2 space-y-1 font-bold">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>127.12</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Taxes:</span>
                    <span>22.88</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span>NET TOTAL:</span>
                    <span>150.00</span>
                  </div>
                </div>
                <div className="text-center border-t border-dashed border-black pt-1.5 mt-2 text-[7px] text-slate-650">
                  <span>THANK YOU. VISIT AGAIN!</span>
                </div>
              </div>
            </div>
          </div>

        </form>
      )}
    </div>
  );
};
