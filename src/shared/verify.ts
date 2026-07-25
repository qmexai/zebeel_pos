import { calculateGstDetails } from './gstMath';
import { parseScaleBarcode } from './scaleParser';

function runTests() {
  console.log('--- STARTING POS MATHEMATICAL AND PARSER VERIFICATION ---');

  // Test 1: Tax-inclusive calculations
  // MRP = 150.00, GST rate = 18%, Quantity = 2
  // Base Taxable Value = 150 / 1.18 = 127.1186 -> unit Combined GST = 22.8813
  // Multiplied by 2 Qty -> Base = 254.24, Combined GST = 45.76
  // CGST = 22.88, SGST = 22.88
  // Row Total = 150 * 2 = 300.00
  const gstInclusive = calculateGstDetails(150.00, 18.00, 2, true);
  console.log('Test 1 (Inclusive GST):', gstInclusive);
  
  if (gstInclusive.rowTotal !== 300.00) {
    throw new Error(`Inclusive rowTotal should be 300.00, got ${gstInclusive.rowTotal}`);
  }
  if (gstInclusive.cgstAmount !== 22.88) {
    throw new Error(`Inclusive CGST should be 22.88, got ${gstInclusive.cgstAmount}`);
  }
  if (gstInclusive.sgstAmount !== 22.88) {
    throw new Error(`Inclusive SGST should be 22.88, got ${gstInclusive.sgstAmount}`);
  }

  // Test 2: Tax-exclusive calculations
  // MRP = 100.00, GST rate = 12%, Quantity = 1.5
  // Base Taxable Value = 100 * 1.5 = 150
  // Combined GST = 150 * 0.12 = 18.00
  // CGST = 9.00, SGST = 9.00
  // Row Total = 150 + 18 = 168.00
  const gstExclusive = calculateGstDetails(100.00, 12.00, 1.5, false);
  console.log('Test 2 (Exclusive GST):', gstExclusive);
  
  if (gstExclusive.rowTotal !== 168.00) {
    throw new Error(`Exclusive rowTotal should be 168.00, got ${gstExclusive.rowTotal}`);
  }
  if (gstExclusive.cgstAmount !== 9.00) {
    throw new Error(`Exclusive CGST should be 9.00, got ${gstExclusive.cgstAmount}`);
  }

  // Test 3: Weigh Scale Barcode Parser
  // Barcode = "2200541002404" -> PLU = 00541, Weight = 00240 = 240g = 0.240 kg
  const parseResult = parseScaleBarcode("2200541002404");
  console.log('Test 3 (Weigh Scale Parser):', parseResult);
  if (!parseResult) {
    throw new Error('Weigh scale barcode parsing failed');
  }
  if (parseResult.pluCode !== '00541') {
    throw new Error(`Expected PLU "00541", got "${parseResult.pluCode}"`);
  }
  if (parseResult.weightKg !== 0.240) {
    throw new Error(`Expected Weight 0.240 kg, got ${parseResult.weightKg}`);
  }

  console.log('--- ALL MATHEMATICAL AND PARSER VERIFICATION TESTS PASSED ---');
}

runTests();
