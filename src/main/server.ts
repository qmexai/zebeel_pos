import express from 'express';
import cors from 'cors';
import { getPrismaClient } from './db';
import { calculateGstDetails } from '../shared/gstMath';
import { parseScaleBarcode } from '../shared/scaleParser';
import { calculateEan13Checksum } from '../shared/barcodeGen';
import path from 'path';
import fs from 'fs';
import os from 'os';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Get local private network IP address for wireless scanner setup
export function getLocalIpAddress(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (iface) {
      for (const alias of iface) {
        if (alias.family === 'IPv4' && !alias.internal) {
          return alias.address;
        }
      }
    }
  }
  return '127.0.0.1';
}

// Mobile scanner scan events queue
let scanQueue: string[] = [];

// Settings Path
const SETTINGS_FILE = path.join(process.cwd(), 'settings.json');

// Default Settings
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

const defaultSettings: AppSettings = {
  databaseUrl: 'postgresql://postgres:postgres@localhost:5432/zabeel_pos',
  serverIp: '127.0.0.1',
  serverPort: 5000,
  isServerMode: true,
  scaleIp: '192.168.1.100',
  scalePrefix: '22',
  receiptWidth: '80mm',
  printerDriverPath: '',
};

function loadSettings(): AppSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      return { ...defaultSettings, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('Error loading settings:', err);
  }
  return defaultSettings;
}

function saveSettings(settings: AppSettings) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving settings:', err);
  }
}

// Global active settings
let activeSettings = loadSettings();
let prisma = getPrismaClient(activeSettings.databaseUrl);

// Helper to reconnect Prisma
function reinitPrisma(newDbUrl: string) {
  try {
    prisma = getPrismaClient(newDbUrl, true);
  } catch (err) {
    console.error('Error re-initializing Prisma Client:', err);
  }
}

// Convert Prisma decimal fields to standard floats for frontend serialization
function serializePrismaObj(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(serializePrismaObj);
  }
  if (typeof obj === 'object') {
    const newObj: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val && typeof val === 'object' && (val.constructor.name === 'Decimal' || ('d' in val && 'e' in val && 's' in val))) {
        newObj[key] = Number(val.toString());
      } else if (val instanceof Date) {
        newObj[key] = val.toISOString();
      } else {
        newObj[key] = serializePrismaObj(val);
      }
    }
    if (newObj && newObj.sellingPrice !== undefined && (!newObj.mrp || Number(newObj.mrp) === 0)) {
      newObj.mrp = newObj.sellingPrice;
    }
    return newObj;
  }
  return obj;
}

// API Routes

// 1. Status / Connectivity
app.get('/api/status', async (req, res) => {
  try {
    // Basic query to check DB
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'connected', mode: activeSettings.isServerMode ? 'Server' : 'Client', database: 'connected', ip: getLocalIpAddress() });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message, mode: activeSettings.isServerMode ? 'Server' : 'Client', ip: getLocalIpAddress() });
  }
});

// 2. Settings Endpoint
app.get('/api/settings', (req, res) => {
  res.json(activeSettings);
});

app.post('/api/settings', (req, res) => {
  const settings = req.body as AppSettings;
  const dbUrlChanged = settings.databaseUrl !== activeSettings.databaseUrl;
  
  activeSettings = { ...activeSettings, ...settings };
  saveSettings(activeSettings);

  if (dbUrlChanged) {
    reinitPrisma(activeSettings.databaseUrl);
  }

  res.json({ success: true, settings: activeSettings });
});

