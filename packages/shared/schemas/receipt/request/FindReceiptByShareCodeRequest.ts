import { z } from 'zod';

/**
 * Request schema for finding receipt by share code
 * Used in: GET /api/receipts?shareCode=XXXXX
 */
export const FindReceiptByShareCodeRequestSchema = z.object({
  shareCode: z
    .string()
    .length(5, 'Share code must be exactly 5 characters')
    .regex(/^[A-Za-z0-9]{5}$/, 'Share code must contain only alphanumeric characters'),
});

export type FindReceiptByShareCodeRequest = z.infer<typeof FindReceiptByShareCodeRequestSchema>;
