import { z } from 'zod';

/**
 * DTO schema for LineParticipant from database (snake_case)
 * Represents raw database row format
 */
export const LineParticipantDTOSchema = z.object({
  receipt_line_id: z.number(),
  participant_id: z.number(),
  share_quantity: z.number(),
});

export type LineParticipantDTO = z.infer<typeof LineParticipantDTOSchema>;

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
