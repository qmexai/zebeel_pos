import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, Wifi, Truck, Landmark, Sliders, ChevronLeft, ChevronRight, CircleDot } from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { POSBilling } from './components/POSBilling';
import { Inventory } from './components/Inventory';
import { ScaleSync } from './components/ScaleSync';
import { Suppliers } from './components/Suppliers';
import { GstHub } from './components/GstHub';
import { Peripherals } from './components/Peripherals';

let serverPort = 5000;
try {
  if (typeof window !== 'undefined' && (window as any).require) {
    const fs = (window as any).require('fs');
    const path = (window as any).require('path');
    const settingsPath = path.join(process.cwd(), 'settings.json');
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed.serverPort) {
        serverPort = Number(parsed.serverPort);
      }
    }
  }
} catch (err) {
  console.error('Failed to load serverPort dynamically from settings.json:', err);
}

const API_BASE = `http://localhost:${serverPort}`;

const MainAppLayout: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dbStatus, setDbStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [serverMode, setServerMode] = useState<string>('Server');

  const navigate = useNavigate();
  const location = useLocation();

  // Monitor connectivity status
  const checkStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/status`);
      if (res.ok) {
        const json = await res.json();
        setDbStatus(json.database === 'connected' ? 'connected' : 'disconnected');
        setServerMode(json.mode);
      } else {
        setDbStatus('disconnected');
      }
    } catch (err) {
      setDbStatus('disconnected');
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 8000); // check status every 8s
    return () => clearInterval(interval);
  }, []);

  // Global side-nav keyboard triggers
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // Exclude F12, F11, F4, F5 if we're focused on inputs in POS checkout to avoid navigation,
      // but otherwise let F-keys navigate pages.
      const isInput = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA';
      
      if (isInput && (e.key === 'F4' || e.key === 'F5' || e.key === 'F11' || e.key === 'F12')) {
        // Let checkout shortcuts execute instead of navigation
        return;
      }

      switch (e.key) {
        case 'F1':
          e.preventDefault();
          navigate('/dashboard');
          break;
        case 'F2':
          e.preventDefault();
          navigate('/billing');
          break;
        case 'F4':
          e.preventDefault();
          navigate('/inventory');
          break;
        case 'F5':
          e.preventDefault();
          navigate('/scale');
          break;
        case 'F6':
          e.preventDefault();
          navigate('/suppliers');
          break;
        case 'F7':
          e.preventDefault();
          navigate('/gst');
          break;
        case 'F8':
          e.preventDefault();
          navigate('/peripherals');
          break;
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [navigate]);

  // Side-nav details
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', keyHint: 'F1', icon: LayoutDashboard },
    { id: 'billing', label: 'POS Billing', keyHint: 'F2', icon: ShoppingCart },
    { id: 'inventory', label: 'Inventory Master', keyHint: 'F4', icon: Package },
    { id: 'scale', label: 'Smart Scale Sync', keyHint: 'F5', icon: Wifi },
    { id: 'suppliers', label: 'Suppliers Ledger', keyHint: 'F6', icon: Truck },
    { id: 'gst', label: 'GST Compliance', keyHint: 'F7', icon: Landmark },
    { id: 'peripherals', label: 'Hardware Setup', keyHint: 'F8', icon: Sliders },
  ];

  const currentPath = location.pathname;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      
      {/* Collapsible left Sidebar */}
      <aside
        className={`glass-panel border-r border-slate-900 flex flex-col justify-between transition-all duration-300 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="flex flex-col">
          {/* Logo Brand area */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-slate-900">
            {!sidebarCollapsed && (
              <span className="font-display font-black text-sm tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-200 to-white">
                ZABEEL POS
              </span>
            )}
            {sidebarCollapsed && (
              <span className="font-display font-black text-xs text-blue-500 text-center w-full">ZB</span>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              {sidebarCollapsed ? <ChevronRight className="w-4.5 h-4.5" /> : <ChevronLeft className="w-4.5 h-4.5" />}
            </button>
          </div>

          {/* Navigation channels */}
          <nav className="p-3 space-y-1.5 mt-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const itemPath = `/${item.id}`;
              const isActive = currentPath === itemPath;
              return (
                <button
                  key={item.id}
                  id={`nav-item-${item.id}`}
                  onClick={() => navigate(itemPath)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition-all relative group ${
                    isActive
                      ? 'bg-blue-600/10 border border-blue-500/20 text-slate-100'
                      : 'border border-transparent hover:bg-slate-900/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <Icon className={`w-5 h-5 ${isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-350'}`} />
                    {!sidebarCollapsed && <span className="text-xs font-semibold">{item.label}</span>}
                  </div>
                  {!sidebarCollapsed && (
                    <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded ${isActive ? 'bg-blue-900/40 text-blue-400' : 'bg-slate-900 text-slate-650'}`}>
                      {item.keyHint}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Connection health & diagnostic bar */}
        <div className="p-4 border-t border-slate-900 bg-slate-950/40 space-y-3.5">
          <div className="flex items-center justify-between text-xs">
            {!sidebarCollapsed && (
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">System Node</span>
                <span className="font-semibold text-slate-300 text-xs">{serverMode} Mode</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <CircleDot
                className={`w-3 h-3 ${
                  dbStatus === 'connected'
                    ? 'text-emerald-500 fill-emerald-500 animate-pulse'
                    : dbStatus === 'connecting'
                    ? 'text-amber-500 fill-amber-500 animate-spin'
                    : 'text-red-500 fill-red-500'
                }`}
              />
              {!sidebarCollapsed && (
                <span className="text-[10px] font-mono text-slate-500 uppercase">
                  {dbStatus === 'connected' ? 'DB ONLINE' : dbStatus === 'connecting' ? 'SYNCING' : 'DB OFFLINE'}
                </span>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main page content view container */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header toolbar */}
        <header className="h-16 border-b border-slate-900 flex items-center justify-between px-8 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse-subtle" />
            <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold font-mono">
              Zabeel Billing Terminal Node-01
            </span>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {new Date().toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
          </span>
        </header>

        {/* View content injection */}
        <section className="flex-1 p-8 overflow-y-auto bg-slate-950">
          <div className="max-w-7xl mx-auto">
            <Routes>
              <Route path="/" element={<Navigate to="/billing" replace />} />
              <Route path="/dashboard" element={<Dashboard apiBase={API_BASE} />} />
              <Route path="/billing" element={<POSBilling apiBase={API_BASE} />} />
              <Route path="/inventory" element={<Inventory apiBase={API_BASE} />} />
              <Route path="/scale" element={<ScaleSync apiBase={API_BASE} />} />
              <Route path="/suppliers" element={<Suppliers apiBase={API_BASE} />} />
              <Route path="/gst" element={<GstHub apiBase={API_BASE} />} />
              <Route path="/peripherals" element={<Peripherals apiBase={API_BASE} onSettingsChange={checkStatus} />} />
            </Routes>
          </div>
        </section>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <MainAppLayout />
    </Router>
  );
};

export default App;
