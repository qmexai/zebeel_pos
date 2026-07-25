import React, { useEffect, useState } from 'react';
import { Calendar, Download, RefreshCw, FileText, CheckCircle } from 'lucide-react';

interface InvoiceReportItem {
  invoiceId: string;
  timestamp: string;
  customerPhone: string | null;
  customerGstin: string | null;
  subtotal: number;
  totalCgst: number;
  totalSgst: number;
  discount: number;
  grandTotal: number;
  paymentMode: string;
}

interface GstReportData {
  b2b: InvoiceReportItem[];
  b2c: InvoiceReportItem[];
  totalB2bCount: number;
  totalB2cCount: number;
}

interface GstHubProps {
  apiBase: string;
}

export const GstHub: React.FC<GstHubProps> = ({ apiBase }) => {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [report, setReport] = useState<GstReportData>({
    b2b: [],
    b2c: [],
    totalB2bCount: 0,
    totalB2cCount: 0,
  });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchGstReport = async () => {
    setLoading(true);
    try {
      let url = `${apiBase}/api/gst/report`;
      if (start && end) {
        url += `?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGstReport();
  }, [apiBase]);

  // Download GSTR-1 spreadsheet matching offline JSON template
  const triggerGstr1Export = () => {
    setExporting(true);
    setTimeout(() => {
      // Group B2B invoices by Customer GSTIN
      const b2bMap: Record<string, any[]> = {};
      report.b2b.forEach((inv) => {
        const gstin = inv.customerGstin || '';
        if (!gstin) return;
        if (!b2bMap[gstin]) {
          b2bMap[gstin] = [];
        }
        
        // Determine place of supply (pos) from first 2 digits of GSTIN, fallback to default
        const pos = gstin.substring(0, 2) || "29"; 
        
        // Format invoice timestamp to DD-MM-YYYY
        const dateObj = new Date(inv.timestamp);
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        const formattedDate = `${day}-${month}-${year}`;

        b2bMap[gstin].push({
          inum: inv.invoiceId,
          idt: formattedDate,
          val: inv.grandTotal,
          pos: pos,
          rchrg: "N",
          inv_typ: "R",
          itms: [
            {
              num: 1,
              itm_det: {
                rt: 18.0, // Standard tax bracket representation
                txval: inv.subtotal,
                camt: inv.totalCgst,
                samt: inv.totalSgst,
                iamt: 0.0
              }
            }
          ]
        });
      });

      const b2bFormatted = Object.keys(b2bMap).map((gstin) => ({
        ctin: gstin,
        inv: b2bMap[gstin]
      }));

      // Group B2C invoices by Rate and Place of Supply (default to "29" for local state)
      const b2csMap: Record<string, { rt: number; txval: number; camt: number; samt: number; pos: string }> = {};
      
      report.b2c.forEach((inv) => {
        const pos = "29"; // Default state code
        const rate = inv.subtotal > 0 ? Math.round(((inv.totalCgst + inv.totalSgst) / inv.subtotal) * 100) : 18;
        const key = `${pos}_${rate}`;

        if (!b2csMap[key]) {
          b2csMap[key] = {
            sply_ty: "INTRA",
            rt: rate,
            txval: 0,
            camt: 0,
            samt: 0,
            pos: pos
          };
        }
        b2csMap[key].txval += inv.subtotal;
        b2csMap[key].camt += inv.totalCgst;
        b2csMap[key].samt += inv.totalSgst;
      });

      const b2csFormatted = Object.values(b2csMap).map((item) => ({
        sply_ty: item.sply_ty,
        rt: item.rt,
        txval: Number(item.txval.toFixed(2)),
        camt: Number(item.camt.toFixed(2)),
        samt: Number(item.samt.toFixed(2)),
        pos: item.pos
      }));

      // Official GSTR-1 structured root object
      const gstr1Payload = {
        gstin: "29ABCDE1234F1Z5", // Zabeel POS default GSTIN
        fp: "072026", // Tax period MMYYYY (July 2026)
        version: "1.0",
        b2b: b2bFormatted,
        b2cs: b2csFormatted
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(gstr1Payload, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `GSTR1_Report_${start || 'all'}_to_${end || 'today'}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setExporting(false);
    }, 1000);
  };

  // Compute aggregate sums
  const calculateTotalTaxes = (items: InvoiceReportItem[]) => {
    return items.reduce((acc, curr) => acc + curr.totalCgst + curr.totalSgst, 0);
  };

  const calculateTotalRevenue = (items: InvoiceReportItem[]) => {
    return items.reduce((acc, curr) => acc + curr.grandTotal, 0);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-white">
            GST Compliance Hub
          </h1>
          <p className="text-slate-400 mt-1">Audit GST transactions and generate GSTR-1 compliant filings offline</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={triggerGstr1Export}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all active:scale-95"
          >
            <Download className="w-4 h-4" />
            Export GSTR-1 (JSON)
          </button>
          <button
            onClick={fetchGstReport}
            className="p-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 rounded-xl"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Date Filter Panel */}
      <div className="glass-panel p-6 rounded-2xl flex flex-wrap gap-4 items-end">
        <div>
          <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Start Period Date</label>
          <div className="relative mt-1">
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none font-mono"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">End Period Date</label>
          <div className="relative mt-1">
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none font-mono"
            />
          </div>
        </div>
        <button
          onClick={fetchGstReport}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all"
        >
          Apply Filters
        </button>
      </div>

      {/* Report Split Visuals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* B2B Segment */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between min-h-[350px]">
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
              <h3 className="font-semibold text-slate-200 text-sm">GSTR-1 B2B (Corporate Sales)</h3>
              <span className="px-2 py-0.5 text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full font-mono">
                {report.totalB2bCount} Entries
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block">B2B TAX REVENUE</span>
                <span className="text-sm font-bold text-slate-200 font-mono">
                  ₹{calculateTotalRevenue(report.b2b).toFixed(2)}
                </span>
              </div>
              <div className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block">B2B COMBINED GST</span>
                <span className="text-sm font-bold text-slate-200 font-mono">
                  ₹{calculateTotalTaxes(report.b2b).toFixed(2)}
                </span>
              </div>
            </div>

            {/* List table */}
            <div className="max-h-52 overflow-y-auto pr-1">
              {report.b2b.length === 0 ? (
                <p className="text-[10px] text-slate-500 text-center py-10">No B2B invoices in this period range.</p>
              ) : (
                <table className="w-full text-[10px] text-left">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-900">
                      <th className="py-1">Inv ID</th>
                      <th className="py-1">Customer GSTIN</th>
                      <th className="py-1 text-right">Tax GST (₹)</th>
                      <th className="py-1 text-right">Grand Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/40 text-slate-400">
                    {report.b2b.map((inv) => (
                      <tr key={inv.invoiceId} className="hover:text-slate-200">
                        <td className="py-2 font-mono">{inv.invoiceId}</td>
                        <td className="py-2 font-mono">{inv.customerGstin}</td>
                        <td className="py-2 text-right font-mono">₹{(inv.totalCgst + inv.totalSgst).toFixed(2)}</td>
                        <td className="py-2 text-right font-mono font-semibold text-blue-400">₹{inv.grandTotal.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* B2C Segment */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between min-h-[350px]">
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
              <h3 className="font-semibold text-slate-200 text-sm">GSTR-1 B2CS (Retail Consumer Sales)</h3>
              <span className="px-2 py-0.5 text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full font-mono">
                {report.totalB2cCount} Entries
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block">B2C TAX REVENUE</span>
                <span className="text-sm font-bold text-slate-200 font-mono">
                  ₹{calculateTotalRevenue(report.b2c).toFixed(2)}
                </span>
              </div>
              <div className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block">B2C COMBINED GST</span>
                <span className="text-sm font-bold text-slate-200 font-mono">
                  ₹{calculateTotalTaxes(report.b2c).toFixed(2)}
                </span>
              </div>
            </div>

            {/* List table */}
            <div className="max-h-52 overflow-y-auto pr-1">
              {report.b2c.length === 0 ? (
                <p className="text-[10px] text-slate-500 text-center py-10">No retail consumers B2C invoices in this period range.</p>
              ) : (
                <table className="w-full text-[10px] text-left">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-900">
                      <th className="py-1">Inv ID</th>
                      <th className="py-1">Date</th>
                      <th className="py-1 text-right">Tax GST (₹)</th>
                      <th className="py-1 text-right">Grand Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/40 text-slate-400">
                    {report.b2c.map((inv) => (
                      <tr key={inv.invoiceId} className="hover:text-slate-200">
                        <td className="py-2 font-mono">{inv.invoiceId}</td>
                        <td className="py-2 font-mono">{new Date(inv.timestamp).toLocaleDateString()}</td>
                        <td className="py-2 text-right font-mono">₹{(inv.totalCgst + inv.totalSgst).toFixed(2)}</td>
                        <td className="py-2 text-right font-mono font-semibold text-blue-400">₹{inv.grandTotal.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
