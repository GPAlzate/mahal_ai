import { z } from 'zod';

/**
 * Payment status for a participant on a finalized receipt.
 * Tracks manual GCash payment confirmation flow.
 *
 * PNYP → participant not yet paid
 * PMIP → payment in progress (participant tapped the GCash deeplink)
 * PCIP → payment confirmation in progress (owner has been notified, awaiting manual confirmation)
 * PAID → receipt owner confirmed payment received
 */
export type PaymentStatus = 'PNYP' | 'PMIP' | 'PCIP' | 'PAID';

export const PaymentStatusSchema = z.enum(['PNYP', 'PMIP', 'PCIP', 'PAID']);
