import { NextRequest, NextResponse } from 'next/server';
import { receiptSummaryService } from '@/lib/services/ReceiptSummaryService';

/**
 * GET /api/receipts/[id]/summary
 * Get receipt summary with participant splits
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
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const receiptId = +id;

    if (isNaN(receiptId)) {
      return NextResponse.json({ error: 'Invalid receipt ID' }, { status: 400 });
    }

    const summary = await receiptSummaryService.calculateSummary(receiptId);

    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    console.error('Error getting receipt summary:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to get receipt summary';

    const status = errorMessage.includes('not found') ? 404 : 500;

    return NextResponse.json({ error: errorMessage }, { status });
  }
}
