import { z } from 'zod';

/**
 * Schema for updating a participant
 * Used in: PUT /api/receipts/[id]/participants/[participantId]
 */
export const UpdateParticipantRequestSchema = z.object({
  displayName: z.string().min(1, 'Name cannot be empty').max(100, 'Name too long'),
});

export type UpdateParticipantRequest = z.infer<typeof UpdateParticipantRequestSchema>;
