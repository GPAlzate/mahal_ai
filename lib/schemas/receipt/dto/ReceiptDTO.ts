import { z } from 'zod';
import { ReceiptStatusSchema } from '../public/Receipt';
import { ReceiptLineDTO, toReceiptLine } from './ReceiptLineDTO';

/**
 * DTO schema for Receipt from database (snake_case)
 * Represents raw database row format
 *
 * Note: PostgreSQL BIGINT/NUMERIC columns may be returned as strings by pg driver
 * to preserve precision. We use z.coerce.number() to convert them.
 */
export const ReceiptDTOSchema = z.object({
  id: z.coerce.number(),
  share_code: z.string(),
  status: ReceiptStatusSchema,
  title: z.string().nullable(),
  owner_id: z.string().nullable().optional(),
  receipt_time: z.date(),
  image_uri: z.string().nullable(),
  scanned_subtotal: z.coerce.number().nullable(),
  scanned_total: z.coerce.number().nullable(),
  collector_secret: z.string().optional(),
  payer_participant_id: z.coerce.number().nullable().optional(),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullable(),
});

export type ReceiptDTO = z.infer<typeof ReceiptDTOSchema>;

/**
 * Convert raw database row to ReceiptDTO with type coercion
 * Applies Zod schema validation to ensure BIGINT/NUMERIC strings are converted to numbers
 */
export function toReceiptDTO(row: any): ReceiptDTO {
  return ReceiptDTOSchema.parse(row);
}

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
    title: dto.title,
    ownerId: dto.owner_id ?? null,
    payerParticipantId: dto.payer_participant_id ?? null,
    receiptTime: dto.receipt_time,
    imageURI: dto.image_uri,
    scannedSubtotal: dto.scanned_subtotal,
    scannedTotal: dto.scanned_total,
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
