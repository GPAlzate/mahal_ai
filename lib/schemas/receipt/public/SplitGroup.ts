import { z } from 'zod';
import { ReceiptSchema } from '@/lib/schemas/receipt/public/Receipt';
import { ParticipantSchema } from '@/lib/schemas/participant/public/Participant';
import { LineParticipantSchema } from '@/lib/schemas/participant/public/LineParticipant';

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