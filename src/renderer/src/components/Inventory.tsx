import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Search, RefreshCw, Barcode, Eye, FileSpreadsheet, History, ClipboardList, Database, Save, CheckCircle2, AlertCircle, Link, Wifi } from 'lucide-react';
import { generateEan13Svg } from '../../../shared/barcodeGen';

interface Product {
  id: string; // Barcode
  pluCode: string | null;
  category?: string;
  name: string;
  hsnCode: string;
  currentStock: number;
  minThreshold: number;
  costPrice: number;
  sellingPrice: number;
  gstRate: number;
  taxInclusive: boolean;
}

interface StockLog {
  id: number;
  productId: string;
  quantityAdded: number;
  previousStock: number;
  newStock: number;
  sourceType: string;
  referenceNote: string | null;
  timestamp: string;
}

interface InventoryProps {
  apiBase: string;
}

const CATEGORIES = ['Grocery', 'Bakery', 'Dairy', 'Beverages', 'Snacks', 'Produce', 'Sanitary', 'Others'];

export const Inventory: React.FC<InventoryProps> = ({ apiBase }) => {
  const [activeTab, setActiveTab] = useState<'catalog' | 'onboard'>('catalog');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Tab A States
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [stockLogs, setStockLogs] = useState<StockLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [intakeQty, setIntakeQty] = useState('');
  const [intakeSource, setIntakeSource] = useState<'MANUAL_ENTRY' | 'SUPPLIER_INBOUND'>('MANUAL_ENTRY');
  const [intakeNote, setIntakeNote] = useState('');
  const [intakeSuccess, setIntakeSuccess] = useState(false);
  const [intakeError, setIntakeError] = useState<string | null>(null);
  const [submittingIntake, setSubmittingIntake] = useState(false);
  const [intakeSupplierId, setIntakeSupplierId] = useState('');
  const [intakeAdvancePaid, setIntakeAdvancePaid] = useState('0.00');

  // Tab B States
  const [onboardForm, setOnboardForm] = useState({
    id: '',
    pluCode: '',
    category: 'Others',
    name: '',
    hsnCode: '',
    currentStock: '0.000',
    minThreshold: '5.000',
    costPrice: '0.00',
    sellingPrice: '0.00',
    mrp: '0.00',
    packageWeight: '',
    packageUnit: 'g',
    sackKg: '',
    sackRate: '',
    gstRate: '18.00',
    taxInclusive: true,
    supplierId: '',
    advancePaid: '0.00',
  });
  const [isSackMode, setIsSackMode] = useState(false);
  const [barcodeType, setBarcodeType] = useState<'vendor' | 'custom'>('vendor');
  const [generatingBarcode, setGeneratingBarcode] = useState(false);
  const [onboardSuccess, setOnboardSuccess] = useState(false);
  const [onboardError, setOnboardError] = useState<string | null>(null);
  const [submittingOnboard, setSubmittingOnboard] = useState(false);
  const [sellType, setSellType] = useState<'packed' | 'weighted'>('packed');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');
  const [suppliers, setSuppliers] = useState<any[]>([]);

  // New Vendor inline modal states
  const [newVendorOpen, setNewVendorOpen] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorPhone, setNewVendorPhone] = useState('');
  const [newVendorGstin, setNewVendorGstin] = useState('');
  const [vendorSubmitting, setVendorSubmitting] = useState(false);
  const [vendorError, setVendorError] = useState<string | null>(null);

  // Auto-calculate cost price per kg from sack rate
  useEffect(() => {
    if (sellType === 'weighted' && isSackMode) {
      const kg = parseFloat(onboardForm.sackKg);
      const rate = parseFloat(onboardForm.sackRate);
      if (!isNaN(kg) && kg > 0 && !isNaN(rate) && rate >= 0) {
        const calculatedCost = (rate / kg).toFixed(2);
        setOnboardForm((prev) => ({ ...prev, costPrice: calculatedCost }));
      }
    }
  }, [onboardForm.sackKg, onboardForm.sackRate, sellType, isSackMode]);

  const fetchSuppliers = async () => {
    try {
      const res = await fetch(`${apiBase}/api/suppliers`);
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [apiBase]);

  const handleCreateVendorInline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVendorName) return;
    setVendorSubmitting(true);
    setVendorError(null);
    try {
      const res = await fetch(`${apiBase}/api/suppliers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newVendorName,
          phone: newVendorPhone || null,
          gstin: newVendorGstin || null,
        }),
      });
      if (res.ok) {
        const newVendor = await res.json();
        await fetchSuppliers();
        setOnboardForm((prev) => ({ ...prev, supplierId: String(newVendor.id) }));
        setIntakeSupplierId(String(newVendor.id));
        setNewVendorName('');
        setNewVendorPhone('');
        setNewVendorGstin('');
        setNewVendorOpen(false);
      } else {
        const json = await res.json();
        setVendorError(json.error || 'Failed to create vendor');
      }
    } catch (err: any) {
      setVendorError(err.message || 'Error occurred');
    } finally {
      setVendorSubmitting(false);
    }
  };
  const [serverIp, setServerIp] = useState('localhost');
  const [scanListeningStatus, setScanListeningStatus] = useState('Idle');

  // Fetch local server IP on load
  useEffect(() => {
    const fetchIp = async () => {
      try {
        const res = await fetch(`${apiBase}/api/status`);
        if (res.ok) {
          const json = await res.json();
          if (json.ip) {
            setServerIp(json.ip);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchIp();
  }, [apiBase]);

  // Poll Wi-Fi scan-events when onboarding vendor barcodes
  useEffect(() => {
    if (activeTab !== 'onboard' || barcodeType !== 'vendor') {
      setScanListeningStatus('Idle');
      return;
    }

    setScanListeningStatus('Listening for Wi-Fi scan events...');

    const pollOnboardScans = async () => {
      try {
        const res = await fetch(`${apiBase}/api/scan-event`);
        if (res.ok) {
          const data = await res.json();
          if (data.barcodes && data.barcodes.length > 0) {
            // Take the latest scanned barcode and put it in the input field
            const latestCode = data.barcodes[data.barcodes.length - 1];
            setOnboardForm((prev) => ({ ...prev, id: latestCode }));
            setScanListeningStatus(`Scanned barcode: ${latestCode}`);
            // Clear status after 3s
            setTimeout(() => {
              setScanListeningStatus('Listening for Wi-Fi scan events...');
            }, 3000);
          }
        }
      } catch (err) {
        console.error('Onboard scanner polling failed', err);
      }
    };

    const interval = setInterval(pollOnboardScans, 1500);
    return () => clearInterval(interval);
  }, [activeTab, barcodeType, apiBase]);

  // Bulk Import States
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/products`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [apiBase]);

  // Tab A - Fetch Stock adjustment history
  const fetchStockLogs = async (productId: string) => {
    setLoadingLogs(true);
    try {
      const res = await fetch(`${apiBase}/api/products/${productId}/stock-logs`);
      if (res.ok) {
        const data = await res.json();
        setStockLogs(data);
      }
    } catch (err) {
      console.error('Failed to load stock audit timeline', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleRowClick = (product: Product) => {
    setSelectedProduct(product);
    fetchStockLogs(product.id);
    setIntakeQty('');
    setIntakeNote('');
    setIntakeSuccess(false);
    setIntakeError(null);
    setIntakeSupplierId('');
    setIntakeAdvancePaid('0.00');
  };

  // Tab A - Process Stock intake
  const handleStockIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const qty = parseFloat(intakeQty);
    if (isNaN(qty) || qty === 0) {
      setIntakeError('Please enter a valid non-zero stock count');
      return;
    }

    setSubmittingIntake(true);
    setIntakeError(null);
    setIntakeSuccess(false);

    try {
      const res = await fetch(`${apiBase}/api/products/stock-intake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          quantityAdded: qty,
          sourceType: intakeSource,
          referenceNote: intakeNote,
          supplierId: intakeSupplierId ? parseInt(intakeSupplierId) : undefined,
          advancePaid: parseFloat(intakeAdvancePaid) || 0,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to apply stock changes');
      }

      setIntakeSuccess(true);
      setIntakeQty('');
      setIntakeNote('');
      setIntakeSupplierId('');
      setIntakeAdvancePaid('0.00');
      
      // Update local product display
      if (json.product) {
        setSelectedProduct(json.product);
        setProducts((prev) =>
          prev.map((p) => (p.id === json.product.id ? json.product : p))
        );
      }
      fetchStockLogs(selectedProduct.id);
    } catch (err: any) {
      setIntakeError(err.message || 'Intake failed');
    } finally {
      setSubmittingIntake(false);
    }
  };

  // Tab B - Barcode auto-generation sequence
  const handleAutoGenerateBarcode = async () => {
    setGeneratingBarcode(true);
    setOnboardError(null);
    try {
      const res = await fetch(`${apiBase}/api/products/next-barcode`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to query next sequence');
      const data = await res.json();
      setOnboardForm((prev) => ({ ...prev, id: data.barcode }));
      setBarcodeType('custom');
    } catch (err: any) {
      setOnboardError('EAN Sequencer error: ' + err.message);
    } finally {
      setGeneratingBarcode(false);
    }
  };

  // Tab B - Onboard SKU
  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOnboardError(null);
    setOnboardSuccess(false);
    setSubmittingOnboard(true);

    let paddedPlu = null;
    if (sellType === 'weighted') {
      const rawPlu = onboardForm.pluCode.trim();
      if (!rawPlu) {
        setOnboardError('Weighted items must have a PLU code.');
        setSubmittingOnboard(false);
        return;
      }
      if (!/^\d+$/.test(rawPlu)) {
        setOnboardError('PLU Code must contain only numeric digits (e.g. 00541)');
        setSubmittingOnboard(false);
        return;
      }
      paddedPlu = rawPlu.padStart(5, '0');
    }

    const rawHsn = onboardForm.hsnCode.trim();
    if (!/^\d+$/.test(rawHsn)) {
      setOnboardError('HSN Code must contain only numeric digits (e.g. 08061000)');
      setSubmittingOnboard(false);
      return;
    }

    const payload = {
      id: onboardForm.id,
      pluCode: paddedPlu,
      category: onboardForm.category,
      name: onboardForm.name,
      hsnCode: rawHsn,
      currentStock: parseFloat(onboardForm.currentStock) || 0,
      minThreshold: parseFloat(onboardForm.minThreshold) || 5.0,
      costPrice: parseFloat(onboardForm.costPrice) || 0,
      sellingPrice: parseFloat(onboardForm.sellingPrice) || 0,
      mrp: parseFloat(onboardForm.mrp) > 0 ? parseFloat(onboardForm.mrp) : parseFloat(onboardForm.sellingPrice) || 0,
      packageWeight: sellType === 'packed' && onboardForm.packageWeight ? parseFloat(onboardForm.packageWeight) : null,
      packageUnit: sellType === 'packed' ? onboardForm.packageUnit : null,
      sackKg: sellType === 'weighted' && isSackMode && onboardForm.sackKg ? parseFloat(onboardForm.sackKg) : null,
      sackRate: sellType === 'weighted' && isSackMode && onboardForm.sackRate ? parseFloat(onboardForm.sackRate) : null,
      gstRate: parseFloat(onboardForm.gstRate) || 0,
      taxInclusive: onboardForm.taxInclusive,
      supplierId: onboardForm.supplierId ? parseInt(onboardForm.supplierId) : undefined,
      advancePaid: parseFloat(onboardForm.advancePaid) || 0,
    };

    try {
      const res = await fetch(`${apiBase}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'SKU onboarding failed');
      }

      setOnboardSuccess(true);
      fetchProducts();
      // Reset form
      setOnboardForm({
        id: '',
        pluCode: '',
        category: 'Others',
        name: '',
        hsnCode: '',
        currentStock: '0.000',
        minThreshold: '5.000',
        costPrice: '0.00',
        sellingPrice: '0.00',
        mrp: '0.00',
        packageWeight: '',
        packageUnit: 'g',
        sackKg: '',
        sackRate: '',
        gstRate: '18.00',
        taxInclusive: true,
        supplierId: '',
        advancePaid: '0.00',
      });
      setSellType('packed');
      setIsSackMode(false);
    } catch (err: any) {
      setOnboardError(err.message || 'Onboard request failed');
    } finally {
      setSubmittingOnboard(false);
    }
  };

  // Bulk spreadsheets importer
  const handleBulkImportSubmit = async () => {
    try {
      const parsed = JSON.parse(bulkText);
      const res = await fetch(`${apiBase}/api/products/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: parsed }),
      });

      if (res.ok) {
        alert('Spreadsheet products uploaded successfully');
        setBulkImportOpen(false);
        setBulkText('');
        fetchProducts();
      } else {
        const err = await res.json();
        alert(`Bulk upload error: ${err.error}`);
      }
    } catch (err) {
      alert('Invalid JSON structure. Please cross-reference template structure.');
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.id.includes(search) ||
      (p.pluCode && p.pluCode.includes(search));
    const matchesCategory =
      selectedCategoryFilter === 'All' || p.category === selectedCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      
      {/* Header section with Tabs switcher */}
      <div className="flex justify-between items-center flex-wrap gap-4 border-b border-slate-900 pb-4">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-white">
              Inventory Management (F4)
            </h1>
            <p className="text-slate-400 mt-1">Onboard master catalog items and audit stock intake logs</p>
          </div>
          
          {/* Tab Selector */}
          <div className="inline-flex p-1 bg-slate-900/80 border border-slate-800 rounded-xl">
            <button
              onClick={() => setActiveTab('catalog')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'catalog'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Catalog & Stock Matrix
            </button>
            <button
              onClick={() => setActiveTab('onboard')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'onboard'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Onboard SKU & Print
            </button>
          </div>
        </div>

        {/* Global Catalog Controls */}
        <div className="flex gap-2">
          <button
            onClick={() => setBulkImportOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-350 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            Upload Spreadsheet
          </button>
          <button
            onClick={fetchProducts}
            className="p-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 rounded-xl"
          >
            <RefreshCw className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* VIEW CONDITIONAL RENDERING */}
      {activeTab === 'catalog' ? (
        
        /* TAB A: Product Catalog & Stock Matrix */
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search catalog by Barcode, PLU Code, or Name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-2.5 pl-11 text-xs text-slate-100 focus:outline-none"
              />
              <Search className="absolute left-4 top-3 w-4 h-4 text-slate-500" />
            </div>
            
            <div className="w-48">
              <select
                id="catalog-category-filter-select"
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none font-semibold"
              >
                <option value="All">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-20 text-center text-slate-550 text-xs">Loading items...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-20 text-center text-slate-550 text-xs">No registered listings matches.</div>
            ) : (
              <table className="w-full text-left text-xs select-none">
                <thead>
                  <tr className="text-slate-450 border-b border-slate-850">
                    <th className="py-3">EAN Barcode</th>
                    <th className="py-3">Category</th>
                    <th className="py-3">PLU Code</th>
                    <th className="py-3">Display Name</th>
                    <th className="py-3">HSN Code</th>
                    <th className="py-3 text-right">Selling MRP (₹)</th>
                    <th className="py-3 text-right">Tax Rate</th>
                    <th className="py-3 text-right">Available Stock</th>
                    <th className="py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60">
                  {filteredProducts.map((p) => {
                    const isLowStock = p.currentStock <= p.minThreshold;
                    return (
                      <tr
                        key={p.id}
                        onClick={() => handleRowClick(p)}
                        className="table-row-hover text-slate-350 cursor-pointer"
                      >
                        <td className="py-3.5 font-mono text-slate-500">{p.id}</td>
                        <td className="py-3.5 text-slate-400 font-semibold">{p.category || 'Others'}</td>
                        <td className="py-3.5 font-mono text-slate-400">{p.pluCode || 'Packed'}</td>
                        <td className="py-3.5 font-semibold text-slate-200">
                          {p.name}
                          {p.packageWeight && (
                            <span className="text-[10px] text-slate-400 font-mono ml-1.5 font-normal">
                              ({Number(p.packageWeight)} {p.packageUnit})
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 font-mono text-slate-550">{p.hsnCode}</td>
                        <td className="py-3.5 text-right font-mono font-bold text-blue-400">₹{p.sellingPrice.toFixed(2)}</td>
                        <td className="py-3.5 text-right font-mono text-slate-450">{p.gstRate}%</td>
                        <td className="py-3.5 text-right font-mono font-bold">
                          {p.currentStock.toFixed(3)}
                        </td>
                        <td className="py-3.5 text-center">
                          <span
                            className={`px-2 py-0.5 text-[9px] font-bold rounded-full border ${
                              p.currentStock <= 0
                                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                : isLowStock
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            }`}
                          >
                            {p.currentStock <= 0 ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'Good'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

      ) : (

        /* TAB B: Onboard New SKU & Barcodes Print */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Form profile */}
          <div className="lg:col-span-2 glass-panel p-6 rounded-2xl space-y-6">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-base font-semibold text-slate-200">Onboard New Product SKU</h2>
              <p className="text-xs text-slate-450 mt-0.5">Register new retail items, calculate HSN codes, and define custom barcodes sequence.</p>
            </div>

            {onboardSuccess && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Product onboarded successfully in inventory master database.</span>
              </div>
            )}

            {onboardError && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>{onboardError}</span>
              </div>
            )}

            <form onSubmit={handleOnboardSubmit} className="space-y-4">
              
              {/* Barcode mapping options */}
              <div className="bg-slate-950/60 p-4 border border-slate-850 rounded-xl space-y-4">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Barcode Label Code Type</label>
                  <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-350 cursor-pointer">
                      <input
                        type="radio"
                        name="barcodeType"
                        checked={barcodeType === 'vendor'}
                        onChange={() => setBarcodeType('vendor')}
                        className="w-4 h-4 accent-blue-600 bg-slate-900 border-slate-850"
                      />
                      Vendor Label Barcode (Scan EAN)
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-350 cursor-pointer">
                      <input
                        type="radio"
                        name="barcodeType"
                        checked={barcodeType === 'custom'}
                        onChange={() => {
                          setBarcodeType('custom');
                          if (!onboardForm.id.startsWith('99')) {
                            handleAutoGenerateBarcode();
                          }
                        }}
                        className="w-4 h-4 accent-blue-600 bg-slate-900 border-slate-850"
                      />
                      System-Generated Barcode (Local Sequence)
                    </label>
                  </div>
                </div>

                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] text-slate-450 uppercase tracking-wider block font-semibold font-mono">Barcode (EAN-13 PRIMARY KEY)</label>
                      {barcodeType === 'vendor' && (
                        <span className="text-[9px] font-bold animate-pulse text-blue-400">
                          {scanListeningStatus}
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder={barcodeType === 'vendor' ? 'Scan existing product barcode on phone/device...' : 'Generating sequential EAN-13...'}
                      value={onboardForm.id}
                      onChange={(e) => setOnboardForm((prev) => ({ ...prev, id: e.target.value }))}
                      className="w-full mt-1.5 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-xs text-slate-100 font-mono focus:outline-none"
                      required
                    />
                  </div>
                  {barcodeType === 'custom' && (
                    <button
                      type="button"
                      disabled={generatingBarcode}
                      onClick={handleAutoGenerateBarcode}
                      className="px-4 py-2.5 text-xs font-semibold rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white transition-all"
                    >
                      Regen Sequence
                    </button>
                  )}
                </div>
              </div>

              {/* Product Selling Type and Category Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/30 p-4 border border-slate-900 rounded-xl">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Selling Method</label>
                  <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-350 cursor-pointer">
                      <input
                        type="radio"
                        name="sellType"
                        checked={sellType === 'packed'}
                        onChange={() => {
                          setSellType('packed');
                          setOnboardForm(prev => ({ ...prev, pluCode: '' }));
                        }}
                        className="w-4 h-4 accent-blue-600 bg-slate-900 border-slate-850"
                      />
                      Packed (Barcode Unit)
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-350 cursor-pointer">
                      <input
                        type="radio"
                        name="sellType"
                        checked={sellType === 'weighted'}
                        onChange={() => setSellType('weighted')}
                        className="w-4 h-4 accent-blue-600 bg-slate-900 border-slate-850"
                      />
                      Weighted (Scale Mapping)
                    </label>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-450 uppercase tracking-wider block font-semibold font-mono">Product Category</label>
                  <select
                    id="onboard-category-select"
                    value={onboardForm.category}
                    onChange={(e) => setOnboardForm((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full mt-1.5 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none"
                    required
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* General specs grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sellType === 'weighted' && (
                  <div>
                    <label className="text-[10px] text-slate-450 uppercase tracking-wider block font-semibold font-mono">5-Digit PLU (Scale mapping)</label>
                    <input
                      type="text"
                      maxLength={5}
                      placeholder="e.g. 00541"
                      value={onboardForm.pluCode}
                      onChange={(e) => setOnboardForm((prev) => ({ ...prev, pluCode: e.target.value }))}
                      className="w-full mt-1.5 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-xs text-slate-100 font-mono focus:outline-none"
                      required
                    />
                  </div>
                )}
                <div className={sellType === 'weighted' ? '' : 'md:col-span-2'}>
                  <label className="text-[10px] text-slate-450 uppercase tracking-wider block font-semibold font-mono">HSN Code (Indian GST Commodity)</label>
                  <input
                    type="text"
                    placeholder="e.g. 08061000"
                    value={onboardForm.hsnCode}
                    onChange={(e) => setOnboardForm((prev) => ({ ...prev, hsnCode: e.target.value }))}
                    className="w-full mt-1.5 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-xs text-slate-100 font-mono focus:outline-none"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-[10px] text-slate-450 uppercase tracking-wider block font-semibold">Display Product Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Premium Green Seedless Grapes"
                    value={onboardForm.name}
                    onChange={(e) => setOnboardForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full mt-1.5 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-450 uppercase tracking-wider block font-semibold font-mono">Opening Stock Quantity (kg/pcs)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={onboardForm.currentStock}
                    onChange={(e) => setOnboardForm((prev) => ({ ...prev, currentStock: e.target.value }))}
                    className="w-full mt-1.5 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-xs text-slate-100 font-mono focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-450 uppercase tracking-wider block font-semibold font-mono">Low Stock Alert point (min_threshold)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={onboardForm.minThreshold}
                    onChange={(e) => setOnboardForm((prev) => ({ ...prev, minThreshold: e.target.value }))}
                    className="w-full mt-1.5 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-xs text-slate-100 font-mono focus:outline-none"
                    required
                  />
                </div>

                {/* Conditional Cost Calculator for Weighted / Packed items */}
                {sellType === 'weighted' && (
                  <div className="md:col-span-2 bg-slate-950/40 p-4 border border-slate-900 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-300">Calculate Cost from Sack Rate</label>
                      <input
                        id="onboard-is-sack-mode-checkbox"
                        type="checkbox"
                        checked={isSackMode}
                        onChange={(e) => {
                          setIsSackMode(e.target.checked);
                          if (!e.target.checked) {
                            setOnboardForm((prev) => ({ ...prev, sackKg: '', sackRate: '' }));
                          }
                        }}
                        className="w-4 h-4 accent-blue-600 rounded bg-slate-900 border-slate-800"
                      />
                    </div>
                    {isSackMode && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] text-slate-450 uppercase tracking-wider block font-semibold font-mono">KG per Sack</label>
                          <input
                            id="onboard-sack-kg-input"
                            type="number"
                            step="0.001"
                            placeholder="e.g. 25.000"
                            value={onboardForm.sackKg}
                            onChange={(e) => setOnboardForm((prev) => ({ ...prev, sackKg: e.target.value }))}
                            className="w-full mt-1.5 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2 text-xs text-slate-100 font-mono focus:outline-none"
                            required={isSackMode}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-450 uppercase tracking-wider block font-semibold font-mono">Rate per Sack (₹)</label>
                          <input
                            id="onboard-sack-rate-input"
                            type="number"
                            step="0.01"
                            placeholder="e.g. 1500.00"
                            value={onboardForm.sackRate}
                            onChange={(e) => setOnboardForm((prev) => ({ ...prev, sackRate: e.target.value }))}
                            className="w-full mt-1.5 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2 text-xs text-slate-100 font-mono focus:outline-none"
                            required={isSackMode}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {sellType === 'packed' && (
                  <div className="md:col-span-2 bg-slate-950/40 p-4 border border-slate-900 rounded-xl grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-slate-450 uppercase tracking-wider block font-semibold font-mono">Package Weight / Size</label>
                      <input
                        id="onboard-package-weight-input"
                        type="number"
                        step="0.001"
                        placeholder="e.g. 500 or 1"
                        value={onboardForm.packageWeight}
                        onChange={(e) => setOnboardForm((prev) => ({ ...prev, packageWeight: e.target.value }))}
                        className="w-full mt-1.5 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2 text-xs text-slate-100 font-mono focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-450 uppercase tracking-wider block font-semibold font-mono">Package Weight Unit</label>
                      <select
                        id="onboard-package-unit-select"
                        value={onboardForm.packageUnit}
                        onChange={(e) => setOnboardForm((prev) => ({ ...prev, packageUnit: e.target.value }))}
                        className="w-full mt-1.5 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2 text-xs text-slate-200 focus:outline-none"
                      >
                        <option value="g">grams (g)</option>
                        <option value="kg">kilograms (kg)</option>
                        <option value="ml">milliliters (ml)</option>
                        <option value="L">liters (L)</option>
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[10px] text-slate-450 uppercase tracking-wider block font-semibold font-mono">Supplier Net Cost Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={onboardForm.costPrice}
                    onChange={(e) => setOnboardForm((prev) => ({ ...prev, costPrice: e.target.value }))}
                    className="w-full mt-1.5 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-xs text-slate-100 font-mono focus:outline-none disabled:opacity-60"
                    disabled={sellType === 'weighted' && isSackMode}
                    required
                  />
                </div>
                
                <div>
                  <label className="text-[10px] text-slate-450 uppercase tracking-wider block font-semibold font-mono">Actual Selling Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={onboardForm.sellingPrice}
                    onChange={(e) => setOnboardForm((prev) => ({ ...prev, sellingPrice: e.target.value }))}
                    className="w-full mt-1.5 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-xs text-slate-100 font-mono focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-450 uppercase tracking-wider block font-semibold font-mono">Maximum Retail Price (MRP) (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Defaults to Selling Price if 0"
                    value={onboardForm.mrp}
                    onChange={(e) => setOnboardForm((prev) => ({ ...prev, mrp: e.target.value }))}
                    className="w-full mt-1.5 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-xs text-slate-100 font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-450 uppercase tracking-wider block font-semibold">Indian GST tax Rate (%)</label>
                  <select
                    value={onboardForm.gstRate}
                    onChange={(e) => setOnboardForm((prev) => ({ ...prev, gstRate: e.target.value }))}
                    className="w-full mt-1.5 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none font-mono"
                  >
                    <option value="0.00">0.00% tax Bracket</option>
                    <option value="5.00">5.00% tax Bracket</option>
                    <option value="12.00">12.00% tax Bracket</option>
                    <option value="18.00">18.00% tax Bracket (Default)</option>
                    <option value="28.00">28.00% tax Bracket</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 mt-4 md:col-span-2">
                  <input
                    type="checkbox"
                    id="taxInclusiveForm"
                    checked={onboardForm.taxInclusive}
                    onChange={(e) => setOnboardForm((prev) => ({ ...prev, taxInclusive: e.target.checked }))}
                    className="w-4 h-4 accent-blue-600 bg-slate-955 border border-slate-800"
                  />
                  <label htmlFor="taxInclusiveForm" className="text-xs text-slate-400 font-medium">
                    MRP price already includes Indian GST tax portion (Tax Inclusive)
                  </label>
                </div>
              </div>

              {/* Procurement & Supplier mapping */}
              <div className="bg-slate-950/40 p-4 border border-slate-850 rounded-xl space-y-4">
                <h3 className="text-xs font-semibold text-slate-300 border-b border-slate-850 pb-2">Procurement & Supplier Info (Optional)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-slate-450 uppercase tracking-wider block font-semibold font-mono flex justify-between items-center">
                      <span>Select Supplier / Vendor</span>
                      <button
                        type="button"
                        onClick={() => setNewVendorOpen(true)}
                        className="text-[9px] text-blue-400 hover:text-blue-300 font-bold"
                      >
                        + Add New Vendor
                      </button>
                    </label>
                    <select
                      value={onboardForm.supplierId}
                      onChange={(e) => setOnboardForm((prev) => ({ ...prev, supplierId: e.target.value }))}
                      className="w-full mt-1.5 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none"
                    >
                      <option value="">-- No Vendor Linked --</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.gstin || 'No GSTIN'})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-450 uppercase tracking-wider block font-semibold font-mono">Advance Payment Paid (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={onboardForm.advancePaid}
                      onChange={(e) => setOnboardForm((prev) => ({ ...prev, advancePaid: e.target.value }))}
                      className="w-full mt-1.5 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-xs text-slate-100 font-mono focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-850 flex justify-end gap-3">
                <button
                  type="submit"
                  disabled={submittingOnboard}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold font-display shadow-lg shadow-blue-600/10 transition-all disabled:opacity-50"
                >
                  <Save className="w-4.5 h-4.5" />
                  Save product SKU
                </button>
              </div>

            </form>
          </div>

          {/* Barcode Visual sticker generator preview (Right 1 col) */}
          <div className="lg:col-span-1 space-y-6">
            
            <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between h-[360px] relative overflow-hidden">
              <div className="border-b border-slate-800 pb-3 flex items-center gap-2">
                <Barcode className="w-5 h-5 text-indigo-400" />
                <h3 className="font-semibold text-slate-200 text-xs uppercase tracking-wider">Barcode Sticker Preview</h3>
              </div>

              {/* Render vector SVG preview dynamically */}
              <div className="flex-1 flex flex-col items-center justify-center p-4 bg-white rounded-xl my-4">
                {onboardForm.id && onboardForm.id.length === 13 ? (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    dangerouslySetInnerHTML={{ __html: generateEan13Svg(onboardForm.id) }}
                  />
                ) : (
                  <div className="text-center text-slate-400 text-[10px] space-y-2 p-4">
                    <Barcode className="w-12 h-12 stroke-[1] text-slate-300 mx-auto animate-pulse-subtle" />
                    <p>Enter 13-digit EAN-13 barcode sequence or auto-generate sequence to render layout preview.</p>
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={!onboardForm.id || onboardForm.id.length !== 13}
                onClick={() => {
                  alert(`Sending raw ESC/POS vector print command for barcode ${onboardForm.id} to thermal sticker printer path`);
                }}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              >
                Send Label Print job
              </button>
            </div>

            {/* Mobile Phone Scanner info card */}
            <div className="glass-panel p-5 rounded-2xl space-y-2 border border-blue-500/10">
              <h3 className="text-xs font-bold text-blue-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Wifi className="w-4 h-4" />
                <span>Wi-Fi Barcode Scanner Link</span>
              </h3>
              <p className="text-[10px] text-slate-450 leading-relaxed">
                Connect your mobile phone to the same local Wi-Fi router network, scan the barcode, or navigate to:
              </p>
              <a
                href={`http://${serverIp}:5000/scanner`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono text-blue-300 flex items-center gap-1 hover:underline select-text break-all"
              >
                <Link className="w-3.5 h-3.5 flex-shrink-0" />
                http://{serverIp}:5000/scanner
              </a>
            </div>

            {/* Quick specifications note */}
            <div className="glass-panel p-5 rounded-2xl">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-4 h-4 text-blue-400" />
                <span>Zabeel Sticker Standards</span>
              </h4>
              <p className="text-[10px] text-slate-500 leading-relaxed mt-2">
                Custom barcodes sequence starts with country/enterprise prefix <strong className="text-slate-400">99</strong>. This prevents conflict with fresh produce smart scales that broadcast EAN weigh tags using prefix <strong className="text-slate-400">22</strong>.
              </p>
            </div>

          </div>

        </div>
      )}

      {/* TAB A: DETAIL MODAL (Manual stock intake + logs timeline) */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-850 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-float">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-950/50 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-slate-100 text-sm">{selectedProduct.name} Details</h3>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">Barcode: {selectedProduct.id} | PLU: {selectedProduct.pluCode}</p>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="text-xs px-2.5 py-1 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-all font-semibold"
              >
                Close
              </button>
            </div>

            {/* Modal Body split panel */}
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800 overflow-y-auto">
              
              {/* Left pane: Manual Stock Intake Form */}
              <div className="p-6 space-y-6">
                <div className="flex items-center gap-2 border-b border-slate-800/60 pb-3">
                  <ClipboardList className="w-5 h-5 text-blue-400" />
                  <h4 className="font-semibold text-slate-200 text-xs uppercase tracking-wider">Manual Stock Inbound Intake</h4>
                </div>

                {intakeSuccess && (
                  <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xl text-[10px] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Intake transaction committed and stock logged successfully!</span>
                  </div>
                )}

                {intakeError && (
                  <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl text-[10px] flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <span>{intakeError}</span>
                  </div>
                )}

                {/* Stock info review */}
                <div className="grid grid-cols-2 gap-4 text-xs bg-slate-950/40 p-4 border border-slate-850 rounded-xl font-mono">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Current Stock</span>
                    <span className="font-bold text-slate-200 text-sm mt-0.5 block">{selectedProduct.currentStock.toFixed(3)} kg</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">MRP Selling price</span>
                    <span className="font-bold text-blue-400 text-sm mt-0.5 block">₹{selectedProduct.sellingPrice.toFixed(2)}</span>
                  </div>
                </div>

                <form onSubmit={handleStockIntakeSubmit} className="space-y-4">
                  <div>
                    <label className="text-[10px] text-slate-450 uppercase tracking-wider block font-semibold">Quantity to Add (kg/pcs)</label>
                    <input
                      type="number"
                      step="0.001"
                      placeholder="e.g. 50.000 or -5.500 for subtraction"
                      value={intakeQty}
                      onChange={(e) => setIntakeQty(e.target.value)}
                      className="w-full mt-1.5 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-xs text-slate-100 font-mono focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-450 uppercase tracking-wider block font-semibold">Source Transaction Modifier</label>
                    <select
                      value={intakeSource}
                      onChange={(e) => setIntakeSource(e.target.value as any)}
                      className="w-full mt-1.5 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none"
                    >
                      <option value="MANUAL_ENTRY">Manual Entry Adjustment</option>
                      <option value="SUPPLIER_INBOUND">Supplier Inbound Shipment</option>
                      <option value="STOCK_ADJUSTMENT">Stock Auditing Adjustment</option>
                    </select>
                  </div>

                  {intakeSource === 'SUPPLIER_INBOUND' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/20 p-3 border border-slate-900 rounded-xl mt-2">
                      <div>
                        <label className="text-[10px] text-slate-450 uppercase tracking-wider block font-semibold flex justify-between items-center">
                          <span>Select Supplier</span>
                          <button
                            type="button"
                            onClick={() => setNewVendorOpen(true)}
                            className="text-[9px] text-blue-400 hover:text-blue-300 font-bold"
                          >
                            + Add New
                          </button>
                        </label>
                        <select
                          value={intakeSupplierId}
                          onChange={(e) => setIntakeSupplierId(e.target.value)}
                          className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none"
                          required={intakeSource === 'SUPPLIER_INBOUND'}
                        >
                          <option value="">-- Choose Vendor --</option>
                          {suppliers.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-450 uppercase tracking-wider block font-semibold font-mono">Advance Paid (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={intakeAdvancePaid}
                          onChange={(e) => setIntakeAdvancePaid(e.target.value)}
                          className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 font-mono focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] text-slate-450 uppercase tracking-wider block font-semibold">Reference note / Comments</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Purchase order PO-2026-88, damaged inventory write-off, etc."
                      value={intakeNote}
                      onChange={(e) => setIntakeNote(e.target.value)}
                      className="w-full mt-1.5 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingIntake}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                  >
                    {submittingIntake ? 'Committing adjustments...' : 'Record Stock Inbound'}
                  </button>
                </form>
              </div>

              {/* Right pane: Stock Adjustment History Timeline */}
              <div className="p-6 space-y-6 flex flex-col">
                <div className="flex items-center gap-2 border-b border-slate-800/60 pb-3">
                  <History className="w-5 h-5 text-indigo-400" />
                  <h4 className="font-semibold text-slate-200 text-xs uppercase tracking-wider">Adjustment Audit Timeline</h4>
                </div>

                <div className="flex-1 overflow-y-auto max-h-[320px] space-y-3 pr-1">
                  {loadingLogs ? (
                    <p className="text-[10px] text-slate-500 text-center py-10 font-mono">Loading history logs...</p>
                  ) : stockLogs.length === 0 ? (
                    <p className="text-[10px] text-slate-550 text-center py-10 font-mono">No prior adjustment logs registered.</p>
                  ) : (
                    stockLogs.map((log) => {
                      const isAddition = log.quantityAdded > 0;
                      return (
                        <div
                          key={log.id}
                          className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl text-[10px] space-y-1.5 relative overflow-hidden"
                        >
                          <div className="flex justify-between items-center">
                            <span
                              className={`px-1.5 py-0.5 rounded font-bold ${
                                log.sourceType === 'SUPPLIER_INBOUND'
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : 'bg-indigo-500/10 text-indigo-400'
                              }`}
                            >
                              {log.sourceType}
                            </span>
                            <span className="text-slate-500 font-mono">
                              {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          
                          <div className="flex justify-between items-center font-mono">
                            <span className="text-slate-400">
                              Adjusted: <strong className={isAddition ? 'text-emerald-400' : 'text-red-400'}>
                                {isAddition ? '+' : ''}{log.quantityAdded.toFixed(3)} kg
                              </strong>
                            </span>
                            <span className="text-slate-500">
                              ({log.previousStock.toFixed(3)} &rarr; {log.newStock.toFixed(3)})
                            </span>
                          </div>

                          {log.referenceNote && (
                            <p className="text-slate-500 italic bg-slate-950 p-1.5 rounded border border-slate-900/60 mt-1 select-text">
                              Note: "{log.referenceNote}"
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Bulk Upload Spreadsheet Modal */}
      {bulkImportOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-4 bg-slate-950/50 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-semibold text-slate-200 text-sm">Spreadsheet Bulk Importer (Excel JSON format)</h3>
              <button onClick={() => setBulkImportOpen(false)} className="text-slate-400 hover:text-slate-100 text-xs">Close</button>
            </div>
            <div className="p-6 space-y-4">
              <textarea
                rows={8}
                placeholder="[ { 'id': '890...', ... } ]"
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg p-3 text-[10px] text-slate-100 font-mono focus:outline-none"
              />
              <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
                <button
                  onClick={() => setBulkImportOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkImportSubmit}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white"
                >
                  Commit Import
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Inline Add New Supplier/Vendor Modal */}
      {newVendorOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in">
            <form onSubmit={handleCreateVendorInline}>
              <div className="px-6 py-4 bg-slate-950/50 border-b border-slate-800 flex justify-between items-center">
                <h3 className="font-semibold text-slate-200 text-sm">Register New Supplier Vendor</h3>
                <button
                  type="button"
                  onClick={() => setNewVendorOpen(false)}
                  className="text-slate-400 hover:text-slate-100 text-xs"
                >
                  Close
                </button>
              </div>
              <div className="p-6 space-y-4">
                {vendorError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-300 rounded-lg text-xs">
                    {vendorError}
                  </div>
                )}
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Vendor Name</label>
                  <input
                    id="inline-vendor-name-input"
                    type="text"
                    required
                    placeholder="e.g. A-1 wholesales Ltd"
                    value={newVendorName}
                    onChange={(e) => setNewVendorName(e.target.value)}
                    className="w-full mt-1 bg-slate-955 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Phone Number</label>
                  <input
                    id="inline-vendor-phone-input"
                    type="text"
                    placeholder="e.g. +91 9876543210"
                    value={newVendorPhone}
                    onChange={(e) => setNewVendorPhone(e.target.value)}
                    className="w-full mt-1 bg-slate-955 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-450 uppercase tracking-wider block font-semibold font-mono">GSTIN Identification</label>
                  <input
                    id="inline-vendor-gstin-input"
                    type="text"
                    placeholder="e.g. 29ABCDE1234F1Z5"
                    value={newVendorGstin}
                    onChange={(e) => setNewVendorGstin(e.target.value)}
                    className="w-full mt-1 bg-slate-955 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none font-mono"
                  />
                </div>
                <div className="flex justify-end gap-3 border-t border-slate-800 pt-4 mt-2">
                  <button
                    type="button"
                    onClick={() => setNewVendorOpen(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={vendorSubmitting}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
                  >
                    {vendorSubmitting ? 'Creating...' : 'Register Vendor'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
