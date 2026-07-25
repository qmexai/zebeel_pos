// Pure JS verification script for GST calculations and Weigh scale barcode parser
function calculateGstDetails(sellingPrice, gstRatePercent, quantity, taxInclusive = true) {
  const qty = Number(quantity);
  const price = Number(sellingPrice);
  const rate = Number(gstRatePercent);

  if (isNaN(qty) || isNaN(price) || isNaN(rate)) {
    return { baseTaxableValue: 0, combinedGst: 0, cgstAmount: 0, sgstAmount: 0, rowTotal: 0 };
  }

  let unitBaseTaxable = 0;
  let unitCombinedGst = 0;

  if (taxInclusive) {
    unitBaseTaxable = price / (1 + rate / 100);
    unitCombinedGst = price - unitBaseTaxable;
  } else {
    unitBaseTaxable = price;
    unitCombinedGst = price * (rate / 100);
  }

  const unitRowTotal = taxInclusive ? price : price + unitCombinedGst;
  const rowTotal = unitRowTotal * qty;

  const baseTaxableValue = unitBaseTaxable * qty;
  const combinedGst = unitCombinedGst * qty;
  const cgstAmount = combinedGst / 2;
  const sgstAmount = combinedGst / 2;

  return {
    baseTaxableValue: Number(baseTaxableValue.toFixed(2)),
    combinedGst: Number(combinedGst.toFixed(2)),
    cgstAmount: Number(cgstAmount.toFixed(2)),
    sgstAmount: Number(sgstAmount.toFixed(2)),
    rowTotal: Number(rowTotal.toFixed(2)),
  };
}

function parseScaleBarcode(barcode, prefix = "22") {
  const cleanBarcode = barcode.trim();
  if (cleanBarcode.length === 13 && cleanBarcode.startsWith(prefix)) {
    const pluCode = cleanBarcode.substring(2, 7);
    const weightPayload = cleanBarcode.substring(7, 12);
    const weightGrams = parseInt(weightPayload, 10);
    if (isNaN(weightGrams)) return null;
    const weightKg = weightGrams / 1000;
    return { pluCode, weightKg };
  }
  return null;
}

function runTests() {
  console.log('--- STARTING PURE JS ARITHMETIC AND PARSER VERIFICATION ---');

  // Test 1: Tax-inclusive calculations
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
  const gstExclusive = calculateGstDetails(100.00, 12.00, 1.5, false);
  console.log('Test 2 (Exclusive GST):', gstExclusive);
  
  if (gstExclusive.rowTotal !== 168.00) {
    throw new Error(`Exclusive rowTotal should be 168.00, got ${gstExclusive.rowTotal}`);
  }
  if (gstExclusive.cgstAmount !== 9.00) {
    throw new Error(`Exclusive CGST should be 9.00, got ${gstExclusive.cgstAmount}`);
  }

  // Test 3: Weigh Scale Barcode Parser
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
