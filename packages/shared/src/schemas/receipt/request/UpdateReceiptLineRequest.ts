import { z } from 'zod';
import { ReceiptLineTypeSchema } from '../public/ReceiptLineType';

/**
 * Schema for updating a receipt line
 * All fields are optional to support partial updates
 * Used in: PUT /api/receipts/[id]/lines/[lineId]
 *
 * Note: totalPrice is automatically recalculated when quantity or unitPrice changes
 */
export const UpdateReceiptLineRequestSchema = z.object({
  itemName: z.string().min(1, 'Item name cannot be empty').optional(),
  quantity: z.number().positive('Quantity must be positive').optional(),
  unitPrice: z.number({ error: 'Unit price must be a number' }).optional(),
  receiptLineType: ReceiptLineTypeSchema.optional(),
});

export type UpdateReceiptLineRequest = z.infer<typeof UpdateReceiptLineRequestSchema>;
