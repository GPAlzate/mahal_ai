import { z } from 'zod';

/**
 * DTO schema for Participant from database (snake_case)
 * Represents raw database row format
 *
 * Note: PostgreSQL BIGINT/NUMERIC columns may be returned as strings by pg driver
 * to preserve precision. We use z.coerce.number() to convert them.
 */
export const ParticipantDTOSchema = z.object({
  id: z.coerce.number(),
  receipt_id: z.coerce.number(),
  display_name: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullable(),
});

export type ParticipantDTO = z.infer<typeof ParticipantDTOSchema>;

/**
 * Convert raw database row to ParticipantDTO with type coercion
 * Applies Zod schema validation to ensure BIGINT/NUMERIC strings are converted to numbers
 */
export function toParticipantDTO(row: any): ParticipantDTO {
  return ParticipantDTOSchema.parse(row);
}

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
