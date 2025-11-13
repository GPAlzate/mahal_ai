import { z } from 'zod';
import { ReceiptStatusSchema } from '../public/Receipt';

/**
 * DTO schema for Receipt from database (snake_case)
 * Represents raw database row format
 */
export const ReceiptDTOSchema = z.object({
  id: z.number(),
  share_code: z.string(),
  status: ReceiptStatusSchema,
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullable(),
});

export type ReceiptDTO = z.infer<typeof ReceiptDTOSchema>;

/**
 * Convert ReceiptDTO (snake_case) to Receipt (camelCase)
 */
export function toReceipt(dto: ReceiptDTO) {
  return {
    id: dto.id,
    shareCode: dto.share_code,
    status: dto.status,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    deletedAt: dto.deleted_at,
  };
}
