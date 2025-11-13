import { z } from 'zod';
import { ReceiptLineTypeSchema } from '../public/ReceiptLineType';

/**
 * DTO schema for ReceiptLine from database (snake_case)
 * Represents raw database row format
 */
export const ReceiptLineDTOSchema = z.object({
  id: z.number(),
  receipt_id: z.number(),
  description: z.string(),
  quantity: z.number(),
  unit_price: z.number(),
  total_price: z.number(),
  receipt_line_type: ReceiptLineTypeSchema,
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullable(),
});

export type ReceiptLineDTO = z.infer<typeof ReceiptLineDTOSchema>;

/**
 * Convert ReceiptLineDTO (snake_case) to ReceiptLine (camelCase)
 */
export function toReceiptLine(dto: ReceiptLineDTO) {
  return {
    id: dto.id,
    receiptId: dto.receipt_id,
    description: dto.description,
    quantity: dto.quantity,
    unitPrice: dto.unit_price,
    totalPrice: dto.total_price,
    receiptLineType: dto.receipt_line_type,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    deletedAt: dto.deleted_at,
  };
}
