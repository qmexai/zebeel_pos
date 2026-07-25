// Integration verification test for Wi-Fi scanner APIs and Served Page
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
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve(body); // Return raw html/text if not JSON
          }
        }
      });
    }).on('error', reject);
  });
}

async function verify() {
  console.log('=== STARTING Wi-Fi SCANNER INTEGRATION TESTS ===');
  
  try {
    // 1. Enqueue mock scan event from phone
    const mockBarcode = '8901030752541';
    console.log(`Simulating phone camera barcode scan: ${mockBarcode}...`);
    const pushRes = await post(`${API_BASE}/api/scan-event`, { barcode: mockBarcode });
    console.log('Push response:', pushRes);
    if (!pushRes.success || pushRes.barcode !== mockBarcode) {
      throw new Error(`Push event failed: ${JSON.stringify(pushRes)}`);
    }

    // 2. Poll scanned events queue from POS client
    console.log('POS Client polling scanned queue...');
    const pollRes = await get(`${API_BASE}/api/scan-event`);
    console.log('Poll response:', pollRes);
    if (!pollRes.barcodes || pollRes.barcodes.length !== 1 || pollRes.barcodes[0] !== mockBarcode) {
      throw new Error(`Polling failed to retrieve scanned barcode: ${JSON.stringify(pollRes)}`);
    }

    // 3. Double-check queue is cleared
    console.log('POS Client polling scanned queue again (should be cleared)...');
    const pollRes2 = await get(`${API_BASE}/api/scan-event`);
    console.log('Second poll response:', pollRes2);
    if (!pollRes2.barcodes || pollRes2.barcodes.length !== 0) {
      throw new Error(`Scan queue should be cleared, got: ${JSON.stringify(pollRes2)}`);
    }

    // 4. Test Mobile Web Scanner Page rendering
    console.log('Testing Mobile Scanner HTML Page rendering (/scanner)...');
    const scannerHtml = await get(`${API_BASE}/scanner`);
    if (typeof scannerHtml !== 'string' || !scannerHtml.includes('Zabeel Mobile Camera Scanner')) {
      throw new Error('Served scanner page does not render correctly or lacks camera script triggers');
    }
    console.log('Scanner HTML served successfully (Length:', scannerHtml.length, 'bytes)');

    console.log('=== ALL Wi-Fi SCANNER INTEGRATION TESTS COMPLETED SUCCESSFULLY (SUCCESS) ===');
  } catch (err) {
    console.error('VERIFICATION TEST FAILED:', err);
    process.exit(1);
  }
}

verify();
