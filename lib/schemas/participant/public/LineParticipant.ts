import { z } from 'zod';

/**
 * Schema for LineParticipant database entity
 * Represents a row from the line_participants table (junction table)
 *
 * This tracks which participants are assigned to which receipt lines
 * and how much of the line item they are responsible for (share_quantity)
 */
export const LineParticipantSchema = z.object({
  receiptLineId: z.number(),
  participantId: z.number(),
  shareQuantity: z.number().positive('Share quantity must be positive'),
});

export type LineParticipant = z.infer<typeof LineParticipantSchema>;
