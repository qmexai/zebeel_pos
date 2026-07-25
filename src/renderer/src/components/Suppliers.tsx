import React, { useEffect, useState } from 'react';
import { Truck, Landmark, Plus, RefreshCw, FileText, ClipboardList } from 'lucide-react';

interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  gstin: string | null;
  outstandingDebt: number;
}

interface LedgerTransaction {
  id: number;
  timestamp: string;
  description: string;
  purchaseAmount: number;
  paidAmount: number;
}

interface SuppliersProps {
  apiBase: string;
}

export const Suppliers: React.FC<SuppliersProps> = ({ apiBase }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Active ledger mapping state
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [ledgerHistory, setLedgerHistory] = useState<LedgerTransaction[]>([]);
  
  // Modal toggle/state
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierGstin, setNewSupplierGstin] = useState('');
  const [addSupplierOpen, setAddSupplierOpen] = useState(false);

  // New transaction state
  const [txDesc, setTxDesc] = useState('');
  const [txPurchase, setTxPurchase] = useState<number>(0);
  const [txPaid, setTxPaid] = useState<number>(0);
  const [addTxOpen, setAddTxOpen] = useState(false);

  const fetchSuppliers = async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/suppliers`);
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data);
        // Sync selected supplier data if already open
        if (selectedSupplier) {
          const fresh = data.find((s: Supplier) => s.id === selectedSupplier.id);
          if (fresh) setSelectedSupplier(fresh);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const fetchLedger = async (supplierId: number) => {
    try {
      const res = await fetch(`${apiBase}/api/suppliers/${supplierId}/ledger`);
      if (res.ok) {
        const data = await res.json();
        setLedgerHistory(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSuppliers(true);
  }, [apiBase]);

  useEffect(() => {
    if (selectedSupplier) {
      fetchLedger(selectedSupplier.id);
    }
  }, [selectedSupplier]);

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName) return;

    try {
      const res = await fetch(`${apiBase}/api/suppliers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSupplierName,
          phone: newSupplierPhone || null,
          gstin: newSupplierGstin || null,
        }),
      });

      if (res.ok) {
        setNewSupplierName('');
        setNewSupplierPhone('');
        setNewSupplierGstin('');
        setAddSupplierOpen(false);
        fetchSuppliers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || !txDesc) return;

    try {
      const res = await fetch(`${apiBase}/api/suppliers/${selectedSupplier.id}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: txDesc,
          purchaseAmount: Number(txPurchase),
          paidAmount: Number(txPaid),
        }),
      });

      if (res.ok) {
        setTxDesc('');
        setTxPurchase(0);
        setTxPaid(0);
        setAddTxOpen(false);
        fetchLedger(selectedSupplier.id);
        fetchSuppliers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const triggerPrintStatement = () => {
    if (!selectedSupplier) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Could not open print window. Please allow popups.');
      return;
    }
    
    const totalPurchases = ledgerHistory.reduce((acc, curr) => acc + Number(curr.purchaseAmount), 0);
    const totalPayments = ledgerHistory.reduce((acc, curr) => acc + Number(curr.paidAmount), 0);
    const outstanding = Number(selectedSupplier.outstandingDebt);

    const statementHtml = `
      <html>
      <head>
        <title>Supplier Statement - ${selectedSupplier.name}</title>
        <style>
          body { font-family: monospace; padding: 20px; color: #000; line-height: 1.4; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-bottom: 1px dashed #000; margin: 15px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { padding: 6px; text-align: left; font-size: 12px; }
          th { border-bottom: 2px solid #000; }
          .text-right { text-align: right; }
          .totals-table { margin-top: 20px; width: 300px; float: right; }
        </style>
      </head>
      <body>
        <div class="center bold" style="font-size: 16px;">ZABEEL POS SUPERMARKET</div>
        <div class="center" style="font-size: 10px;">STATEMENT OF ACCOUNT</div>
        <div class="divider"></div>
        
        <div><strong>SUPPLIER:</strong> ${selectedSupplier.name}</div>
        <div><strong>PHONE:</strong> ${selectedSupplier.phone || 'N/A'}</div>
        <div><strong>GSTIN:</strong> ${selectedSupplier.gstin || 'N/A'}</div>
        <div><strong>DATE GENERATED:</strong> ${new Date().toLocaleString()}</div>
        <div class="divider"></div>
        
        <table>
          <thead>
            <tr>
              <th>Date/Time</th>
              <th>Description</th>
              <th class="text-right">Purchase (₹)</th>
              <th class="text-right">Paid (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${ledgerHistory.map(item => `
              <tr>
                <td>${new Date(item.timestamp).toLocaleDateString()} ${new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                <td>${item.description}</td>
                <td class="text-right">₹${Number(item.purchaseAmount).toFixed(2)}</td>
                <td class="text-right">₹${Number(item.paidAmount).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="divider" style="clear: both;"></div>
        
        <table class="totals-table">
          <tr>
            <td class="bold">Total Purchases:</td>
            <td class="text-right font-mono">₹${totalPurchases.toFixed(2)}</td>
          </tr>
          <tr>
            <td class="bold">Total Payments:</td>
            <td class="text-right font-mono">₹${totalPayments.toFixed(2)}</td>
          </tr>
          <tr>
            <td class="bold">Outstanding Balance:</td>
            <td class="text-right font-mono bold" style="font-size: 13px;">₹${outstanding.toFixed(2)}</td>
          </tr>
        </table>
        
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          }
        </script>
      </body>
      </html>
    `;
    
    printWindow.document.write(statementHtml);
    printWindow.document.close();
  };

  // Calculate total outstanding debt across all suppliers
  const totalOutstanding = suppliers.reduce((acc, sup) => acc + sup.outstandingDebt, 0);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-white">
            Suppliers Ledger Log
          </h1>
          <p className="text-slate-400 mt-1">Manage wholesale procurement transactions and track vendor outstanding balances</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setAddSupplierOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add Supplier
          </button>
          <button
            onClick={() => fetchSuppliers(true)}
            className="p-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 rounded-xl"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10" />
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-500/20 text-blue-400">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Registered Vendors</p>
              <h3 className="text-xl font-bold mt-1 text-slate-200">{suppliers.length}</h3>
            </div>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/5 rounded-full blur-2xl group-hover:bg-red-500/10" />
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-red-500/20 text-red-400">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Outstanding Debt</p>
              <h3 className="text-xl font-bold mt-1 text-slate-200">₹ {totalOutstanding.toFixed(2)}</h3>
            </div>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10" />
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-indigo-500/20 text-indigo-400">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Active Ledgers</p>
              <h3 className="text-xl font-bold mt-1 text-slate-200">
                {suppliers.filter((s) => s.outstandingDebt > 0).length} Owed
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* Main Split Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Suppliers List (Left 1 col) */}
        <div className="lg:col-span-1 glass-panel p-6 rounded-2xl space-y-4">
          <h2 className="text-sm font-semibold text-slate-350 border-b border-slate-800 pb-2">Vendors Directory</h2>
          
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {loading ? (
              <p className="text-xs text-slate-500 text-center py-10">Loading vendors...</p>
            ) : suppliers.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-10">No suppliers registered.</p>
            ) : (
              suppliers.map((sup) => (
                <button
                  key={sup.id}
                  onClick={() => setSelectedSupplier(sup)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-col gap-1 ${
                    selectedSupplier?.id === sup.id
                      ? 'bg-blue-600/10 border-blue-500/40 text-slate-100'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="font-semibold text-xs">{sup.name}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        sup.outstandingDebt > 0 ? 'bg-red-500/10 text-red-400' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      ₹{sup.outstandingDebt.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex gap-2 text-[9px] text-slate-500 mt-1">
                    <span>Ph: {sup.phone || 'N/A'}</span>
                    <span>•</span>
                    <span>GST: {sup.gstin || 'N/A'}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Ledger Details (Right 2 cols) */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl flex flex-col justify-between min-h-[450px]">
          {selectedSupplier ? (
            <div className="space-y-4 flex-1 flex flex-col justify-between">
              
              {/* Ledger Header */}
              <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-slate-200 text-sm">{selectedSupplier.name} Ledger Details</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">GSTIN: {selectedSupplier.gstin || 'N/A'}</p>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={triggerPrintStatement}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded-lg bg-slate-800 border border-slate-700 text-slate-350 hover:bg-slate-700 transition-all active:scale-95"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Print Statement
                  </button>
                  <button
                    onClick={() => setAddTxOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Record Transaction
                  </button>
                </div>
              </div>

              {/* Transaction Table */}
              <div className="flex-1 overflow-y-auto max-h-[300px] mt-2 pr-1">
                {ledgerHistory.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-20 text-slate-500">
                    <FileText className="w-10 h-10 stroke-[1] mb-2 text-slate-650" />
                    <p className="text-xs">No ledger history logged for this supplier yet.</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-800">
                        <th className="py-2">Date/Time</th>
                        <th className="py-2">Description</th>
                        <th className="py-2 text-right">Purchase Amt (₹)</th>
                        <th className="py-2 text-right">Paid Amt (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/60">
                      {ledgerHistory.map((h) => (
                        <tr key={h.id} className="text-slate-350 hover:bg-slate-900/40">
                          <td className="py-2.5 font-mono text-[10px]">
                            {new Date(h.timestamp).toLocaleDateString()} {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-2.5 text-slate-200">{h.description}</td>
                          <td className="py-2.5 text-right font-mono text-amber-500/90">
                            {h.purchaseAmount > 0 ? `₹${h.purchaseAmount.toFixed(2)}` : '-'}
                          </td>
                          <td className="py-2.5 text-right font-mono text-emerald-500/90">
                            {h.paidAmount > 0 ? `₹${h.paidAmount.toFixed(2)}` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 py-24 flex-1">
              <ClipboardList className="w-12 h-12 stroke-[1] mb-3 text-slate-700 animate-pulse-subtle" />
              <p className="text-sm font-semibold">No vendor selected</p>
              <p className="text-xs text-slate-600 mt-1">Select a vendor from directory to display outstanding statements</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Supplier Modal */}
      {addSupplierOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-float">
            <div className="px-6 py-4 bg-slate-950/50 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-semibold text-slate-200 text-sm">Add New wholesale Supplier</h3>
              <button onClick={() => setAddSupplierOpen(false)} className="text-slate-400 hover:text-slate-100">
                Cancel
              </button>
            </div>
            <form onSubmit={handleAddSupplier} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Vendor Name</label>
                <input
                  type="text"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  className="w-full mt-1.5 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Vendor Phone</label>
                <input
                  type="text"
                  value={newSupplierPhone}
                  onChange={(e) => setNewSupplierPhone(e.target.value)}
                  className="w-full mt-1.5 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Vendor GSTIN</label>
                <input
                  type="text"
                  placeholder="e.g. 29ABCDE1234F1Z5"
                  value={newSupplierGstin}
                  onChange={(e) => setNewSupplierGstin(e.target.value.toUpperCase())}
                  className="w-full mt-1.5 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAddSupplierOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white"
                >
                  Create Vendor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Transaction Modal */}
      {addTxOpen && selectedSupplier && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-float">
            <div className="px-6 py-4 bg-slate-950/50 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-semibold text-slate-200 text-sm">Log Transaction: {selectedSupplier.name}</h3>
              <button onClick={() => setAddTxOpen(false)} className="text-slate-400 hover:text-slate-100">
                Cancel
              </button>
            </div>
            <form onSubmit={handleAddTransaction} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Transaction description</label>
                <input
                  type="text"
                  placeholder="e.g. Shipment of basmati rice, cash payment, etc."
                  value={txDesc}
                  onChange={(e) => setTxDesc(e.target.value)}
                  className="w-full mt-1.5 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Purchase amount (Owed) (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={txPurchase || ''}
                  onChange={(e) => setTxPurchase(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full mt-1.5 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Paid amount (Disbursed) (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={txPaid || ''}
                  onChange={(e) => setTxPaid(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full mt-1.5 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAddTxOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white"
                >
                  Post Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
