import { z } from 'zod';

/**
 * Schema for batch assigning participants to receipt lines
 * Used in: POST /api/line-participants/batch
 */
export const BatchAssignLineParticipantsRequestSchema = z.object({
  receiptId: z.coerce.number().int().positive('Receipt ID must be a positive integer'),
  assignments: z.array(
    z.object({
      receiptLineId: z.coerce.number().int().positive('Receipt line ID must be a positive integer'),
      participantId: z.coerce.number().int().positive('Participant ID must be a positive integer'),
      shareQuantity: z.coerce.number().positive('Share quantity must be positive').default(1),
    })
  ),
});

export type BatchAssignLineParticipantsRequest = z.infer<
  typeof BatchAssignLineParticipantsRequestSchema
>;
