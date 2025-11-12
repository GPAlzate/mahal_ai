import { z } from 'zod';

/**
 * Receipt line type enumeration matching database enum
 */
export type ReceiptLineType = 'PRCH' | 'TAX' | 'TIP' | 'SRVC' | 'DSCT';

/**
 * Zod schema for receipt line type
 */
export const ReceiptLineTypeSchema = z.enum(['PRCH', 'TAX', 'TIP', 'SRVC', 'DSCT']);
