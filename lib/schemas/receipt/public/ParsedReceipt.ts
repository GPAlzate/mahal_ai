import { z } from 'zod';
import { ReceiptLineTypeSchema } from './ReceiptLineType';

/**
 * Zod schema for parsed receipt line
 */
const BBOXSchema = z.object({
  x: z.number().describe('Left edge as % of image width (0–100)'),
  y: z.number().describe('Top edge as % of image height (0–100)'),
  w: z.number().describe('Width as % of image width (0–100)'),
  h: z.number().describe('Height as % of image height (0–100)'),
});

const ParsedReceiptLineSchema = z.object({
  itemName: z.string().max(255).describe('The item or charge description'),
  quantity: z.number().positive().describe('The quantity'),
  unitPrice: z.number().describe('The price per unit'),
  totalPrice: z.number().describe('Total for this line (unitPrice × quantity)'),
  receiptLineType: ReceiptLineTypeSchema.describe('Type of line item'),
  lineSourceBbox: BBOXSchema.nullable().optional().describe(
    'Bounding box of this line on the receipt image, as percentages of image dimensions. x/y = top-left corner, w/h = size. Null if not determinable.'
  ),
});

/**
 * Zod schema for parsed receipt (used for OpenAI structured outputs)
 */
export const ParsedReceiptSchema = z.object({
  isReceipt: z
    .boolean()
    .describe(
      'Whether the image is a receipt. Set to false if the image is not a receipt — skip all other fields if false.'
    ),
  merchantName: z.string().nullable().describe('Name of the merchant/store'),
  suggestedTitle: z
    .string()
    .nullable()
    .describe(
      'Short human-readable title for the receipt. Use merchant name if known; otherwise infer from items (e.g. "Team Dinner", "Grocery Run"). 2-5 words, Title Case. Null only if nothing can be inferred.'
    ),
  receiptDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .describe('Receipt date in YYYY-MM-DD format'),
  receiptLines: z
    .array(ParsedReceiptLineSchema)
    .describe('All line items including purchases, taxes, tips, charges, and discounts'),
  currency: z.string().length(3).describe('3-letter ISO currency code (e.g., PHP, USD, EUR)'),
  subtotal: z.number().nonnegative().describe('Sum of all PRCH items before taxes/tips/charges'),
  amountDue: z.number().nonnegative().describe('Final total amount due'),
});

/**
 * Result of parsing a receipt image (inferred from Zod schema)
 */
export type ParsedReceipt = z.infer<typeof ParsedReceiptSchema>;
