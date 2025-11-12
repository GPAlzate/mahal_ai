import { z } from 'zod';
import { ReceiptLineTypeSchema } from '@/lib/schemas/receipt/public/ReceiptLineType';

/**
 * Schema for creating a receipt line
 * Used in:
 * - POST /api/receipts (when creating receipt with lines)
 * - POST /api/receipts/[id]/lines (when adding individual lines)
 */
export const CreateReceiptLineRequestSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().positive('Quantity must be positive'),
  unitPrice: z.number({ invalid_type_error: 'Unit price must be a number' }),
  totalPrice: z.number({ invalid_type_error: 'Total price must be a number' }),
  receiptLineType: ReceiptLineTypeSchema,
});

export type CreateReceiptLineRequest = z.infer<typeof CreateReceiptLineRequestSchema>;
