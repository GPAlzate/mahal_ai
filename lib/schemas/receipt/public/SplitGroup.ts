import { z } from 'zod';
import { ReceiptSchema } from '@/lib/schemas/receipt/public/Receipt';
import { ParticipantSchema } from '@/lib/schemas/participant/public/Participant';

/**
 * Split Group - virtual concept combining receipt context with participants
 * Used for batch fetching receipt + lines + participants in one API call
 * This is NOT backed by a database table - it's a virtual aggregation
 */
export const SplitGroupSchema = z.object({
  receipt: ReceiptSchema,
  participants: z.array(ParticipantSchema),
});

export type SplitGroup = z.infer<typeof SplitGroupSchema>;