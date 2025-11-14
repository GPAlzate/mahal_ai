import { NextRequest, NextResponse } from 'next/server';
import { receiptService } from '@/lib/services/ReceiptService';
import { ParseReceiptRequestSchema } from '@/lib/schemas/receipt/request/ParseReceiptRequest';
import { Logger } from '@/lib/utils/Logger';

const logger = new Logger('POST /api/receipts/parse');

/**
 * POST /api/receipts/parse
 * Creates a receipt and starts parsing in the background
 * Returns immediately with receiptId, allowing user to add participants while parsing
 *
 * Request body:
 * {
 *   imageBase64: string // Base64 data URI (e.g., "data:image/jpeg;base64,...")
 * }
 *
 * Response:
 * {
 *   receiptId: number,
 *   status: 'PRSP' // Pre-processing/parsing in progress
 * }
 *
 * TODO: Add image storage for finalized receipts
 * Currently images are only used for parsing and then discarded.
 * Future: Store imageBase64 in DB when receipt is finalized (status -> FLZD)
 * Consider migrating to Vercel Blob for better scalability.
 */
export async function POST(request: NextRequest) {
  try {
    logger.log('Received receipt parse request');

    const body = await request.json();

    // Validate request body
    const validation = ParseReceiptRequestSchema.safeParse(body);

    if (!validation.success) {
      logger.warn('Invalid request body:', validation.error.flatten());
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { imageBase64 } = validation.data;

    // Create receipt with status='PRSP' (pre-processing/parsing)
    logger.log('Creating receipt with status=PRSP');
    const receipt = await receiptService.createReceipt();

    // Update status to PRSP
    await receiptService.updateStatus(receipt.id, 'PRSP');

    // Fire off background parsing (don't await!)
    receiptService.parseInBackground(receipt.id, imageBase64).catch((err) => {
      logger.error(`Background parsing promise rejected for receipt ${receipt.id}:`, err);
    });

    logger.log(`Receipt ${receipt.id} created, parsing in background`);
    return NextResponse.json({ receiptId: receipt.id, status: 'PRSP' }, { status: 201 });
  } catch (error) {
    logger.error('Error creating receipt:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to create receipt';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
