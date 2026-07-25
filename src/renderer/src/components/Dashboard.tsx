import React, { useEffect, useState } from 'react';
import { DollarSign, Landmark, AlertCircle, ShoppingCart, RefreshCw } from 'lucide-react';

interface AlertProduct {
  id: string;
  pluCode: string;
  name: string;
  currentStock: number;
  minThreshold: number;
}

interface DashboardData {
  todayInvoiceCount: number;
  todayRevenue: number;
  totalCgst: number;
  totalSgst: number;
  lowStockCount: number;
  alerts: AlertProduct[];
}

interface DashboardProps {
  apiBase: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ apiBase }) => {
  const [data, setData] = useState<DashboardData>({
    todayInvoiceCount: 0,
    todayRevenue: 0,
    totalCgst: 0,
    totalSgst: 0,
    lowStockCount: 0,
    alerts: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/dashboard`);
      if (!res.ok) throw new Error('Failed to fetch dashboard metrics');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error loading dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [apiBase]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-200 to-white">
            Supermarket Analytics
          </h1>
          <p className="text-slate-400 mt-1">Real-time terminal transaction and stock tracking</p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 transition-all active:scale-95"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-300">
          <p className="text-sm font-medium">Network Connection Error</p>
          <p className="text-xs mt-1 text-red-400/80">{error}. Make sure the local database server is running.</p>
        </div>
      )}

      {/* Grid Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all duration-500" />
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-500/20 text-blue-400">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Today's Revenue</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-100 font-display">₹ {data.todayRevenue.toFixed(2)}</h3>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all duration-500" />
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-indigo-500/20 text-indigo-400">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Bills Settled</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-100 font-display">{data.todayInvoiceCount}</h3>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all duration-500" />
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">CGST Pool</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-100 font-display">₹ {data.totalCgst.toFixed(2)}</h3>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/10 rounded-full blur-2xl group-hover:bg-teal-500/20 transition-all duration-500" />
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-teal-500/20 text-teal-400">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">SGST Pool</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-100 font-display">₹ {data.totalSgst.toFixed(2)}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Out of Stock / Low Stock Panel */}
        <div className="glass-panel p-6 rounded-2xl lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              <h3 className="text-lg font-semibold text-slate-200">Critical Stock Warnings</h3>
            </div>
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {data.lowStockCount} items low
            </span>
          </div>

          <div className="max-h-96 overflow-y-auto pr-2 space-y-2">
            {data.alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <AlertCircle className="w-12 h-12 stroke-[1] mb-2 text-slate-600" />
                <p className="text-sm">All products stock ranges are optimal.</p>
              </div>
            ) : (
              data.alerts.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between items-center p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all"
                >
                  <div>
                    <h4 className="text-sm font-medium text-slate-200">{item.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded uppercase font-mono">
                        PLU: {item.pluCode}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Barcode: {item.id}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${item.currentStock <= 0 ? 'text-red-500' : 'text-amber-500'}`}>
                      {item.currentStock.toFixed(3)} kg/pcs
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Threshold: {item.minThreshold.toFixed(3)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* GST summary visualizer */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-4">
              <h3 className="text-lg font-semibold text-slate-200">GST Collection Summary</h3>
            </div>
            <div className="space-y-4 pt-2">
              <div>
                <div className="flex justify-between text-xs text-slate-400 font-medium">
                  <span>Central GST portion (50%)</span>
                  <span>₹ {data.totalCgst.toFixed(2)}</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full mt-1.5 overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full" style={{ width: data.totalCgst > 0 ? '50%' : '0%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-400 font-medium">
                  <span>State GST portion (50%)</span>
                  <span>₹ {data.totalSgst.toFixed(2)}</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full mt-1.5 overflow-hidden">
                  <div className="bg-indigo-500 h-full rounded-full" style={{ width: data.totalSgst > 0 ? '50%' : '0%' }} />
                </div>
              </div>
            </div>
          </div>
          <div className="mt-8 p-4 rounded-xl bg-slate-900 border border-slate-800/80">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Indian GST Compliance</h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Zabeel Supermarket splits all GST collections 50/50 automatically into CGST and SGST pools according to state government laws. Use the GSTR-1 reports panel for monthly filings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
