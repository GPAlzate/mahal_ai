import { ReceiptLineTypeSchema } from '@/lib/schemas/receipt/public/ReceiptLineType';
import { z } from 'zod';

/**
 * DTO schema for ReceiptLine from database (snake_case)
 * Represents raw database row format
 *
 * Note: PostgreSQL BIGINT/NUMERIC columns may be returned as strings by pg driver
 * to preserve precision. We use z.coerce.number() to convert them.
 */
export const ReceiptLineDTOSchema = z.object({
  id: z.coerce.number(),
  receipt_id: z.coerce.number(),
  item_name: z.string(),
  quantity: z.coerce.number(),
  unit_price: z.coerce.number(),
  line_type: ReceiptLineTypeSchema,
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullable(),
});

export type ReceiptLineDTO = z.infer<typeof ReceiptLineDTOSchema>;

/**
 * Convert raw database row to ReceiptLineDTO with type coercion
 * Applies Zod schema validation to ensure BIGINT/NUMERIC strings are converted to numbers
 */
export function toReceiptLineDTO(row: any): ReceiptLineDTO {
  return ReceiptLineDTOSchema.parse(row);
}

/**
 * Convert ReceiptLineDTO (snake_case) to ReceiptLine (camelCase)
 */
export function toReceiptLine(dto: ReceiptLineDTO) {
  return {
    id: dto.id,
    receiptId: dto.receipt_id,
    itemName: dto.item_name,
    quantity: dto.quantity,
    unitPrice: dto.unit_price,
    totalPrice: dto.unit_price * dto.quantity, // derived
    receiptLineType: dto.line_type,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    deletedAt: dto.deleted_at,
  };
}