// 3. Products Endpoints (Barcode or PLU lookup)
app.get('/api/products/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  
  try {
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { id: { contains: String(q), mode: 'insensitive' } },
          { pluCode: { contains: String(q), mode: 'insensitive' } },
          { name: { contains: String(q), mode: 'insensitive' } },
        ],
      },
      take: 20,
    });
    res.json(serializePrismaObj(products));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/products/:idOrPlu', async (req, res) => {
  const { idOrPlu } = req.params;
  try {
    // Try barcode search
    let product = await prisma.product.findUnique({
      where: { id: idOrPlu },
    });

    // If not found, try PLU search
    if (!product && idOrPlu.length <= 5) {
      product = await prisma.product.findUnique({
        where: { pluCode: idOrPlu },
      });
    }

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(serializePrismaObj(product));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(serializePrismaObj(products));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', async (req, res) => {
  const {
    id,
    pluCode,
    category,
    name,
    hsnCode,
    currentStock,
    minThreshold,
    costPrice,
    sellingPrice,
    mrp,
    packageWeight,
    packageUnit,
    sackKg,
    sackRate,
    gstRate,
    taxInclusive,
    supplierId,
    advancePaid
  } = req.body;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const data = {
        pluCode: pluCode ? String(pluCode).trim() : null,
        category: category || 'Others',
        name,
        hsnCode,
        currentStock: Number(currentStock),
        minThreshold: Number(minThreshold || 5.0),
        costPrice: Number(costPrice),
        sellingPrice: Number(sellingPrice),
        mrp: mrp ? Number(mrp) : Number(sellingPrice),
        packageWeight: packageWeight ? Number(packageWeight) : null,
        packageUnit: packageUnit ? String(packageUnit) : null,
        sackKg: sackKg ? Number(sackKg) : null,
        sackRate: sackRate ? Number(sackRate) : null,
        gstRate: Number(gstRate),
        taxInclusive: !!taxInclusive,
      };

      const product = await tx.product.upsert({
        where: { id },
        update: data,
        create: { id, ...data },
      });

      // Log to SupplierLedger if supplierId is provided
      if (supplierId) {
        const qty = Number(currentStock);
        const cp = Number(costPrice);
        const purchaseAmount = qty * cp;
        const description = `Onboarded product: ${name} (Qty: ${qty.toFixed(3)}, Cost: ₹${cp.toFixed(2)})`;

        await tx.supplierLedger.create({
          data: {
            supplierId: Number(supplierId),
            description,
            purchaseAmount,
            paidAmount: Number(advancePaid || 0),
          },
        });
      }

      // Also log stock history entry
      await tx.stockHistoryLog.create({
        data: {
          productId: id,
          quantityAdded: Number(currentStock),
          previousStock: 0.0,
          newStock: Number(currentStock),
          sourceType: 'SUPPLIER_INBOUND',
          referenceNote: supplierId ? `Initial stock onboarding from Supplier ID: ${supplierId}` : 'Initial stock onboarding',
        }
      });

      return product;
    });

    res.json(serializePrismaObj(result));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Check if there are any invoice items referencing this product to avoid database constraint violations
    const invoiceItemCount = await prisma.invoiceItem.count({
      where: { productId: id },
    });

    if (invoiceItemCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete product because it has associated invoice history. You can adjust its stock to 0 instead.',
      });
    }

    await prisma.product.delete({ where: { id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk Import Products
app.post('/api/products/bulk', async (req, res) => {
  const { products } = req.body; // Array of product objects
  if (!Array.isArray(products)) {
    return res.status(400).json({ error: 'Invalid payload, expected array' });
  }

  try {
    const results = [];
    for (const p of products) {
      if (!p.id || !p.name) continue;
      const data = {
        pluCode: p.pluCode ? String(p.pluCode).trim() : null,
        category: p.category ? String(p.category) : 'Others',
        name: String(p.name),
        hsnCode: String(p.hsnCode || '000000'),
        currentStock: Number(p.currentStock || 0),
        minThreshold: Number(p.minThreshold || 5.0),
        costPrice: Number(p.costPrice || 0),
        sellingPrice: Number(p.sellingPrice || 0),
        mrp: p.mrp ? Number(p.mrp) : Number(p.sellingPrice || 0),
        packageWeight: p.packageWeight ? Number(p.packageWeight) : null,
        packageUnit: p.packageUnit ? String(p.packageUnit) : null,
        sackKg: p.sackKg ? Number(p.sackKg) : null,
        sackRate: p.sackRate ? Number(p.sackRate) : null,
        gstRate: Number(p.gstRate || 0),
        taxInclusive: p.taxInclusive !== undefined ? !!p.taxInclusive : true,
      };

      const result = await prisma.product.upsert({
        where: { id: String(p.id) },
        update: data,
        create: { id: String(p.id), ...data },
      });
      results.push(result);
    }
    res.json({ success: true, count: results.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Auto-generate next sequential EAN-13 custom barcode (starting with '99')
app.post('/api/products/next-barcode', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        id: {
          startsWith: '99',
        },
      },
      select: {
        id: true,
      },
    });

    let maxSeq = 0;
    for (const p of products) {
      if (p.id.length === 13) {
        const seqPart = p.id.substring(2, 12);
        const seqVal = parseInt(seqPart, 10);
        if (!isNaN(seqVal) && seqVal > maxSeq) {
          maxSeq = seqVal;
        }
      }
    }

    const nextSeq = maxSeq + 1;
    const nextSeqStr = String(nextSeq).padStart(10, '0');
    const code12 = `99${nextSeqStr}`;
    const checksum = calculateEan13Checksum(code12);
    const barcode = `${code12}${checksum}`;

    res.json({ barcode });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Atomic Manual Stock Intake/Adjustment (FOR UPDATE row lock)
app.post('/api/products/stock-intake', async (req, res) => {
  const { productId, quantityAdded, sourceType, referenceNote, supplierId, advancePaid } = req.body;
  if (!productId || quantityAdded === undefined || !sourceType) {
    return res.status(400).json({ error: 'Missing required parameters: productId, quantityAdded, sourceType' });
  }

  const qty = Number(quantityAdded);
  if (isNaN(qty) || qty === 0) {
    return res.status(400).json({ error: 'Invalid quantity: must be non-zero numeric value' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch current stock and lock row FOR UPDATE to prevent concurrency anomalies
      const rows: any[] = await tx.$queryRawUnsafe(
        `SELECT current_stock FROM products WHERE id = $1 FOR UPDATE`,
        productId
      );

      if (rows.length === 0) {
        throw new Error(`Product not found: Barcode ${productId}`);
      }

      const previousStock = Number(rows[0].current_stock);
      const newStock = previousStock + qty;

      // 2. Perform atomic stock update
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: {
          currentStock: newStock,
        },
      });

      // 3. Log to SupplierLedger if supplierId is provided
      if (supplierId) {
        const cp = Number(updatedProduct.costPrice);
        const purchaseAmount = qty * cp;
        const description = `Inbound stock intake: ${updatedProduct.name} (Qty: ${qty.toFixed(3)}, Cost: ₹${cp.toFixed(2)})`;

        await tx.supplierLedger.create({
          data: {
            supplierId: Number(supplierId),
            description,
            purchaseAmount,
            paidAmount: Number(advancePaid || 0),
          },
        });
      }

      // 4. Write audit log trace
      const log = await tx.stockHistoryLog.create({
        data: {
          productId,
          quantityAdded: qty,
          previousStock,
          newStock,
          sourceType,
          referenceNote: referenceNote || (supplierId ? `Stock intake from Supplier ID: ${supplierId}` : null),
        },
      });

      return { product: updatedProduct, log };
    });

    res.json(serializePrismaObj(result));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Get stock adjustment history timeline for a product
app.get('/api/products/:id/stock-logs', async (req, res) => {
  const { id } = req.params;
  try {
    const logs = await prisma.stockHistoryLog.findMany({
      where: { productId: id },
      orderBy: { timestamp: 'desc' },
    });
    res.json(serializePrismaObj(logs));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// 4. POS Billing Checkout (ACID Transaction)
app.post('/api/checkout', async (req, res) => {
  const { customerPhone, customerGstin, discount, paymentMode, items } = req.body;
  // items: array of { productId, quantity }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No items in the billing cart' });
  }

  try {
    // Generate consecutive Invoice ID (ZB-YYYY-00001)
    const year = new Date().getFullYear();
    const prefix = `ZB-${year}-`;

    const result = await prisma.$transaction(async (tx) => {
      // Find the last invoice for the year to sequence
      const lastInvoice = await tx.invoice.findFirst({
        where: {
          id: {
            startsWith: prefix,
          },
        },
        orderBy: {
          id: 'desc',
        },
      });

      let nextNum = 1;
      if (lastInvoice) {
        const lastNumPart = lastInvoice.id.substring(prefix.length);
        const parsedNum = parseInt(lastNumPart, 10);
        if (!isNaN(parsedNum)) {
          nextNum = parsedNum + 1;
        }
      }

      const invoiceId = `${prefix}${String(nextNum).padStart(5, '0')}`;

      let subtotal = 0;
      let totalCgst = 0;
      let totalSgst = 0;
      const invoiceItemsData = [];

      for (const item of items) {
        const dbProduct = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!dbProduct) {
          throw new Error(`Product not found: Barcode ${item.productId}`);
        }

        const quantity = Number(item.quantity);
        const currentStock = Number(dbProduct.currentStock.toString());

        // Validate stock availability
        if (currentStock < quantity) {
          throw new Error(`Insufficient stock for ${dbProduct.name}. Requested: ${quantity}, Available: ${currentStock}`);
        }

        // Calculate GST details
        const sellingPrice = Number(dbProduct.sellingPrice.toString());
        const gstRate = Number(dbProduct.gstRate.toString());
        const taxInclusive = dbProduct.taxInclusive;

        const gstCalc = calculateGstDetails(sellingPrice, gstRate, quantity, taxInclusive);

        // Deduct stock
        await tx.product.update({
          where: { id: dbProduct.id },
          data: {
            currentStock: {
              decrement: quantity,
            },
          },
        });

        subtotal += gstCalc.baseTaxableValue;
        totalCgst += gstCalc.cgstAmount;
        totalSgst += gstCalc.sgstAmount;

        invoiceItemsData.push({
          productId: dbProduct.id,
          quantity,
          rate: sellingPrice,
          cgstAmount: gstCalc.cgstAmount,
          sgstAmount: gstCalc.sgstAmount,
          rowTotal: gstCalc.rowTotal,
        });
      }

      const discountVal = Number(discount || 0);
      const grossTotal = subtotal + totalCgst + totalSgst;
      const grandTotal = Math.round(grossTotal - discountVal); // round grand total

      // Create invoice
      const invoice = await tx.invoice.create({
        data: {
          id: invoiceId,
          customerPhone,
          customerGstin,
          subtotal,
          totalCgst,
          totalSgst,
          discount: discountVal,
          grandTotal,
          paymentMode,
          items: {
            create: invoiceItemsData,
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      return invoice;
    });

    const serialized = serializePrismaObj(result);
    if (serialized) {
      const grossTotal = Number(serialized.subtotal) + Number(serialized.totalCgst) + Number(serialized.totalSgst);
      serialized.roundOff = Number((Number(serialized.grandTotal) - (grossTotal - Number(serialized.discount))).toFixed(2));
    }
    res.json(serialized);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 5. Dashboard Metrics
app.get('/api/dashboard', async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Today's invoices
    const invoices = await prisma.invoice.findMany({
      where: {
        timestamp: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });

    let grossRevenue = 0;
    let totalCgst = 0;
    let totalSgst = 0;

    for (const inv of invoices) {
      grossRevenue += Number(inv.grandTotal.toString());
      totalCgst += Number(inv.totalCgst.toString());
      totalSgst += Number(inv.totalSgst.toString());
    }

    // Out of stock & low stock alerts
    const lowStockProducts = await prisma.product.findMany({
      where: {
        OR: [
          { currentStock: { lte: prisma.product.fields.minThreshold } },
          { currentStock: { lte: 0 } },
        ],
      },
      take: 20,
    });

    res.json({
      todayInvoiceCount: invoices.length,
      todayRevenue: Number(grossRevenue.toFixed(2)),
      totalCgst: Number(totalCgst.toFixed(2)),
      totalSgst: Number(totalSgst.toFixed(2)),
      lowStockCount: lowStockProducts.length,
      alerts: serializePrismaObj(lowStockProducts),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Suppliers Ledger API
app.get('/api/suppliers', async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      include: {
        transactions: true,
      },
    });

    // Calculate dynamic Outstanding Debt
    const result = suppliers.map((sup) => {
      let totalPurchases = 0;
      let totalPaid = 0;

      for (const t of sup.transactions) {
        totalPurchases += Number(t.purchaseAmount.toString());
        totalPaid += Number(t.paidAmount.toString());
      }

      return {
        id: sup.id,
        name: sup.name,
        phone: sup.phone,
        gstin: sup.gstin,
        outstandingDebt: Number((totalPurchases - totalPaid).toFixed(2)),
      };
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/suppliers', async (req, res) => {
  const { name, phone, gstin } = req.body;
  try {
    const supplier = await prisma.supplier.create({
      data: { name, phone, gstin },
    });
    res.json(supplier);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/suppliers/:id/transactions', async (req, res) => {
  const supplierId = parseInt(req.params.id, 10);
  const { description, purchaseAmount, paidAmount } = req.body;

  try {
    const tx = await prisma.supplierLedger.create({
      data: {
        supplierId,
        description,
        purchaseAmount: Number(purchaseAmount || 0),
        paidAmount: Number(paidAmount || 0),
      },
    });
    res.json(serializePrismaObj(tx));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/suppliers/:id/ledger', async (req, res) => {
  const supplierId = parseInt(req.params.id, 10);
  try {
    const ledger = await prisma.supplierLedger.findMany({
      where: { supplierId },
      orderBy: { timestamp: 'desc' },
    });
    res.json(serializePrismaObj(ledger));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. GST Compliance Hub (GSTR-1 report format)
app.get('/api/gst/report', async (req, res) => {
  const { start, end } = req.query;

  try {
    const filter: any = {};
    if (start && end) {
      filter.timestamp = {
        gte: new Date(String(start)),
        lte: new Date(String(end)),
      };
    }

    const invoices = await prisma.invoice.findMany({
      where: filter,
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    const b2b: any[] = [];
    const b2c: any[] = [];

    for (const inv of invoices) {
      const data = {
        invoiceId: inv.id,
        timestamp: inv.timestamp.toISOString(),
        customerPhone: inv.customerPhone,
        customerGstin: inv.customerGstin,
        subtotal: Number(inv.subtotal.toString()),
        totalCgst: Number(inv.totalCgst.toString()),
        totalSgst: Number(inv.totalSgst.toString()),
        discount: Number(inv.discount.toString()),
        grandTotal: Number(inv.grandTotal.toString()),
        paymentMode: inv.paymentMode,
      };

      if (inv.customerGstin && inv.customerGstin.trim().length > 0) {
        b2b.push(data);
      } else {
        b2c.push(data);
      }
    }

    res.json({
      b2b,
      b2c,
      totalB2bCount: b2b.length,
      totalB2cCount: b2c.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Weighing Scale PLU broadcast (mock network broadcast)
app.post('/api/scale/sync', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        pluCode: { not: '' },
      },
    });

    // Mock broadcasting logic
    // In a production environment, this would build TCP/UDP packets and send to the Scale IP
    console.log(`Broadcasting ${products.length} PLUs to Scale at IP ${activeSettings.scaleIp}`);
    
    res.json({
      success: true,
      scaleIp: activeSettings.scaleIp,
      broadcastedPluCount: products.length,
      message: `PLUs broadcasted successfully to smart scale at ${activeSettings.scaleIp}`,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Mobile Wireless Scanner API Endpoints
app.post('/api/scan-event', (req, res) => {
  const { barcode } = req.body;
  if (barcode) {
    const cleanCode = String(barcode).trim();
    scanQueue.push(cleanCode);
    console.log(`[MOBILE Wi-Fi SCAN] Enqueued barcode: ${cleanCode}`);
    res.json({ success: true, barcode: cleanCode });
  } else {
    res.status(400).json({ error: 'Missing barcode' });
  }
});

app.get('/api/scan-event', (req, res) => {
  const currentScans = [...scanQueue];
  scanQueue = []; // Clear queue
  res.json({ barcodes: currentScans });
});

// Serve Mobile Barcode Scanner Web Page over local network
app.get('/scanner', (req, res) => {
  const serverIp = getLocalIpAddress();
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <title>Zabeel POS Wireless Barcode Scanner</title>
  <style>
    body {
      margin: 0;
      background-color: #020617;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }
    header {
      padding: 18px 0;
      background-color: #0f172a;
      text-align: center;
      border-bottom: 1px solid #1e293b;
      font-weight: 800;
      font-size: 13px;
      letter-spacing: 0.1em;
      color: #3b82f6;
      text-transform: uppercase;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    #scanner-container {
      flex: 1;
      width: 100%;
      position: relative;
      display: flex;
      justify-content: center;
      align-items: center;
      background-color: #000;
    }
    video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    #overlay-reticle {
      position: absolute;
      width: 260px;
      height: 160px;
      border: 2px solid #3b82f6;
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
      border-radius: 12px;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    #laser-beam {
      width: 100%;
      height: 3px;
      background-color: #ef4444;
      box-shadow: 0 0 10px #ef4444;
      position: absolute;
      top: 50%;
      animation: sweepLaser 2s infinite ease-in-out;
    }
    @keyframes sweepLaser {
      0% { top: 5%; }
      50% { top: 95%; }
      100% { top: 5%; }
    }
    #controls-panel {
      padding: 24px;
      background-color: #0f172a;
      border-top: 1px solid #1e293b;
      display: flex;
      flex-direction: column;
      gap: 14px;
      z-index: 10;
      box-shadow: 0 -4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    input {
      width: 100%;
      padding: 14px;
      border: 1px solid #334155;
      border-radius: 10px;
      background-color: #020617;
      color: #f8fafc;
      box-sizing: border-box;
      font-size: 15px;
      text-align: center;
      font-family: monospace;
      letter-spacing: 0.1em;
      outline: none;
    }
    input:focus {
      border-color: #3b82f6;
    }
    button {
      padding: 14px;
      border: none;
      border-radius: 10px;
      background-color: #2563eb;
      color: #ffffff;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      transition: background-color 0.2s;
    }
    button:active {
      background-color: #1d4ed8;
    }
    #status-feedback {
      text-align: center;
      font-size: 12px;
      min-height: 18px;
      color: #10b981;
      font-weight: 600;
    }
  </style>
  <script src="https://unpkg.com/@zxing/library@0.19.1/umd/index.min.js"></script>
</head>
<body>
  <header>Zabeel Mobile Camera Scanner</header>
  <div id="scanner-container">
    <video id="camera-stream" autoplay playsinline></video>
    <div id="overlay-reticle">
      <div id="laser-beam"></div>
    </div>
  </div>
  <div id="controls-panel">
    <div id="status-feedback">Initializing camera...</div>
    <input type="file" id="file-capture" accept="image/*" capture="environment" style="display: none;">
    <button id="snap-photo-btn" style="background-color: #0d9488;">Snap / Upload Barcode Photo</button>
    <input type="text" id="manual-barcode-input" placeholder="Or type EAN/PLU code manually...">
    <button id="submit-barcode-btn">Submit Code</button>
    <div style="font-size: 8px; color: #64748b; text-align: center; margin-top: 4px; line-height: 1.3;">
      * Camera video requires HTTPS. Use <strong>"Snap/Upload Barcode Photo"</strong> to bypass security limits, or configure browser settings: <em>chrome://flags/#unsafely-treat-insecure-origin-as-secure</em> (add this site's Wi-Fi IP).
    </div>
  </div>

  <script>
    const video = document.getElementById('camera-stream');
    const feedback = document.getElementById('status-feedback');
    const input = document.getElementById('manual-barcode-input');
    const button = document.getElementById('submit-barcode-btn');
    const fileInput = document.getElementById('file-capture');
    const snapBtn = document.getElementById('snap-photo-btn');
    let lastScanCode = '';
    let isScanCooldown = false;

    // Start rear-facing camera stream
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        video.srcObject = stream;
        feedback.style.color = '#10b981';
        feedback.innerText = 'Camera scanner active. Focus red line on barcode.';
        startContinuousScan();
      })
      .catch(err => {
        console.error('Camera stream access denied:', err);
        feedback.style.color = '#f87171';
        feedback.innerText = 'Camera error: ' + err.name + ' - ' + err.message + '. Use manual keypad or photo snap below.';
      });

    async function sendScanEvent(barcode) {
      feedback.style.color = '#3b82f6';
      feedback.innerText = 'Transmitting barcode ' + barcode + '...';
      try {
        const res = await fetch('/api/scan-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ barcode: barcode })
        });
        if (res.ok) {
          feedback.style.color = '#10b981';
          feedback.innerText = 'Code Sent: ' + barcode;
          triggerBeepSound();
        } else {
          throw new Error('Rejected');
        }
      } catch (err) {
        feedback.style.color = '#f87171';
        feedback.innerText = 'Transmission failed. Retrying...';
      }
    }

    function triggerBeepSound() {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(950, audioCtx.currentTime); // High pitch beep
        gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
        
        oscillator.start();
        setTimeout(() => {
          oscillator.stop();
          audioCtx.close();
        }, 120);
      } catch (e) {
        console.error('Audio beep unavailable', e);
      }
    }

    let zxingReader = null;
    const hasZXing = typeof ZXing !== 'undefined';
    if (hasZXing) {
      zxingReader = new ZXing.BrowserMultiFormatReader();
      console.log('ZXing MultiFormatReader initialized');
    }

    async function startContinuousScan() {
      if (!('BarcodeDetector' in window)) {
        if (hasZXing && zxingReader) {
          feedback.style.color = '#3b82f6';
          feedback.innerText = 'Using ZXing JS barcode reader fallback. Focus red line on barcode.';
          try {
            zxingReader.decodeFromVideoDevice(null, video, (result, err) => {
              if (result && !isScanCooldown) {
                const code = result.text;
                if (code !== lastScanCode) {
                  lastScanCode = code;
                  isScanCooldown = true;
                  sendScanEvent(code);
                  setTimeout(() => {
                    isScanCooldown = false;
                    lastScanCode = '';
                  }, 1800);
                }
              }
            });
            return;
          } catch (e) {
            console.error('ZXing continuous scan start failed:', e);
          }
        }
        feedback.style.color = '#fbbf24';
        feedback.innerText = 'Camera scan not supported on this phone browser. Use keyboard entry.';
        return;
      }

      try {
        const detector = new BarcodeDetector({ 
          formats: ['ean_13', 'ean_8', 'qr_code', 'code_128', 'code_39', 'upc_a'] 
        });

        async function processFrame() {
          if (video.readyState === video.HAVE_ENOUGH_DATA && !isScanCooldown) {
            try {
              const detected = await detector.detect(video);
              if (detected.length > 0) {
                const code = detected[0].rawValue;
                if (code !== lastScanCode) {
                  lastScanCode = code;
                  isScanCooldown = true;
                  await sendScanEvent(code);
                  // 1.8 second delay to prevent multiple inputs for the same item
                  setTimeout(() => {
                    isScanCooldown = false;
                    lastScanCode = '';
                  }, 1800);
                }
              }
            } catch (e) {
              console.error(e);
            }
          }
          requestAnimationFrame(processFrame);
        }

        requestAnimationFrame(processFrame);
      } catch (err) {
        console.error('Detector init failure:', err);
      }
    }

    snapBtn.onclick = () => fileInput.click();

    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      feedback.style.color = '#fbbf24';
      feedback.innerText = 'Analyzing photo scan...';

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = async () => {
          try {
            if ('BarcodeDetector' in window) {
              const detector = new BarcodeDetector({ 
                formats: ['ean_13', 'ean_8', 'qr_code', 'code_128', 'code_39', 'upc_a'] 
              });
              const detected = await detector.detect(img);
              if (detected.length > 0) {
                const code = detected[0].rawValue;
                await sendScanEvent(code);
                return;
              }
            }
            
            // Fallback to ZXing reader for photos (crucial for iOS Safari)
            if (hasZXing && zxingReader) {
              try {
                const result = await zxingReader.decodeFromImageElement(img);
                if (result && result.text) {
                  await sendScanEvent(result.text);
                  return;
                }
              } catch (zxingErr) {
                console.warn('ZXing image decode failed:', zxingErr);
              }
            }

            feedback.style.color = '#f87171';
            feedback.innerText = 'No barcode found in photo. Focus closer and retry.';
          } catch (err) {
            console.error(err);
            feedback.style.color = '#f87171';
            feedback.innerText = 'Photo analysis error.';
          }
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    };

    button.onclick = () => {
      const val = input.value.trim();
      if (val) {
        sendScanEvent(val);
        input.value = '';
      }
    };

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        button.click();
      }
    });
  </script>
</body>
</html>
  `;
  res.send(html);
});

// Start Express Server
const PORT = activeSettings.serverPort;
let serverInstance: any;

export function startServer() {
  if (!serverInstance) {
    serverInstance = app.listen(PORT, () => {
      console.log(`POS API backend running at http://localhost:${PORT}`);
    });
  }
  return serverInstance;
}

export function stopServer() {
  if (serverInstance) {
    serverInstance.close();
    serverInstance = null;
    console.log('POS API backend stopped');
  }
}

// If run directly (for testing/independent use)
if (require.main === module) {
  startServer();
}
