import { z } from 'zod';

/**
 * DTO schema for Participant from database (snake_case)
 * Represents raw database row format
 */
export const ParticipantDTOSchema = z.object({
  id: z.number(),
  receipt_id: z.number(),
  display_name: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullable(),
});

export type ParticipantDTO = z.infer<typeof ParticipantDTOSchema>;

/**
 * Convert ParticipantDTO (snake_case) to Participant (camelCase)
 */
export function toParticipant(dto: ParticipantDTO) {
  return {
    id: dto.id,
    receiptId: dto.receipt_id,
    displayName: dto.display_name,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    deletedAt: dto.deleted_at,
  };
}
