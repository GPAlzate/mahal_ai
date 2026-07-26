import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sql } from '@/lib/db';
import { guardReceipt } from '@/lib/server/receiptAuth';
import { receiptSummaryService } from '@/lib/services/ReceiptSummaryService';
import { pushNotificationService } from '@/lib/services/PushNotificationService';

/**
 * PUT /api/receipts/[id]/finalize
 * Finalize a receipt (validates assignments, updates status to FLZD, returns summary)
 *
 * Response: ReceiptSummary
 * {
 *   receipt: Receipt,
 *   participantSplits: ParticipantSplit[],
 *   subtotal: number,
 *   tax: number,
 *   tip: number,
 *   serviceCharge: number,
 *   discount: number,
 *   total: number
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const receiptId = +id;

    if (isNaN(receiptId)) {
      return NextResponse.json({ error: 'Invalid receipt ID' }, { status: 400 });
    }

    const gate = await guardReceipt(request, receiptId, 'write');

    if (!gate.ok) {
      return gate.response;
    }

    // Check if receipt exists. Re-finalizing an already-finalized receipt is
    // allowed: it re-validates assignments and returns a fresh summary.
    const receiptCheck = await sql`
      SELECT id, status FROM receipts
      WHERE id = ${receiptId} AND deleted_at IS NULL
    `;

    if (receiptCheck.length === 0) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }

    // Validate that all purchase lines are assigned to at least one participant
    await receiptSummaryService.validateAllLinesAssigned(receiptId);

    // Update receipt status to finalized
    await sql`
      UPDATE receipts
      SET status = 'FLZD', updated_at = NOW()
      WHERE id = ${receiptId}
    `;

    // Calculate and return summary
    const summary = await receiptSummaryService.calculateSummary(receiptId);

    // "Your total is ready" — only on the first finalization; re-finalizing
    // an already-finalized receipt just refreshes the summary.
    if (receiptCheck[0].status !== 'FLZD') {
      const { userId } = await auth();
      after(async () => {
        try {
          await pushNotificationService.notifyTotalsReady({
            splits: summary.participantSplits.map((s) => ({
              participantId: s.participantId,
              total: s.total,
            })),
            receiptTitle: summary.receipt.title ?? null,
            shareCode: summary.receipt.shareCode,
            payerParticipantId: summary.receipt.payerParticipantId ?? null,
            excludeUserId: userId,
          });
        } catch (error) {
          console.error('Failed to send totals-ready notifications:', error);
        }
      });
    }

    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    console.error('Error finalizing receipt:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to finalize receipt';

    const status = errorMessage.includes('not found')
      ? 404
      : errorMessage.includes('not assigned')
        ? 400
        : 500;

    return NextResponse.json({ error: errorMessage }, { status });
  }
}
