export interface ScannedScaleBarcode {
  pluCode: string;
  weightKg: number;
}

/**
 * Smart Weighing Scale Barcode Parser
 * Intercepts EAN-13 barcodes starting with pre-configured prefix (e.g. '22')
 * Pattern:
 * - Chars 1-2: Prefix (e.g. '22')
 * - Chars 3-7: PLU Code (5 digits, e.g. '00541')
 * - Chars 8-12: Metric Payload (5 digits, e.g. '02400' for 2.400 kg)
 * - Char 13: Check digit
 */
export function parseScaleBarcode(barcode: string, prefix: string = "22"): ScannedScaleBarcode | null {
  // Normalize string
  const cleanBarcode = barcode.trim();

  // Scale barcodes are standard EAN-13 (13 digits)
  if (cleanBarcode.length === 13 && cleanBarcode.startsWith(prefix)) {
    const pluCode = cleanBarcode.substring(2, 7);
    const weightPayload = cleanBarcode.substring(7, 12);
    
    const weightGrams = parseInt(weightPayload, 10);
    if (isNaN(weightGrams)) {
      return null;
    }

    // Conver to kg (divisor is 1000 for standard scale formatting where e.g., 02400 = 2400g = 2.4kg)
    const weightKg = weightGrams / 1000;

    return {
      pluCode,
      weightKg,
    };
  }

  return null;
}
