/**
 * Parsed line item from a receipt
 */
export interface ParsedLineItem {
  name: string;
  unitPrice: number;
  quantity: number;
}

/**
 * Result of parsing a receipt image
 */
export interface ParsedReceipt {
  items: ParsedLineItem[];
  tax?: number;
  tip?: number;
  serviceCharge?: number;
  discount?: number;
  error?: string;
}
