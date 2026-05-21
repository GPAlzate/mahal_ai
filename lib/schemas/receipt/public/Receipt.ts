import { ReceiptLineSchema } from '@/lib/schemas/receipt/public/ReceiptLine';
import { z } from 'zod';

/**
 * Receipt status enumeration matching database enum
 */
export const ReceiptStatusSchema = z.enum(['ULIP', 'PRSP', 'DRFT', 'FLZD', 'STLD', 'DLTD']);

export type ReceiptStatus = z.infer<typeof ReceiptStatusSchema>;

/**
 * Schema for Receipt database entity
 * Represents a row from the receipts table
 *
 * Optional fields:
 * - lines: Array of receipt lines. Only populated when explicitly requested
 *   (e.g., GET /api/receipts/[id]?includeLines=true or via share code)
 */
export const ReceiptSchema = z.object({
  id: z.number(),
  shareCode: z.string(),
  status: ReceiptStatusSchema,
  title: z.string().nullable(),
  ownerId: z.string().nullable().optional(),
  payerParticipantId: z.number().nullable().optional(),
  receiptTime: z.date(),
  imageURI: z.string().nullable().optional(),
  scannedSubtotal: z.number().nullable(),
  scannedTotal: z.number().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
  lines: z.array(ReceiptLineSchema).optional(),
});

export type Receipt = z.infer<typeof ReceiptSchema>;
