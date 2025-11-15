import { NextRequest, NextResponse } from 'next/server';
import { receiptSummaryService } from '@/lib/services/ReceiptSummaryService';
import { FindReceiptByShareCodeRequestSchema } from '@/lib/schemas/receipt/request/FindReceiptByShareCodeRequest';

/**
 * Receipts API
 *
 * Implemented:
 * ✅ GET /api/receipts?shareCode=XXXXX - Get receipt summary by share code
 * ✅ POST /api/receipts/parse - Parse receipt image and create receipt
 *
 * Pending:
 * ⏳ POST /api/receipts - Manual receipt entry (create receipt without image)
 * ⏳ PUT /api/receipts/[id] - Update receipt (merchant name, date, currency, etc.)
 * ⏳ DELETE /api/receipts/[id] - Delete/archive entire receipt
 */

/**
 * GET /api/receipts?shareCode=XXXXX
 * Get receipt summary by share code (public access)
 *
 * Query params:
 * - shareCode: 5-character alphanumeric code
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
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shareCode = searchParams.get('shareCode');

    // Validate query params with Zod
    const validation = FindReceiptByShareCodeRequestSchema.safeParse({ shareCode });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { shareCode: validatedShareCode } = validation.data;

    const summary = await receiptSummaryService.calculateSummaryByShareCode(validatedShareCode);

    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    console.error('Error getting receipt by share code:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to get receipt';

    const status = errorMessage.includes('not found') ? 404 : 500;

    return NextResponse.json({ error: errorMessage }, { status });
  }
}

