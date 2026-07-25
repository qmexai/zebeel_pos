export interface GstCalculationResult {
  baseTaxableValue: number;
  combinedGst: number;
  cgstAmount: number;
  sgstAmount: number;
  rowTotal: number;
}

/**
 * Calculates Indian GST breakdown for a product item.
 * 
 * If taxInclusive is true:
 * - Base Taxable Value = Selling Price (MRP) / (1 + (GST Percentage Rate / 100))
 * - Combined GST Amount = Selling Price (MRP) - Base Taxable Value
 * - Intra-State Split: CGST Amount = Combined GST Amount / 2, SGST Amount = Combined GST Amount / 2
 * 
 * If taxInclusive is false:
 * - Base Taxable Value = Selling Price (MRP)
 * - Combined GST Amount = Base Taxable Value * (GST Percentage Rate / 100)
 * - Intra-State Split: CGST Amount = Combined GST Amount / 2, SGST Amount = Combined GST Amount / 2
 */
export function calculateGstDetails(
  sellingPrice: number, // Unit MRP/Rate
  gstRatePercent: number, // e.g. 18.00, 12.00, etc.
  quantity: number,
  taxInclusive: boolean = true
): GstCalculationResult {
  const qty = Number(quantity);
  const price = Number(sellingPrice);
  const rate = Number(gstRatePercent);

  if (isNaN(qty) || isNaN(price) || isNaN(rate)) {
    return {
      baseTaxableValue: 0,
      combinedGst: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      rowTotal: 0,
    };
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

  // Calculate row total
  const unitRowTotal = taxInclusive ? price : price + unitCombinedGst;
  const rowTotal = unitRowTotal * qty;

  const baseTaxableValue = unitBaseTaxable * qty;
  const combinedGst = unitCombinedGst * qty;
  const cgstAmount = combinedGst / 2;
  const sgstAmount = combinedGst / 2;

  // Rounding to 2 decimal places to avoid floating point issues
  return {
    baseTaxableValue: Number(baseTaxableValue.toFixed(2)),
    combinedGst: Number(combinedGst.toFixed(2)),
    cgstAmount: Number(cgstAmount.toFixed(2)),
    sgstAmount: Number(sgstAmount.toFixed(2)),
    rowTotal: Number(rowTotal.toFixed(2)),
  };
}
