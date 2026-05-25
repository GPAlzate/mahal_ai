import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sql } from '@/lib/db';
import { participantService } from '@/lib/services/ParticipantService';
import { toParticipant, toParticipantDTO } from '@/lib/schemas/participant/dto/ParticipantDTO';
import { PaymentStatusSchema } from '@/lib/schemas/participant/public/PaymentStatus';

async function markPaid(receiptId: number, participantId: number) {
  const updated = await sql`
    WITH upd AS (
      UPDATE participants
      SET payment_status = 'PAID', updated_at = NOW()
      WHERE id = ${participantId} AND receipt_id = ${receiptId} AND deleted_at IS NULL
      RETURNING *
    ),
    remaining AS (
      SELECT id FROM participants
      WHERE receipt_id = ${receiptId} AND deleted_at IS NULL AND payment_status != 'PAID'
        AND id != ${participantId}
    )
    SELECT upd.*, (SELECT COUNT(*) FROM remaining) AS unpaid_count FROM upd
  `;

  if (updated.length === 0) {
    return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
  }

  if (Number(updated[0].unpaid_count) === 0) {
    await sql`UPDATE receipts SET status = 'STLD', updated_at = NOW() WHERE id = ${receiptId}`;
  }

  return NextResponse.json(toParticipant(toParticipantDTO(updated[0])), { status: 200 });
}

/**
 * PATCH /api/receipts/[id]/participants/[participantId]/payment-status
 *
 * Update a participant's payment status.
 *
 * - Setting PCIP: no auth required (participant self-reporting GCash tap)
 * - Setting PAID: requires auth; caller must be the receipt owner or the payer participant
 *   If the payer has no linked account, PCIP skips straight to PAID (no one can confirm).
 *
 * Request body: { status: PaymentStatus }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; participantId: string }> }
) {
  try {
    const { id, participantId } = await params;
    const receiptId = +id;
    const participantIdNum = +participantId;

    if (isNaN(receiptId) || isNaN(participantIdNum)) {
      return NextResponse.json({ error: 'Invalid receipt ID or participant ID' }, { status: 400 });
    }

    const body = await request.json();
    const validation = PaymentStatusSchema.safeParse(body.status);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid payment status' }, { status: 400 });
    }

    const newStatus = validation.data;

    if (newStatus === 'PAID') {
      const [{ userId }, receiptCheck] = await Promise.all([
        auth(),
        sql`
          SELECT r.owner_id, p.user_id AS payer_user_id
          FROM receipts r
          LEFT JOIN participants p ON p.id = r.payer_participant_id AND p.deleted_at IS NULL
          WHERE r.id = ${receiptId} AND r.deleted_at IS NULL
        `,
      ]);

      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      if (receiptCheck.length === 0) {
        return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
      }

      const { owner_id, payer_user_id } = receiptCheck[0];
      const isAuthorized = userId === owner_id || userId === payer_user_id;

      if (!isAuthorized) {
        return NextResponse.json({ error: 'Only the receipt owner or collector can confirm payments' }, { status: 403 });
      }

      return markPaid(receiptId, participantIdNum);
    }

    if (newStatus === 'PCIP') {
      const receiptCheck = await sql`
        SELECT p.user_id AS payer_user_id
        FROM receipts r
        LEFT JOIN participants p ON p.id = r.payer_participant_id AND p.deleted_at IS NULL
        WHERE r.id = ${receiptId} AND r.deleted_at IS NULL
      `;

      if (receiptCheck.length === 0) {
        return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
      }

      // Payer has no account — no one can confirm, so go straight to PAID
      if (!receiptCheck[0].payer_user_id) {
        return markPaid(receiptId, participantIdNum);
      }
    }

    const participant = await participantService.updatePaymentStatus(
      receiptId,
      participantIdNum,
      newStatus
    );

    return NextResponse.json(participant, { status: 200 });
  } catch (error) {
    console.error('Error updating payment status:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to update payment status';

    const status = errorMessage.includes('not found') ? 404 : 500;

    return NextResponse.json({ error: errorMessage }, { status });
  }
}
