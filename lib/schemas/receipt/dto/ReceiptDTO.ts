import { z } from 'zod';
import { ReceiptStatusSchema } from '../public/Receipt';
import { ReceiptLineDTO, toReceiptLine } from './ReceiptLineDTO';

/**
 * DTO schema for Receipt from database (snake_case)
 * Represents raw database row format
 */
export const ReceiptDTOSchema = z.object({
  id: z.number(),
  share_code: z.string(),
  status: ReceiptStatusSchema,
  image_uri: z.string().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullable(),
});

export type ReceiptDTO = z.infer<typeof ReceiptDTOSchema>;

/**
 * Convert ReceiptDTO (snake_case) to Receipt (camelCase)
 * @param dto - Receipt database row
 * @param linesDTOs - Optional receipt lines from JOIN query
 */
export function toReceipt(dto: ReceiptDTO, linesDTOs?: ReceiptLineDTO[]) {
  const receipt = {
    id: dto.id,
    shareCode: dto.share_code,
    status: dto.status,
    imageURI: dto.image_uri,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    deletedAt: dto.deleted_at,
  };

  // If no lines provided, return receipt without lines field
  if (!linesDTOs || linesDTOs.length === 0) {
    return receipt;
  }

  // Convert line DTOs to ReceiptLine objects
  return {
    ...receipt,
    lines: linesDTOs.map(toReceiptLine),
  };
}
