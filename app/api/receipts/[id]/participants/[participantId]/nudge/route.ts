import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sql } from '@/lib/db';
import { pushNotificationService } from '@/lib/services/PushNotificationService';
import { receiptSummaryService } from '@/lib/services/ReceiptSummaryService';

const NUDGE_COOLDOWN_HOURS = 12;

/**
 * POST /api/receipts/[id]/participants/[participantId]/nudge
 * Send a push to an unpaid participant.
 *
 * Rules:
 * - Caller must be the receipt owner or the payer (the person collecting)
 * - Target must be unpaid and not the payer
 * - One nudge per (receipt, target) per 12h, server-enforced
 *
 * Response: { delivered: number, nextNudgeAt: string }
 * delivered is 0 when the target has no subscribed devices.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; participantId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, participantId } = await params;
    const receiptId = +id;
    const targetId = +participantId;

    if (isNaN(receiptId) || isNaN(targetId)) {
      return NextResponse.json({ error: 'Invalid IDs' }, { status: 400 });
    }

    const rows = await sql`
      SELECT
        r.title,
        r.share_code,
        r.status,
        r.owner_id,
        r.payer_participant_id,
        payer.user_id AS payer_user_id,
        target.id AS target_id,
        target.payment_status AS target_payment_status,
        (
          SELECT MAX(n.created_at) FROM nudges n
          WHERE n.receipt_id = r.id AND n.participant_id = target.id
        ) AS last_nudged_at
      FROM receipts r
      LEFT JOIN participants payer ON payer.id = r.payer_participant_id AND payer.deleted_at IS NULL
      LEFT JOIN participants target ON target.id = ${targetId} AND target.receipt_id = r.id AND target.deleted_at IS NULL
      WHERE r.id = ${receiptId} AND r.deleted_at IS NULL
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }

    const receipt = rows[0];

    if (!receipt.target_id) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    const isCollector = userId === receipt.owner_id || userId === receipt.payer_user_id;
    if (!isCollector) {
      return NextResponse.json(
        { error: 'Only the receipt owner or collector can nudge' },
        { status: 403 }
      );
    }

    if (receipt.status === 'STLD') {
      return NextResponse.json({ error: 'Receipt is already settled' }, { status: 409 });
    }

    if (Number(receipt.payer_participant_id) === targetId) {
      return NextResponse.json({ error: 'The payer cannot be nudged' }, { status: 409 });
    }

    if (receipt.target_payment_status === 'PAID') {
      return NextResponse.json({ error: 'Participant already paid' }, { status: 409 });
    }

    if (receipt.last_nudged_at) {
      const nextNudgeAt = new Date(
        new Date(receipt.last_nudged_at).getTime() + NUDGE_COOLDOWN_HOURS * 60 * 60 * 1000
      );
      if (nextNudgeAt.getTime() > Date.now()) {
        return NextResponse.json(
          { error: 'Already nudged recently', nextNudgeAt: nextNudgeAt.toISOString() },
          { status: 429 }
        );
      }
    }

    let amount: number | null = null;
    try {
      const summary = await receiptSummaryService.calculateSummary(receiptId);
      amount = summary.participantSplits.find((s) => s.participantId === targetId)?.total ?? null;
    } catch {
      // Amount is nice-to-have; nudge still goes out without it
    }

    const senderName = await pushNotificationService.resolveActorName(receiptId, userId);

    await sql`
      INSERT INTO nudges (receipt_id, participant_id, sender_user_id)
      VALUES (${receiptId}, ${targetId}, ${userId})
    `;

    const delivered = await pushNotificationService.notifyNudge({
      targetParticipantId: targetId,
      senderName,
      amount,
      receiptTitle: receipt.title,
      shareCode: receipt.share_code,
    });

    const nextNudgeAt = new Date(Date.now() + NUDGE_COOLDOWN_HOURS * 60 * 60 * 1000);

    return NextResponse.json(
      { delivered, nextNudgeAt: nextNudgeAt.toISOString() },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error sending nudge:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to send nudge';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
