import { z } from 'zod';
import { ReceiptSchema } from './Receipt';
import { ParticipantSplitSchema } from './ParticipantSplit';

/**
 * Schema for complete receipt summary with participant splits
 * Used in: GET /api/receipts/[id]/summary and GET /api/receipts/share/[code]
 */
export const ReceiptSummarySchema = z.object({
  receipt: ReceiptSchema,
  participantSplits: z.array(ParticipantSplitSchema),
  subtotal: z.number(),
  tax: z.number(),
  tip: z.number(),
  serviceCharge: z.number(),
  discount: z.number(),
  adjustment: z.number(),
  total: z.number(),
  payerGcashNumber: z.string().nullable(),
});

export type ReceiptSummary = z.infer<typeof ReceiptSummarySchema>;
