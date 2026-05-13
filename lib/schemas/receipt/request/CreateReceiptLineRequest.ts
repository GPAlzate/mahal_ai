import { z } from 'zod';
import { ReceiptLineTypeSchema } from '@/lib/schemas/receipt/public/ReceiptLineType';

/**
 * Schema for creating a receipt line
 * Used in:
 * - POST /api/receipts (when creating receipt with lines)
 * - POST /api/receipts/[id]/lines (when adding individual lines)
 *
 * Note: totalPrice is calculated on the backend as quantity * unitPrice
 */
export const CreateReceiptLineRequestSchema = z.object({
  itemName: z.string().min(1, 'Item name is required'),
  quantity: z.number().positive('Quantity must be positive'),
  unitPrice: z.number({ error: 'Unit price must be a number' }),
  receiptLineType: ReceiptLineTypeSchema,
  linePosition: z.number().int().nonnegative().optional(),
});

export type CreateReceiptLineRequest = z.infer<typeof CreateReceiptLineRequestSchema>;
