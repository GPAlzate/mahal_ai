import { NextRequest, NextResponse } from 'next/server';
import { receiptService } from '@/lib/services/ReceiptService';
import { ReceiptStatusSchema } from '@/lib/schemas/receipt/public/Receipt';

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
 *   status: "ULIP" | "PRSP" | "DRFT" | "FLZD" | "DLTD",
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

/**
 * PATCH /api/receipts/[id]
 * Update receipt status. Used by the client to mark a receipt DLTD when
 * the blob upload or parse trigger fails before the server can detect it.
 *
 * Request body: { status: ReceiptStatus }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const receiptId = +id;

    if (isNaN(receiptId)) {
      return NextResponse.json({ error: 'Invalid receipt ID' }, { status: 400 });
    }

    const body = await request.json();

    if (body.title !== undefined) {
      if (body.title !== null && typeof body.title !== 'string') {
        return NextResponse.json({ error: 'Invalid title value' }, { status: 400 });
      }
      const receipt = await receiptService.updateTitle(receiptId, body.title ?? null);
      return NextResponse.json(receipt, { status: 200 });
    }

    if (body.gcashNumber !== undefined) {
      const val = body.gcashNumber === null ? null : String(body.gcashNumber);
      const receipt = await receiptService.updateGcashNumber(receiptId, val);
      return NextResponse.json(receipt, { status: 200 });
    }

    if (body.payerParticipantId !== undefined) {
      if (typeof body.payerParticipantId !== 'number') {
        return NextResponse.json({ error: 'Invalid payerParticipantId value' }, { status: 400 });
      }
      const receipt = await receiptService.updatePayerParticipant(receiptId, body.payerParticipantId);
      return NextResponse.json(receipt, { status: 200 });
    }

    const parsed = ReceiptStatusSchema.safeParse(body.status);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    if (parsed.data === 'DLTD') {
      await receiptService.deleteReceipt(receiptId);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (parsed.data === 'STLD') {
      const receipt = await receiptService.settleReceipt(receiptId);
      return NextResponse.json(receipt, { status: 200 });
    }

    const receipt = await receiptService.updateStatus(receiptId, parsed.data);

    return NextResponse.json(receipt, { status: 200 });
  } catch (error) {
    console.error('Error updating receipt status:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to update receipt';
    const status = errorMessage.includes('not found') ? 404 : 500;

    return NextResponse.json({ error: errorMessage }, { status });
  }
}
