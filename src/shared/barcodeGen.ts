/**
 * Pure TypeScript EAN-13 Barcode SVG Generator
 * Generates official standard EAN-13 1D vector SVG markup.
 */

// Left digit structure based on the 1st digit of EAN-13
const FIRST_DIGIT_STRUCTURES: Record<number, string> = {
  0: "LLLLLL",
  1: "LLGLGG",
  2: "LLGGLG",
  3: "LLGGGL",
  4: "LGLLGG",
  5: "LGGLLG",
  6: "LGGGLL",
  7: "LGLGLG",
  8: "LGLGGL",
  9: "LGGLGG",
};

// L-code patterns (7-bit binary string)
const L_CODE = [
  "0001101", "0011001", "0010011", "0111101", "0100011",
  "0110001", "0101111", "0111011", "0110111", "0001011"
];

// G-code patterns
const G_CODE = [
  "0100111", "0110011", "0011011", "0100001", "0011101",
  "0111001", "0000101", "0010001", "0001001", "0010111"
];

// R-code patterns
const R_CODE = [
  "1110010", "1100110", "1101100", "1000010", "1011100",
  "1001110", "1010000", "1000100", "1001000", "1110100"
];

/**
 * Calculates EAN-13 Checksum for a 12-digit code string
 */
export function calculateEan13Checksum(code12: string): number {
  if (code12.length !== 12) return 0;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(code12[i], 10);
    const weight = i % 2 === 1 ? 3 : 1;
    sum += digit * weight;
  }
  const mod = sum % 10;
  return mod === 0 ? 0 : 10 - mod;
}

/**
 * Generates EAN-13 barcode as an SVG XML string
 */
export function generateEan13Svg(code13: string): string {
  if (code13.length !== 13 || !/^\d+$/.test(code13)) {
    return `<svg><text x="10" y="20" fill="red">Invalid EAN-13 Code</text></svg>`;
  }

  const firstDigit = parseInt(code13[0], 10);
  const leftDigits = code13.substring(1, 7);
  const rightDigits = code13.substring(7, 13);
  const structure = FIRST_DIGIT_STRUCTURES[firstDigit] || "LLLLLL";

  // Build binary sequence of bars
  // 1 is black bar, 0 is space
  let binary = "";

  // 1. Left Guard (Start): 101
  binary += "101";

  // 2. Left 6 digits
  for (let i = 0; i < 6; i++) {
    const digit = parseInt(leftDigits[i], 10);
    const codeType = structure[i];
    if (codeType === "L") {
      binary += L_CODE[digit];
    } else {
      binary += G_CODE[digit];
    }
  }

  // 3. Center Guard: 01010
  binary += "01010";

  // 4. Right 6 digits
  for (let i = 0; i < 6; i++) {
    const digit = parseInt(rightDigits[i], 10);
    binary += R_CODE[digit];
  }

  // 5. Right Guard (Stop): 101
  binary += "101";

  // Render SVG
  const barWidth = 2;
  const barHeight = 60;
  const quietZone = 15;
  const totalBars = binary.length;
  const svgWidth = totalBars * barWidth + quietZone * 2;
  const svgHeight = barHeight + 20;

  let paths = "";
  for (let i = 0; i < totalBars; i++) {
    if (binary[i] === "1") {
      // Guard bars are longer than standard bars
      const isGuard = i < 3 || (i >= 45 && i < 50) || i >= 92;
      const height = isGuard ? barHeight + 5 : barHeight;
      const x = quietZone + i * barWidth;
      paths += `<rect x="${x}" y="5" width="${barWidth}" height="${height}" fill="black" />`;
    }
  }

  // Draw Human Readable digits below bars
  const textY = svgHeight - 2;
  let textElements = "";
  // First digit
  textElements += `<text x="${quietZone - 8}" y="${textY - 2}" font-family="monospace" font-size="12" font-weight="bold" fill="black">${firstDigit}</text>`;
  
  // Left 6 digits
  const leftXStart = quietZone + 3 * barWidth + 3;
  for (let i = 0; i < 6; i++) {
    const x = leftXStart + i * 7 * barWidth;
    textElements += `<text x="${x}" y="${textY}" font-family="monospace" font-size="12" font-weight="bold" fill="black">${leftDigits[i]}</text>`;
  }

  // Right 6 digits
  const rightXStart = quietZone + 50 * barWidth + 5;
  for (let i = 0; i < 6; i++) {
    const x = rightXStart + i * 7 * barWidth;
    textElements += `<text x="${x}" y="${textY}" font-family="monospace" font-size="12" font-weight="bold" fill="black">${rightDigits[i]}</text>`;
  }

  return `
    <svg width="100%" height="100%" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg" style="background-color: white; padding: 4px;">
      ${paths}
      ${textElements}
    </svg>
  `.trim();
}
