import { z } from 'zod';
import { ReceiptSchema } from './Receipt';
import { ParticipantSchema } from '../../participant/public/Participant';
import { LineParticipantSchema } from '../../participant/public/LineParticipant';

/**
 * Split Group - virtual concept combining receipt context with participants and assignments
 * Used for batch fetching receipt + lines + participants + assignments in one API call
 * This is NOT backed by a database table - it's a virtual aggregation
 */
export const SplitGroupSchema = z.object({
  receipt: ReceiptSchema,
  participants: z.array(ParticipantSchema),
  assignments: z.array(LineParticipantSchema),
});

export type SplitGroup = z.infer<typeof SplitGroupSchema>;