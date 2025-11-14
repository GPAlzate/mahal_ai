import { NextRequest, NextResponse } from 'next/server';
import { receiptService } from '@/lib/services/ReceiptService';
import { receiptSummaryService } from '@/lib/services/ReceiptSummaryService';
import { CreateReceiptRequestSchema } from '@/lib/schemas/receipt/request/CreateReceiptRequest';
import { FindReceiptByShareCodeRequestSchema } from '@/lib/schemas/receipt/request/FindReceiptByShareCodeRequest';

/**
 * Receipts API
 *
 * Implemented:
 * ✅ GET /api/receipts?shareCode=XXXXX - Get receipt summary by share code
 * ✅ GET /api/receipts/[id] - Get receipt metadata
 * ✅ POST /api/receipts - Create new receipt
 * ✅ POST /api/receipts/parse - Parse receipt image (no DB write)
 *
 * Pending:
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

/**
 * POST /api/receipts
 * Create a new receipt with optional parsed data
 *
 * Request body (all fields optional for manual entry):
 * {
 *   merchantName?: string,
 *   receiptDate?: string (YYYY-MM-DD),
 *   receiptLines?: [{description, quantity, unitPrice, totalPrice, receiptLineType}],
 *   currency?: string,
 *   subtotal?: number,
 *   amountDue?: number
 * }
 *
 * Response:
 * {
 *   id: number,
 *   share_code: string,
 *   status: string,
 *   created_at: timestamp
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validation = CreateReceiptRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const requestData = validation.data;

    // Create receipt (with or without parsed data)
    // Check if we have all required fields for ParsedReceipt
    let parsedData = undefined;

    if (
      requestData.receiptLines &&
      requestData.receiptLines.length > 0 &&
      requestData.currency &&
      requestData.subtotal &&
      requestData.amountDue
    ) {
      // All required fields present, create ParsedReceipt object
      parsedData = {
        merchantName: requestData.merchantName ?? null,
        receiptDate: requestData.receiptDate ?? null,
        receiptLines: requestData.receiptLines,
        currency: requestData.currency,
        subtotal: requestData.subtotal,
        amountDue: requestData.amountDue,
      };
    }

    const parsedReceipt = await receiptService.createReceipt(parsedData);

    return NextResponse.json(parsedReceipt, { status: 201 });
  } catch (error) {
    console.error('Error creating receipt:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to create receipt';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
