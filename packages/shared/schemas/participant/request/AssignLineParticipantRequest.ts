import { z } from 'zod';

/**
 * Schema for assigning a participant to a receipt line
 * Used in: POST /api/receipts/[id]/lines/[lineId]/assign
 * Note: Uses coerce to handle both string and number inputs from frontend
 */
export const AssignLineParticipantRequestSchema = z.object({
  participantId: z.coerce.number().int().positive('Participant ID must be a positive integer'),
  shareQuantity: z.coerce.number().positive('Share quantity must be positive').default(1),
});

export type AssignLineParticipantRequest = z.infer<typeof AssignLineParticipantRequestSchema>;
