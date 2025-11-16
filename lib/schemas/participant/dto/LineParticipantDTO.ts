import { z } from 'zod';

/**
 * DTO schema for LineParticipant from database (snake_case)
 * Represents raw database row format
 *
 * Note: PostgreSQL NUMERIC columns are returned as strings by pg driver
 * to preserve precision. We use z.coerce.number() to convert them.
 */
export const LineParticipantDTOSchema = z.object({
  receipt_line_id: z.coerce.number(),  // BIGINT from DB
  participant_id: z.coerce.number(),   // BIGINT from DB
  share_quantity: z.coerce.number(),   // NUMERIC from DB (returned as string)
});

export type LineParticipantDTO = z.infer<typeof LineParticipantDTOSchema>;

/**
 * Convert raw database row to LineParticipantDTO with type coercion
 * Applies Zod schema validation to ensure BIGINT/NUMERIC strings are converted to numbers
 */
export function toLineParticipantDTO(row: any): LineParticipantDTO {
  return LineParticipantDTOSchema.parse(row);
}

/**
 * Convert LineParticipantDTO (snake_case) to LineParticipant (camelCase)
 */
export function toLineParticipant(dto: LineParticipantDTO) {
  return {
    receiptLineId: dto.receipt_line_id,
    participantId: dto.participant_id,
    shareQuantity: dto.share_quantity,
  };
}
