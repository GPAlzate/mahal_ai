import { z } from 'zod';
import { ReceiptLineTypeSchema } from './ReceiptLineType';

const BBOXSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

export type BBOX = z.infer<typeof BBOXSchema>;

/**
 * Schema for ReceiptLine database entity
 * Represents a row from the receipt_lines table
 */
export const ReceiptLineSchema = z.object({
  id: z.number(),
  receiptId: z.number(),
  itemName: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  totalPrice: z.number(),
  receiptLineType: ReceiptLineTypeSchema,
  lineSourceBbox: BBOXSchema.nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

export type ReceiptLine = z.infer<typeof ReceiptLineSchema>;
