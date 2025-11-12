import { z } from 'zod';
import { ReceiptLineTypeSchema } from './ReceiptLineType';

/**
 * Schema for ReceiptLine database entity
 * Represents a row from the receipt_lines table
 */
export const ReceiptLineSchema = z.object({
  id: z.number(),
  receiptId: z.number(),
  description: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  totalPrice: z.number(),
  receiptLineType: ReceiptLineTypeSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

export type ReceiptLine = z.infer<typeof ReceiptLineSchema>;
