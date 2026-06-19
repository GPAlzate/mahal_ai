import { z } from 'zod';
import { PaymentStatusSchema } from './PaymentStatus';

/**
 * Schema for Participant database entity
 * Represents a row from the participants table
 *
 * Note: Timestamps are returned as Date objects from the database.
 * Frontend should handle date formatting for display.
 */
export const ParticipantSchema = z.object({
  id: z.number(),
  receiptId: z.number(),
  displayName: z.string(),
  paymentStatus: PaymentStatusSchema.default('PNYP'),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

export type Participant = z.infer<typeof ParticipantSchema>;
