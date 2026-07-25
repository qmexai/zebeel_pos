import React, { useState, useEffect, useRef } from 'react';
import { ShoppingCart, Trash2, Plus, Minus, Search, Layers, Clipboard, AlertCircle, Printer, Link, Wifi } from 'lucide-react';
import { calculateGstDetails } from '../../../shared/gstMath';
import { parseScaleBarcode } from '../../../shared/scaleParser';

interface Product {
  id: string; // Barcode
  pluCode: string;
  name: string;
  hsnCode: string;
  currentStock: number;
  minThreshold: number;
  costPrice: number;
  sellingPrice: number; // Sale Price
  mrp: number; // Maximum Retail Price (MRP)
  packageWeight: number | null;
  packageUnit: string | null;
  gstRate: number;
  taxInclusive: boolean;
}

interface CartItem {
  product: Product;
  quantity: number;
  baseTaxableValue: number;
  combinedGst: number;
  cgstAmount: number;
  sgstAmount: number;
  rowTotal: number;
}

interface FrozenCart {
  id: string;
  items: CartItem[];
  customerPhone: string;
  customerGstin: string;
  discount: number;
  timestamp: string;
}

interface POSBillingProps {
  apiBase: string;
}

export const POSBilling: React.FC<POSBillingProps> = ({ apiBase }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'CARD' | 'UPI'>('CASH');

  // Network IP state
  const [serverIp, setServerIp] = useState('localhost');
  const [scalePrefix, setScalePrefix] = useState('22');

  // Carts freeze/recall storage
  const [frozenCarts, setFrozenCarts] = useState<FrozenCart[]>([]);
  
  // UI states
  const [checkoutSuccess, setCheckoutSuccess] = useState<any | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // Refs for focusing & printing
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Focus barcode input on mount and keep it focused
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  // Fetch local server IP and settings on load
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
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${apiBase}/api/settings`);
        if (res.ok) {
          const json = await res.json();
          if (json.scalePrefix) {
            setScalePrefix(json.scalePrefix);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchIp();
    fetchSettings();
  }, [apiBase]);

  // Handle direct barcode processing (for scanned/typed codes)
  const processBarcodeValue = async (code: string) => {
    setErrorMessage(null);
    const cleanCode = code.trim();
    if (!cleanCode) return;

    // Check weigh scale tag starting with custom scalePrefix setting (defaults to "22")
    const parsedScale = parseScaleBarcode(cleanCode, scalePrefix);
    if (parsedScale) {
      try {
        const res = await fetch(`${apiBase}/api/products/${parsedScale.pluCode}`);
        if (!res.ok) {
          throw new Error(`Scale product PLU ${parsedScale.pluCode} not found in master database.`);
        }
        const product: Product = await res.json();
        addProductToCart(product, parsedScale.weightKg);
        return;
      } catch (err: any) {
        setErrorMessage(err.message || 'Scale tag lookup failed');
        return;
      }
    }

    // Normal barcode lookup
    try {
      const res = await fetch(`${apiBase}/api/products/${cleanCode}`);
      if (!res.ok) {
        throw new Error(`Product barcode "${cleanCode}" not found.`);
      }
      const product: Product = await res.json();
      addProductToCart(product, 1);
    } catch (err: any) {
      setErrorMessage(err.message || 'Product lookup failed');
    }
  };

  // Poll Wi-Fi scan-events from mobile phone camera scanner
  useEffect(() => {
    const pollMobileScans = async () => {
      try {
        const res = await fetch(`${apiBase}/api/scan-event`);
        if (res.ok) {
          const data = await res.json();
          if (data.barcodes && data.barcodes.length > 0) {
            for (const code of data.barcodes) {
              await processBarcodeValue(code);
            }
          }
        }
      } catch (err) {
        console.error('Mobile scanner polling failed', err);
      }
    };

    const interval = setInterval(pollMobileScans, 1500); // poll every 1.5s
    return () => clearInterval(interval);
  }, [apiBase, cart]);

  // Global keydown listeners for F4, F5, F11, F12
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      if (e.key === 'F12') {
        e.preventDefault();
        triggerCheckout('CASH');
      }
      if (e.key === 'F11') {
        e.preventDefault();
        triggerCheckout('UPI');
      }
      if (e.key === 'F4') {
        e.preventDefault();
        freezeCart();
      }
      if (e.key === 'F5') {
        e.preventDefault();
        recallFirstCart();
      }
    };

    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [cart, customerPhone, customerGstin, discount]);

  // Handle product searches
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`${apiBase}/api/products/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, apiBase]);

  // Recalculate totals
  const subtotal = cart.reduce((acc, item) => acc + item.baseTaxableValue, 0);
  const totalCgst = cart.reduce((acc, item) => acc + item.cgstAmount, 0);
  const totalSgst = cart.reduce((acc, item) => acc + item.sgstAmount, 0);
  const grossTotal = subtotal + totalCgst + totalSgst;
  const grandTotal = Math.max(0, Math.round(grossTotal - discount));

  // Calculate customer savings: (MRP - Selling Price) * Qty + Invoice Discount
  const itemsSavings = cart.reduce((acc, item) => {
    const mrp = Number(item.product.mrp || item.product.sellingPrice || 0);
    const sellingPrice = Number(item.product.sellingPrice || 0);
    const diff = mrp - sellingPrice;
    return acc + (diff > 0 ? diff * item.quantity : 0);
  }, 0);
  const totalSavings = itemsSavings + discount;

  // Add Product to Cart
  const addProductToCart = (product: Product, quantity: number = 1) => {
    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.product.id === product.id);
      let updatedCart = [...prevCart];

      if (existingIndex > -1) {
        const newQty = updatedCart[existingIndex].quantity + quantity;
        const gstResult = calculateGstDetails(
          product.sellingPrice,
          product.gstRate,
          newQty,
          product.taxInclusive
        );
        updatedCart[existingIndex] = {
          product,
          quantity: newQty,
          ...gstResult,
        };
      } else {
        const gstResult = calculateGstDetails(
          product.sellingPrice,
          product.gstRate,
          quantity,
          product.taxInclusive
        );
        updatedCart.push({
          product,
          quantity,
          ...gstResult,
        });
      }
      return updatedCart;
    });

    setBarcodeInput('');
    barcodeInputRef.current?.focus();
  };

  // Process Barcode scan / submission
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processBarcodeValue(barcodeInput);
  };

  // Modify Cart Item quantity
  const updateQuantity = (productId: string, change: number) => {
    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = Math.max(0, item.quantity + change);
            if (newQty === 0) return null;
            const gstResult = calculateGstDetails(
              item.product.sellingPrice,
              item.product.gstRate,
              newQty,
              item.product.taxInclusive
            );
            return { ...item, quantity: newQty, ...gstResult };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  // Remove Item
  const removeItem = (productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.product.id !== productId));
  };

  // Clear cart
  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setCustomerPhone('');
    setCustomerGstin('');
    setErrorMessage(null);
  };

  // Checkout
  const triggerCheckout = async (mode: 'CASH' | 'CARD' | 'UPI') => {
    setErrorMessage(null);
    setCheckoutSuccess(null);

    if (cart.length === 0) {
      setErrorMessage('Cannot checkout empty cart');
      return;
    }

    const payload = {
      customerPhone: customerPhone || null,
      customerGstin: customerGstin || null,
      discount,
      paymentMode: mode,
      items: cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
      })),
    };

    try {
      const res = await fetch(`${apiBase}/api/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to complete transaction');
      }

      setCheckoutSuccess(json);
      setShowPrintModal(true); // Open printable invoice preview
      clearCart();
    } catch (err: any) {
      setErrorMessage(err.message || 'Checkout failed');
    }
  };

  // Freeze cart
  const freezeCart = () => {
    if (cart.length === 0) {
      setErrorMessage('Cannot freeze an empty cart');
      return;
    }
    const newFrozenCart: FrozenCart = {
      id: `CART-${Date.now().toString().slice(-6)}`,
      items: [...cart],
      customerPhone,
      customerGstin,
      discount,
      timestamp: new Date().toLocaleTimeString(),
    };
    setFrozenCarts((prev) => [newFrozenCart, ...prev]);
    clearCart();
    setErrorMessage('Current cart frozen and shelved');
  };

  // Recall a specific frozen cart
  const recallCart = (frozen: FrozenCart) => {
    setCart(frozen.items);
    setCustomerPhone(frozen.customerPhone);
    setCustomerGstin(frozen.customerGstin);
    setDiscount(frozen.discount);
    setFrozenCarts((prev) => prev.filter((c) => c.id !== frozen.id));
    setErrorMessage(`Recalled suspended ${frozen.id}`);
  };

  // Shortcut F5 recall first cart
  const recallFirstCart = () => {
    if (frozenCarts.length > 0) {
      recallCart(frozenCarts[0]);
    } else {
      setErrorMessage('No frozen carts to recall');
    }
  };

  // Handle PDF / printer trigger
  const handlePrintReceipt = () => {
    const printContent = printAreaRef.current?.innerHTML;
    if (!printContent) return;

    // Create iframe print window to avoid printing full React UI
    const iframe = document.createElement('iframe');
    iframe.setAttribute('style', 'position:absolute;width:0px;height:0px;left:-500px;top:-500px;');
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.write(`
        <html>
          <head>
            <title>Tax Invoice</title>
            <style>
              body {
                font-family: monospace;
                color: black;
                margin: 0;
                padding: 10px;
                font-size: 11px;
                width: 80mm; /* standard POS receipt width */
              }
              .center { text-align: center; }
              .right { text-align: right; }
              .bold { font-weight: bold; }
              .divider { border-top: 1px dashed black; margin: 6px 0; }
              table { width: 100%; border-collapse: collapse; margin-top: 5px; }
              td, th { padding: 2px 0; font-size: 10px; }
              .totals-row td { font-weight: bold; }
            </style>
          </head>
          <body>
            ${printContent}
          </body>
        </html>
      `);
      doc.close();
      
      // Delay slightly to load content
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        document.body.removeChild(iframe);
      }, 500);
    }
  };

  const scannerLink = `http://${serverIp}:5000/scanner`;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 h-[calc(100vh-140px)] overflow-hidden">
      
      {/* Left side: Cart and barcode scan (3 cols) */}
      <div className="xl:col-span-3 flex flex-col justify-between glass-panel rounded-2xl overflow-hidden p-6 space-y-4">
        
        {/* Top bar: Barcode listener input */}
        <div className="flex items-center gap-4">
          <form onSubmit={handleBarcodeSubmit} className="flex-1 relative">
            <input
              ref={barcodeInputRef}
              type="text"
              placeholder="Scan Barcode / Smart Scale EAN... (Press ENTER)"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-4 py-3 pl-11 text-slate-100 font-mono tracking-wider focus:outline-none"
            />
            <div className="absolute left-4 top-3.5 text-slate-500">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <button type="submit" className="hidden" />
          </form>

          {/* Quick search input */}
          <div className="relative w-64">
            <input
              type="text"
              placeholder="Search by Product Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-4 py-3 pl-10 text-xs text-slate-200 focus:outline-none"
            />
            <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />

            {/* Quick search results dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute right-0 top-14 w-80 max-h-60 overflow-y-auto bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 p-2 space-y-1">
                {searchResults.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => {
                      addProductToCart(product, 1);
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="w-full text-left p-2 rounded-lg hover:bg-slate-800 transition-all flex justify-between items-center text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-200">{product.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">Barcode: {product.id}</p>
                    </div>
                    <span className="text-blue-400 font-bold">₹{product.sellingPrice}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Error feedback messages */}
        {errorMessage && (
          <div className="flex items-center gap-2 p-3 rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Cart items table */}
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12">
              <ShoppingCart className="w-16 h-16 stroke-[1] mb-3 text-slate-700 animate-pulse-subtle" />
              <p className="text-sm font-semibold">No items scanned yet</p>
              <p className="text-xs text-slate-600 mt-1">Scan camera barcode, scan EAN-13, or search above</p>
            </div>
          ) : (
            <div className="w-full font-mono">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800">
                    <th className="py-2 font-semibold">S.No</th>
                    <th className="py-2 font-semibold">Product Name</th>
                    <th className="py-2 font-semibold text-right">Qty</th>
                    <th className="py-2 font-semibold text-right">MRP (₹)</th>
                    <th className="py-2 font-semibold text-right">GST %</th>
                    <th className="py-2 font-semibold text-right">Tax (CGST/SGST)</th>
                    <th className="py-2 font-semibold text-right">Total (₹)</th>
                    <th className="py-2 font-semibold text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900">
                  {cart.map((item, idx) => (
                    <tr key={item.product.id} className="table-row-hover text-slate-350">
                      <td className="py-3 font-mono text-slate-500">{idx + 1}</td>
                      <td className="py-3 font-semibold text-slate-200">
                        {item.product.name}
                        <span className="block text-[10px] text-slate-550 font-mono">HSN: {item.product.hsnCode} | Barcode: {item.product.id}</span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                          <button
                            onClick={() => updateQuantity(item.product.id, -1)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-mono px-2 font-bold min-w-[30px] text-center">
                            {item.quantity.toFixed(3)}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.product.id, 1)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 text-right font-mono">₹{item.product.sellingPrice}</td>
                      <td className="py-3 text-right font-mono">{item.product.gstRate}%</td>
                      <td className="py-3 text-right font-mono text-slate-400">
                        ₹{(item.cgstAmount).toFixed(2)} / ₹{(item.sgstAmount).toFixed(2)}
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-blue-400">₹{item.rowTotal}</td>
                      <td className="py-3 text-center">
                        <button
                          onClick={() => removeItem(item.product.id)}
                          className="p-1.5 rounded bg-red-950/40 text-red-400 hover:bg-red-900/60 border border-red-500/10 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Right side: Sidebar billing configuration (1 col) */}
      <div className="xl:col-span-1 flex flex-col justify-between glass-panel rounded-2xl p-6 space-y-4 overflow-y-auto">
        
        {/* Mobile Phone Scanner info card */}
        <div className="p-4 bg-blue-600/10 border border-blue-500/20 rounded-xl space-y-2">
          <h3 className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
            <Wifi className="w-4 h-4" />
            <span>Wi-Fi Barcode Scanner Link</span>
          </h3>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Open this URL on your phone's browser connected to the same Wi-Fi to use its camera as a barcode scanner:
          </p>
          <a
            href={scannerLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono text-blue-300 flex items-center gap-1 hover:underline select-text break-all"
          >
            <Link className="w-3 h-3 flex-shrink-0" />
            {scannerLink}
          </a>
        </div>

        {/* Customer mapping */}
        <div className="space-y-4">
          <h3 className="text-xs font-semibold text-slate-350 border-b border-slate-800 pb-2">Customer Mapping</h3>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-slate-450 block font-medium">Customer Phone</label>
              <input
                type="text"
                placeholder="10 digit phone number"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full mt-1 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-450 block font-medium">Corporate GSTIN (B2B)</label>
              <input
                type="text"
                placeholder="15-character GSTIN"
                value={customerGstin}
                onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                className="w-full mt-1 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Shelved/Frozen Carts Recall */}
        {frozenCarts.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-amber-500 flex items-center gap-1.5">
              <Layers className="w-4 h-4" />
              <span>Suspended Carts (F5)</span>
            </h3>
            <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
              {frozenCarts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => recallCart(c)}
                  className="w-full text-left p-2 rounded-lg bg-amber-950/20 hover:bg-amber-950/40 border border-amber-500/10 flex justify-between items-center text-[10px] text-amber-300 font-mono transition-all"
                >
                  <span>{c.id} ({c.items.length} items)</span>
                  <span>{c.timestamp}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bill calculation details */}
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Pre-Tax Subtotal</span>
              <span className="font-mono">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Central GST (CGST)</span>
              <span className="font-mono">₹{totalCgst.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>State GST (SGST)</span>
              <span className="font-mono">₹{totalSgst.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between items-center text-slate-400 pt-1">
              <span>Flat Discount (₹)</span>
              <input
                id="checkout-discount-input"
                type="number"
                value={discount || ''}
                onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-20 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded px-1.5 py-0.5 text-right text-xs font-mono text-slate-200 focus:outline-none"
              />
            </div>

            <div className="flex justify-between text-slate-200 border-t border-slate-800 pt-3 text-sm font-bold">
              <span>Grand Total</span>
              <span className="font-mono text-blue-400 text-lg">₹{grandTotal.toFixed(2)}</span>
            </div>

            {totalSavings > 0 && (
              <div id="checkout-savings-badge" className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-xl p-2.5 mt-3 text-center text-xs font-bold flex items-center justify-center gap-1.5 animate-pulse">
                <span>🎉 You saved ₹{totalSavings.toFixed(2)} on this bill!</span>
              </div>
            )}
          </div>
        </div>

        {/* Checkout settlement buttons */}
        <div className="space-y-3 pt-2">
          <button
            onClick={() => triggerCheckout('CASH')}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white rounded-xl text-xs font-bold font-display shadow-lg shadow-blue-600/10 flex justify-between px-4 transition-all"
          >
            <span>SETTLE CASH</span>
            <span className="bg-blue-700/60 font-mono text-[9px] px-1.5 py-0.5 rounded tracking-wide">F12</span>
          </button>
          
          <button
            onClick={() => triggerCheckout('UPI')}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] border border-slate-700 text-slate-200 rounded-xl text-xs font-bold font-display flex justify-between px-4 transition-all"
          >
            <span>SETTLE CARD / UPI</span>
            <span className="bg-slate-700 font-mono text-[9px] px-1.5 py-0.5 rounded tracking-wide">F11</span>
          </button>

          <button
            onClick={freezeCart}
            className="w-full py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 rounded-xl text-[10px] font-bold tracking-wider flex justify-between px-4 transition-all hover:text-white"
          >
            <span>SUSPEND CART</span>
            <span className="font-mono text-[9px] tracking-wide">F4</span>
          </button>
        </div>
      </div>

      {/* PRINTABLE INVOICE PREVIEW MODAL */}
      {showPrintModal && checkoutSuccess && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-950/50 border-b border-slate-850 flex justify-between items-center">
              <h3 className="font-semibold text-slate-200 text-xs uppercase tracking-wider">Print Preview / Download</h3>
              <button
                onClick={() => {
                  setShowPrintModal(false);
                  setCheckoutSuccess(null);
                }}
                className="text-xs px-2.5 py-1 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 hover:text-white transition-all"
              >
                Close
              </button>
            </div>

            {/* Scrollable Receipt Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-950 flex justify-center">
              
              {/* Actual Printable POS receipt layout (cloned into printing frame) */}
              <div
                ref={printAreaRef}
                className="bg-white text-black p-4 rounded shadow-md font-mono text-[10px] leading-tight w-[72mm] select-text"
              >
                <div className="center bold" style={{ fontSize: '11px' }}>ZABEEL SUPERMARKET</div>
                <div className="center">Static IP POS Node-01</div>
                <div className="center">Closed Enclosed Router Link</div>
                <div className="divider"></div>
                
                <div>INVOICE: {checkoutSuccess.id}</div>
                <div>DATE: {new Date(checkoutSuccess.timestamp).toLocaleString()}</div>
                {checkoutSuccess.customerPhone && <div>PHONE: {checkoutSuccess.customerPhone}</div>}
                {checkoutSuccess.customerGstin && <div>GSTIN: {checkoutSuccess.customerGstin}</div>}
                
                <div className="divider"></div>
                
                <table>
                  <thead>
                    <tr style={{ borderBottom: '1px solid black' }}>
                      <th align="left">ITEMS</th>
                      <th align="right">QTY</th>
                      <th align="right">MRP</th>
                      <th align="right">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkoutSuccess.items.map((item: any, i: number) => (
                      <React.Fragment key={i}>
                        <tr>
                          <td colSpan={4} className="bold">{item.product.name}</td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #f1f1f1' }}>
                          <td style={{ fontSize: '8px', color: '#555' }}>HSN: {item.product.hsnCode}</td>
                          <td align="right">{Number(item.quantity).toFixed(3)}</td>
                          <td align="right">₹{Number(item.rate).toFixed(2)}</td>
                          <td align="right" className="bold">₹{Number(item.rowTotal).toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td colSpan={4} style={{ fontSize: '8px', color: '#555', paddingLeft: '8px' }}>
                            CGST ({Number(item.product.gstRate)/2}%): ₹{Number(item.cgstAmount).toFixed(2)} | 
                            SGST ({Number(item.product.gstRate)/2}%): ₹{Number(item.sgstAmount).toFixed(2)}
                          </td>
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>

                <div className="divider"></div>

                <table className="totals-row">
                  <tbody>
                    <tr>
                      <td colSpan={3}>Taxable Subtotal:</td>
                      <td align="right">₹{Number(checkoutSuccess.subtotal).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td colSpan={3}>CGST Total Pool:</td>
                      <td align="right">₹{Number(checkoutSuccess.totalCgst).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td colSpan={3}>SGST Total Pool:</td>
                      <td align="right">₹{Number(checkoutSuccess.totalSgst).toFixed(2)}</td>
                    </tr>
                    {Number(checkoutSuccess.discount) > 0 && (
                      <tr>
                        <td colSpan={3}>Cash Discount Owed:</td>
                        <td align="right">-₹{Number(checkoutSuccess.discount).toFixed(2)}</td>
                      </tr>
                    )}
                    {checkoutSuccess.roundOff !== undefined && Number(checkoutSuccess.roundOff) !== 0 && (
                      <tr>
                        <td colSpan={3}>Rounding Adjustment:</td>
                        <td align="right">{Number(checkoutSuccess.roundOff) > 0 ? '+' : ''}₹{Number(checkoutSuccess.roundOff).toFixed(2)}</td>
                      </tr>
                    )}
                    <tr style={{ fontSize: '11px' }}>
                      <td colSpan={3} className="bold">ROUNDED GRAND TOTAL:</td>
                      <td align="right" className="bold">₹{Number(checkoutSuccess.grandTotal).toFixed(2)}</td>
                    </tr>
                    {(() => {
                      const invoiceSavings = checkoutSuccess.items.reduce((acc: number, item: any) => {
                        const mrp = Number(item.product?.mrp || item.product?.sellingPrice || item.rate || 0);
                        const rate = Number(item.rate || 0);
                        const diff = mrp - rate;
                        return acc + (diff > 0 ? diff * item.quantity : 0);
                      }, 0) + Number(checkoutSuccess.discount || 0);

                      return invoiceSavings > 0 ? (
                        <tr style={{ fontSize: '9px', fontWeight: 'bold' }}>
                          <td colSpan={3}>✨ YOU SAVED ON THIS BILL:</td>
                          <td align="right">₹{invoiceSavings.toFixed(2)}</td>
                        </tr>
                      ) : null;
                    })()}
                  </tbody>
                </table>

                <div className="divider"></div>
                <div className="center">MODE: {checkoutSuccess.paymentMode}</div>
                <div className="center bold" style={{ marginTop: '5px' }}>THANK YOU! VISIT AGAIN</div>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-900 border-t border-slate-850 flex gap-2">
              <button
                onClick={handlePrintReceipt}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold font-display shadow-lg shadow-blue-600/10 transition-all flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print / Save PDF
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
