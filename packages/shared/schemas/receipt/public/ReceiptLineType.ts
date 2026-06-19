import { z } from 'zod';

/**
 * Receipt line type enumeration matching database enum.
 * NOTE: 'TAX' is deprecated — kept for backwards compatibility with existing receipts.
 * New receipts will not produce TAX lines; use DSCT for tax exemptions, DADJ for adjustments.
 */
export type ReceiptLineType = 'PRCH' | 'TAX' | 'TIP' | 'SRVC' | 'DSCT' | 'DADJ';

/** @see ReceiptLineType */
export const ReceiptLineTypeSchema = z.enum(['PRCH', 'TAX', 'TIP', 'SRVC', 'DSCT', 'DADJ']);
