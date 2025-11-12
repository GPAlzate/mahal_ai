import { z } from 'zod';
import { ReceiptLineTypeSchema } from './ReceiptLineType';

/**
 * Zod schema for parsed receipt line
 */
const ParsedReceiptLineSchema = z.object({
  description: z.string().describe('The item or charge description'),
  quantity: z.number().positive().describe('The quantity'),
  unitPrice: z.number().describe('The price per unit'),
  totalPrice: z.number().describe('Total for this line (unitPrice × quantity)'),
  receiptLineType: ReceiptLineTypeSchema.describe('Type of line item'),
});

/**
 * Zod schema for parsed receipt (used for OpenAI structured outputs)
 */
export const ParsedReceiptSchema = z.object({
  merchantName: z.string().optional().describe('Name of the merchant/store'),
  receiptDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Receipt date in YYYY-MM-DD format'),
  receiptLines: z
    .array(ParsedReceiptLineSchema)
    .describe('All line items including purchases, taxes, tips, charges, and discounts'),
  currency: z.string().describe('Currency code (e.g., PHP, USD)'),
  subtotal: z.number().nonnegative().describe('Sum of all PRCH items before taxes/tips/charges'),
  amountDue: z.number().nonnegative().describe('Final total amount due'),
});

/**
 * Result of parsing a receipt image (inferred from Zod schema)
 */
export type ParsedReceipt = z.infer<typeof ParsedReceiptSchema>;
