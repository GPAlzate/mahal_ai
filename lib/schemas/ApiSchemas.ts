import { z } from 'zod';

/**
 * Schema for POST /api/receipts/parse
 * Parse a receipt image and return structured data
 */
export const ParseReceiptRequestSchema = z.object({
  imageBase64: z
    .string()
    .regex(
      /^data:image\/(jpeg|jpg|png|webp|gif);base64,/,
      'Image must be a valid Base64 data URI with supported format (jpeg, jpg, png, webp, gif)'
    ),
});

export type ParseReceiptRequest = z.infer<typeof ParseReceiptRequestSchema>;

/**
 * Schema for receipt line types
 */
export const ReceiptLineTypeSchema = z.enum(['PRCH', 'TAX', 'TIP', 'SRVC', 'DSCT']);

/**
 * Schema for a receipt line
 */
export const ReceiptLineSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().positive('Quantity must be positive'),
  unitPrice: z.number({ invalid_type_error: 'Unit price must be a number' }),
  totalPrice: z.number({ invalid_type_error: 'Total price must be a number' }),
  receiptLineType: ReceiptLineTypeSchema,
});

/**
 * Schema for POST /api/receipts
 * Create a receipt with optional parsed data
 */
export const CreateReceiptRequestSchema = z.object({
  merchantName: z.string().optional(),
  receiptDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  receiptLines: z.array(ReceiptLineSchema).optional(),
  currency: z.string().optional(),
  subtotal: z.number().nonnegative().optional(),
  amountDue: z.number().nonnegative().optional(),
});

export type CreateReceiptRequest = z.infer<typeof CreateReceiptRequestSchema>;
