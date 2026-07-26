import { NextRequest, NextResponse } from 'next/server';
import { guardReceipt } from '@/lib/server/receiptAuth';
import { receiptLineService } from '@/lib/services/ReceiptLineService';
import { CreateReceiptLineRequestSchema } from '@/lib/schemas/receipt/request/CreateReceiptLineRequest';

/**
 * GET /api/receipts/[id]/lines
 * Get all receipt lines for a receipt
 *
 * Response:
 * [
 *   {
 *     id: number,
 *     receiptId: number,
 *     itemName: string,
 *     quantity: number,
 *     unitPrice: number,
 *     totalPrice: number,
 *     receiptLineType: string,
 *     createdAt: timestamp,
 *     updatedAt: timestamp,
 *     deletedAt: timestamp | null
 *   }
 * ]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const receiptId = parseInt(id, 10);

    if (isNaN(receiptId)) {
      return NextResponse.json({ error: 'Invalid receipt ID' }, { status: 400 });
    }

    const gate = await guardReceipt(request, receiptId, 'read');

    if (!gate.ok) {
      return gate.response;
    }

    const lines = await receiptLineService.getReceiptLines(receiptId);

    return NextResponse.json(lines, { status: 200 });
  } catch (error) {
    console.error('Error fetching receipt lines:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch receipt lines';

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * POST /api/receipts/[id]/lines
 * Add a new receipt line
 *
 * Request body:
 * {
 *   itemName: string,
 *   quantity: number,
 *   unitPrice: number,
 *   totalPrice: number,
 *   receiptLineType: 'PRCH' | 'TAX' | 'TIP' | 'SRVC' | 'DSCT'
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
export async function POST(
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

    const body = await request.json();

    // Validate request body
    const validation = CreateReceiptLineRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const line = await receiptLineService.createReceiptLine(receiptId, validation.data);

    return NextResponse.json(line, { status: 201 });
  } catch (error) {
    console.error('Error creating receipt line:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to create receipt line';

    const status = errorMessage.includes('not found') ? 404 : errorMessage.includes('Cannot modify') ? 403 : 500;

    return NextResponse.json({ error: errorMessage }, { status });
  }
}
