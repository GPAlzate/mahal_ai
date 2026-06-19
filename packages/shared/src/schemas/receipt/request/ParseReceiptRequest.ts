import { z } from 'zod';

/**
 * Schema for POST /api/receipts/parse request
 * Validates incoming receipt image upload
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
