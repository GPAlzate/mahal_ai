import { z } from 'zod';
import { ReceiptLineTypeSchema } from '../public/ReceiptLineType';

/**
 * Schema for updating a receipt line
 * All fields are optional to support partial updates
 * Used in: PUT /api/receipts/[id]/lines/[lineId]
 */
export const UpdateReceiptLineRequestSchema = z.object({
  description: z.string().min(1, 'Description cannot be empty').optional(),
  quantity: z.number().positive('Quantity must be positive').optional(),
  unitPrice: z.number({ invalid_type_error: 'Unit price must be a number' }).optional(),
  totalPrice: z.number({ invalid_type_error: 'Total price must be a number' }).optional(),
  receiptLineType: ReceiptLineTypeSchema.optional(),
});

export type UpdateReceiptLineRequest = z.infer<typeof UpdateReceiptLineRequestSchema>;
