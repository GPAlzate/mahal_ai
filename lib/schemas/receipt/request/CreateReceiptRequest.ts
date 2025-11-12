import { z } from 'zod';
import { CreateReceiptLineRequestSchema } from './CreateReceiptLineRequest';

/**
 * Schema for POST /api/receipts request
 * All fields are optional to support both:
 * - Creating empty receipts (manual entry)
 * - Creating receipts with parsed data
 */
export const CreateReceiptRequestSchema = z.object({
  merchantName: z.string().optional(),
  receiptDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  receiptLines: z.array(CreateReceiptLineRequestSchema).optional(),
  currency: z.string().optional(),
  subtotal: z.number().nonnegative().optional(),
  amountDue: z.number().nonnegative().optional(),
});

export type CreateReceiptRequest = z.infer<typeof CreateReceiptRequestSchema>;
