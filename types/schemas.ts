import { z } from "zod";

// Enum schemas matching database enums
export const ReceiptLineTypeSchema = z.enum(['PRCH', 'TAX', 'TIP', 'SRVC', 'DSCT']);
export type ReceiptLineType = z.infer<typeof ReceiptLineTypeSchema>;

export const ReceiptStatusSchema = z.enum(['PINP', 'DRFT', 'FLZD', 'DLTD']);
export type ReceiptStatus = z.infer<typeof ReceiptStatusSchema>;

// Base schemas for database tables
export const ParticipantSchema = z.object({
  id: z.number().optional(),
  receipt_id: z.number(),
  display_name: z.string().min(1, "Name is required"),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
  deleted_at: z.date().nullable().optional(),
});
export type Participant = z.infer<typeof ParticipantSchema>;

export const ReceiptLineSchema = z.object({
  id: z.number().optional(),
  receipt_id: z.number(),
  line_type: ReceiptLineTypeSchema.default('PRCH'),
  item_name: z.string().min(1, "Item name is required"),
  unit_price: z.number().positive("Price must be positive"),
  quantity: z.number().positive("Quantity must be positive"),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
  deleted_at: z.date().nullable().optional(),
});
export type ReceiptLine = z.infer<typeof ReceiptLineSchema>;

export const LineParticipantSchema = z.object({
  receipt_line_id: z.number(),
  participant_id: z.number(),
  share_quantity: z.number().positive("Share quantity must be positive").default(1),
});
export type LineParticipant = z.infer<typeof LineParticipantSchema>;

export const ReceiptSchema = z.object({
  id: z.number().optional(),
  share_code: z.string().length(5, "Share code must be 5 characters").nullable().optional(),
  status: ReceiptStatusSchema.default('DRFT'),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
  deleted_at: z.date().nullable().optional(),
});
export type Receipt = z.infer<typeof ReceiptSchema>;

// API Request/Response schemas
export const CreateParticipantRequestSchema = z.object({
  display_name: z.string().min(1, "Name is required").max(100, "Name too long"),
});

export const CreateReceiptLineRequestSchema = z.object({
  line_type: ReceiptLineTypeSchema,
  item_name: z.string().min(1, "Item name is required").max(200, "Name too long"),
  unit_price: z.number().positive("Price must be positive"),
  quantity: z.number().positive("Quantity must be positive"),
});

export const AssignLineParticipantRequestSchema = z.object({
  receipt_line_id: z.number(),
  participant_id: z.number(),
  share_quantity: z.number().positive("Share quantity must be positive").default(1),
});

// Complete receipt creation schema
export const CreateReceiptRequestSchema = z.object({
  participants: z.array(CreateParticipantRequestSchema).min(1, "At least one participant required"),
  receipt_lines: z.array(CreateReceiptLineRequestSchema).min(1, "At least one item required"),
  line_assignments: z.array(AssignLineParticipantRequestSchema),
});

// OpenAI Vision API response schema
export const ParsedReceiptItemSchema = z.object({
  item_name: z.string(),
  unit_price: z.number(),
  quantity: z.number(),
});

export const ParsedReceiptSchema = z.object({
  items: z.array(ParsedReceiptItemSchema),
  subtotal: z.number().optional(),
  tax: z.number().optional(),
  tip: z.number().optional(),
  service_charge: z.number().optional(),
  discount: z.number().optional(),
  total: z.number().optional(),
  merchant: z.string().optional(),
  date: z.string().optional(),
});
export type ParsedReceipt = z.infer<typeof ParsedReceiptSchema>;

// Receipt summary for display
export const ParticipantSummarySchema = z.object({
  participant_id: z.number(),
  display_name: z.string(),
  items: z.array(z.object({
    item_name: z.string(),
    unit_price: z.number(),
    share_quantity: z.number(),
    subtotal: z.number(),
  })),
  subtotal: z.number(),
  tax: z.number(),
  tip: z.number(),
  service_charge: z.number(),
  discount: z.number(),
  total: z.number(),
});
export type ParticipantSummary = z.infer<typeof ParticipantSummarySchema>;

export const ReceiptSummarySchema = z.object({
  share_code: z.string(),
  status: ReceiptStatusSchema,
  participants: z.array(ParticipantSummarySchema),
  grand_total: z.number(),
});
export type ReceiptSummary = z.infer<typeof ReceiptSummarySchema>;
