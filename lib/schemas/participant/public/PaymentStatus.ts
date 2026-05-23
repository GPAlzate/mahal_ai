import { z } from 'zod';

/**
 * Payment status for a participant on a finalized receipt.
 * Tracks manual GCash payment confirmation flow.
 *
 * PNYP → participant not yet paid
 * PCIP → payment confirmation in progress (participant paid, owner has been notified, awaiting manual confirmation)
 * PAID → receipt owner confirmed payment received
 */
export type PaymentStatus = 'PNYP' | 'PCIP' | 'PAID';

export const PaymentStatusSchema = z.enum(['PNYP', 'PCIP', 'PAID']);
