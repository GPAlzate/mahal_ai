import { z } from 'zod';

/**
 * Receipt status enumeration matching database enum
 */
export const ReceiptStatusSchema = z.enum(['PRSP', 'DRFT', 'FLZD', 'DLTD']);

export type ReceiptStatus = z.infer<typeof ReceiptStatusSchema>;

/**
 * Schema for Receipt database entity
 * Represents a row from the receipts table
 */
export const ReceiptSchema = z.object({
  id: z.number(),
  share_code: z.string(),
  status: ReceiptStatusSchema,
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullable(),
});

export type Receipt = z.infer<typeof ReceiptSchema>;
