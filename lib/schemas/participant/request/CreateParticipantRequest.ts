import { z } from 'zod';

/**
 * Schema for creating a participant
 * Used in: POST /api/receipts/[id]/participants
 */
export const CreateParticipantRequestSchema = z.object({
  displayName: z.string().min(1, 'Name is required').max(100, 'Name too long'),
});

export type CreateParticipantRequest = z.infer<typeof CreateParticipantRequestSchema>;
