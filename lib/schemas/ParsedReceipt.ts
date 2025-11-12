/**
 * Receipt line type enumeration matching database enum
 */
export type ReceiptLineType = 'PRCH' | 'TAX' | 'TIP' | 'SRVC' | 'DSCT';

/**
 * Parsed line item from a receipt
 */
export interface ParsedReceiptLine {
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  receiptLineType: ReceiptLineType;
}

/**
 * Result of parsing a receipt image
 */
export interface ParsedReceipt {
  merchantName?: string;
  receiptDate?: string;
  receiptLines: ParsedReceiptLine[];
  currency: string;
  subtotal: number;
  amountDue: number;
  error?: string;
}
