import { NextRequest, NextResponse } from 'next/server';
import { guardReceipt } from '@/lib/server/receiptAuth';
import { receiptLineService } from '@/lib/services/ReceiptLineService';
import { UpdateReceiptLineRequestSchema } from '@/lib/schemas/receipt/request/UpdateReceiptLineRequest';

/**
 * PUT /api/receipts/[id]/lines/[lineId]
 * Update a receipt line (partial update)
 *
 * Request body (all fields optional):
 * {
 *   itemName?: string,
 *   quantity?: number,
 *   unitPrice?: number,
 *   totalPrice?: number,
 *   receiptLineType?: 'PRCH' | 'TAX' | 'TIP' | 'SRVC' | 'DSCT'
 * }
 *
 * Response:
 * {
 *   id: number,
 *   receiptId: number,
 *   itemName: string,
 *   quantity: number,
 *   unitPrice: number,
 *   totalPrice: number,
 *   receiptLineType: string,
 *   createdAt: timestamp,
 *   updatedAt: timestamp,
 *   deletedAt: timestamp | null
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  try {
    const { id, lineId } = await params;
    const receiptId = +id;
    const lineIdNum = +lineId;

    if (isNaN(receiptId) || isNaN(lineIdNum)) {
      return NextResponse.json({ error: 'Invalid receipt ID or line ID' }, { status: 400 });
    }

    const gate = await guardReceipt(request, receiptId, 'write');

    if (!gate.ok) {
      return gate.response;
    }

    const body = await request.json();

    // Validate request body
    const validation = UpdateReceiptLineRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const line = await receiptLineService.updateReceiptLine(
      receiptId,
      lineIdNum,
      validation.data
    );

    return NextResponse.json(line, { status: 200 });
  } catch (error) {
    console.error('Error updating receipt line:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to update receipt line';

    const status = errorMessage.includes('not found')
      ? 404
      : errorMessage.includes('Cannot modify')
        ? 403
        : errorMessage.includes('No fields')
          ? 400
          : 500;

    return NextResponse.json({ error: errorMessage }, { status });
  }
}

/**
 * DELETE /api/receipts/[id]/lines/[lineId]
 * Soft delete a receipt line
 *
 * Response:
 * {
 *   id: number,
 *   receiptId: number,
 *   itemName: string,
 *   quantity: number,
 *   unitPrice: number,
 *   totalPrice: number,
 *   receiptLineType: string,
 *   createdAt: timestamp,
 *   updatedAt: timestamp,
 *   deletedAt: timestamp
 * }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  try {
    const { id, lineId } = await params;
    const receiptId = parseInt(id, 10);
    const lineIdNum = parseInt(lineId, 10);

    if (isNaN(receiptId) || isNaN(lineIdNum)) {
      return NextResponse.json({ error: 'Invalid receipt ID or line ID' }, { status: 400 });
    }

    const gate = await guardReceipt(request, receiptId, 'write');

    if (!gate.ok) {
      return gate.response;
    }

    const line = await receiptLineService.deleteReceiptLine(receiptId, lineIdNum);

    return NextResponse.json(line, { status: 200 });
  } catch (error) {
    console.error('Error deleting receipt line:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to delete receipt line';

    const status = errorMessage.includes('not found') ? 404 : errorMessage.includes('Cannot modify') ? 403 : 500;

    return NextResponse.json({ error: errorMessage }, { status });
  }
}
