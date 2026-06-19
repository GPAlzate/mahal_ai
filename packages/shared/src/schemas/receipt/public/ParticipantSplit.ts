import { z } from 'zod';
import { PaymentStatusSchema } from '../../participant/public/PaymentStatus';

/**
 * Schema for a participant's share of a receipt line
 */
export const LineItemSplitSchema = z.object({
  receiptLineId: z.number(),
  itemName: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  shareQuantity: z.number(),
  totalShares: z.number(),
  shareAmount: z.number(),
});

export type LineItemSplit = z.infer<typeof LineItemSplitSchema>;

/**
 * Schema for a participant's breakdown of charges
 */
export const ParticipantSplitSchema = z.object({
  participantId: z.number(),
  displayName: z.string(),
  userId: z.string().nullable(),
  paymentStatus: PaymentStatusSchema.default('PNYP'),
  lineItems: z.array(LineItemSplitSchema),
  subtotal: z.number(),
  taxShare: z.number(),
  tipShare: z.number(),
  serviceChargeShare: z.number(),
  discountShare: z.number(),
  adjustmentShare: z.number(),
  total: z.number(),
});

export type ParticipantSplit = z.infer<typeof ParticipantSplitSchema>;
