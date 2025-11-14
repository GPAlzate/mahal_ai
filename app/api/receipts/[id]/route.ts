import { NextRequest, NextResponse } from 'next/server';
import { receiptService } from '@/lib/services/ReceiptService';

/**
 * GET /api/receipts/[id]?includeLines=true
 * Get receipt metadata by ID, optionally with lines
 *
 * Query params:
 * - includeLines: boolean (optional, default: false)
 *
 * Response: Receipt
 * {
 *   id: number,
 *   share_code: string,
 *   status: "PRSP" | "DRFT" | "FLZD" | "DLTD",
 *   created_at: timestamp,
 *   updated_at: timestamp,
 *   deleted_at: timestamp | null,
 *   lines?: ReceiptLine[] (if includeLines=true)
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

    // Extract includeLines query parameter
    const { searchParams } = new URL(request.url);
    const includeLines = searchParams.get('includeLines') === 'true';

    const receipt = await receiptService.getReceipt(receiptId, includeLines);

    return NextResponse.json(receipt, { status: 200 });
  } catch (error) {
    console.error('Error getting receipt:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to get receipt';

    const status = errorMessage.includes('not found') ? 404 : 500;

    return NextResponse.json({ error: errorMessage }, { status });
  }
}
