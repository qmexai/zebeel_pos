// Integration verification test for stock adjustments and barcode sequencer APIs
const http = require('http');

const API_BASE = 'http://localhost:5000';

function post(url, payload) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(payload);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`POST failed ${res.statusCode}: ${body}`));
        } else {
          resolve(JSON.parse(body));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`GET failed ${res.statusCode}: ${body}`));
        } else {
          resolve(JSON.parse(body));
        }
      });
    }).on('error', reject);
  });
}

async function verify() {
  console.log('=== STARTING STOCK TRACEABILITY INTEGRATION TESTS ===');
  
  try {
    // 1. Test custom barcode generation
    console.log('Testing custom barcode generation...');
    const nextBarcodeRes = await post(`${API_BASE}/api/products/next-barcode`, {});
    console.log('Generated custom barcode:', nextBarcodeRes);
    if (!nextBarcodeRes.barcode || !nextBarcodeRes.barcode.startsWith('99') || nextBarcodeRes.barcode.length !== 13) {
      throw new Error(`Invalid barcode structure: ${JSON.stringify(nextBarcodeRes)}`);
    }

    // 2. Fetch target product details
    const targetProductBarcode = '8901030752538';
    console.log(`Fetching details for target product: ${targetProductBarcode}...`);
    const product = await get(`${API_BASE}/api/products/${targetProductBarcode}`);
    console.log(`Product: ${product.name}, Current Stock: ${product.currentStock}`);
    const originalStock = product.currentStock;

    // 3. Trigger manual stock intake
    console.log('Posting atomic stock adjustment (Intake)...');
    const intakeRes = await post(`${API_BASE}/api/products/stock-intake`, {
      productId: targetProductBarcode,
      quantityAdded: 15.550,
      sourceType: 'SUPPLIER_INBOUND',
      referenceNote: 'PO-2026-Test-Consignment'
    });
    console.log('Intake response:', intakeRes);
    
    const expectedStock = Number((originalStock + 15.550).toFixed(3));
    const actualStock = Number(intakeRes.product.currentStock.toFixed(3));
    if (actualStock !== expectedStock) {
      throw new Error(`Stock mismatch: Expected ${expectedStock}, got ${actualStock}`);
    }
    if (intakeRes.log.quantityAdded !== 15.550 || intakeRes.log.sourceType !== 'SUPPLIER_INBOUND') {
      throw new Error(`Log details mismatch: ${JSON.stringify(intakeRes.log)}`);
    }

    // 4. Retrieve stock audit timeline
    console.log('Fetching stock adjustment logs timeline...');
    const logs = await get(`${API_BASE}/api/products/${targetProductBarcode}/stock-logs`);
    console.log(`Logs found: ${logs.length}. Top log entry:`, logs[0]);
    if (logs.length === 0 || logs[0].quantityAdded !== 15.550) {
      throw new Error('Timeline log check failed');
    }

    console.log('=== ALL INTEGRATION VERIFICATION TESTS COMPLETED SUCCESSFULLY (SUCCESS) ===');
  } catch (err) {
    console.error('VERIFICATION TEST FAILED:', err);
    process.exit(1);
  }
}

verify();
