import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { callerKey, rateLimit } from '@/lib/server/rateLimit';
import { receiptService } from '@/lib/services/ReceiptService';
import { FindReceiptByShareCodeRequestSchema } from '@/lib/schemas/receipt/request/FindReceiptByShareCodeRequest';
import { CreateReceiptRequestSchema } from '@/lib/schemas/receipt/request/CreateReceiptRequest';

/**
 * Receipts API
 *
 * Implemented:
 * ✅ GET /api/receipts?shareCode=XXXXX - Get receipt summary by share code
 * ✅ POST /api/receipts/parse - Parse receipt image and create receipt
 * ✅ POST /api/receipts - Manual receipt entry (create receipt without image)
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
    // This endpoint trades a share code for a full receipt, so it is the one
    // place a guessed code pays off. Cap the guess rate.
    const limited = rateLimit(`receipts:byShareCode:${callerKey(request)}`, 20, 60_000);

    if (limited) {
      return limited;
    }

    const { searchParams } = new URL(request.url);
    const shareCode = searchParams.get('shareCode');

    // Validate query params with Zod
    const validation = FindReceiptByShareCodeRequestSchema.safeParse({ shareCode });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: z.flattenError(validation.error) },
        { status: 400 }
      );
    }

    const { shareCode: validatedShareCode } = validation.data;

    const receipt = await receiptService.findReceiptByShareCode(validatedShareCode);

    return NextResponse.json(receipt, { status: 200 });
  } catch (error) {
    console.error('Error getting receipt by share code:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to get receipt';

    const status = errorMessage.includes('not found') ? 404 : 500;

    return NextResponse.json({ error: errorMessage }, { status });
  }
}

/**
 * POST /api/receipts
 * Create a manual receipt (without image)
 *
 * Request body:
 * {
 *   title?: string,
 *   receiptTime?: string (YYYY-MM-DD or ISO timestamp)
 * }
 *
 * Response:
 * {
 *   receiptId: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Creation is open to anonymous users, so it needs a ceiling of its own.
    const limited = rateLimit(`receipts:create:${callerKey(request)}`, 30, 60_000);

    if (limited) {
      return limited;
    }

    const body = await request.json();

    // Validate request body
    const createReceiptRequest = CreateReceiptRequestSchema.safeParse(body);

    if (!createReceiptRequest.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: z.flattenError(createReceiptRequest.error) },
        { status: 400 }
      );
    }

    const { userId } = await auth();
    const { receipt } = await receiptService.createReceipt({ ...createReceiptRequest.data, ownerId: userId ?? null });

    // The share code goes back to the creator so the rest of the creation flow
    // (attach image, add participants, edit lines) can authorize itself even
    // when the creator is not signed in.
    return NextResponse.json(
      { receiptId: receipt.id, shareCode: receipt.shareCode },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating manual receipt:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to create receipt';

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

