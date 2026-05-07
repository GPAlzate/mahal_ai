/**
 * Format a number as Philippine Peso currency
 *
 * @param amount - The amount to format
 * @returns Formatted currency string (e.g., "₱123.45")
 *
 * @example
 * ```typescript
 * formatCurrency(123.456); // "₱123.46"
 * formatCurrency(1000);    // "₱1,000.00"
 * formatCurrency(0.5);     // "₱0.50"
 * ```
 */
export function formatCurrency(amount: number): string {
  const abs = new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  return amount < 0 ? `-PHP${abs}` : `PHP${abs}`;
}

/**
 * Parse a currency string to a number
 * Handles various formats including with/without currency symbol, commas, etc.
 *
 * @param str - The currency string to parse
 * @returns The parsed number, or NaN if invalid
 *
 * @example
 * ```typescript
 * parseCurrency("₱123.45");   // 123.45
 * parseCurrency("1,000.00");  // 1000
 * parseCurrency("PHP 500");   // 500
 * parseCurrency("123");       // 123
 * ```
 */
export function parseCurrency(str: string): number {
  // Remove currency symbols, commas, and whitespace
  const cleaned = str
    .replace(/[₱PHP,\s]/g, '')
    .trim();

  return parseFloat(cleaned);
}

/**
 * Round a number to 2 decimal places (standard for currency)
 *
 * @param amount - The amount to round
 * @returns Rounded amount
 *
 * @example
 * ```typescript
 * roundCurrency(123.456);  // 123.46
 * roundCurrency(123.454);  // 123.45
 * roundCurrency(123.4);    // 123.40
 * ```
 */
export function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}
