import { ReceiptStatusSchema } from '@/lib/schemas/receipt/public/Receipt';
import { z } from 'zod';

/**
 * Schema for POST /api/receipts request
 * All fields are optional to support both:
 * - Creating empty receipts (manual entry)
 * - Creating receipts with parsed data
 */
export const CreateReceiptRequestSchema = z.object({
  imageURI: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  receiptTime: z.string().nullable().optional(), // Can be YYYY-MM-DD or ISO timestamp
  status: ReceiptStatusSchema, // Required: PRSP for parse, DRFT for manual
  ownerId: z.string().nullable().optional(),
});

export type CreateReceiptRequest = z.infer<typeof CreateReceiptRequestSchema>;
