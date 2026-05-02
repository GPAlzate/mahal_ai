import { NextRequest, NextResponse, after } from 'next/server';
import { receiptService } from '@/lib/services/ReceiptService';
import { getBlobBaseURL } from '@/lib/env';
import { Logger } from '@/lib/utils/Logger';

const logger = new Logger('POST /api/receipts/[id]/parse');

// Allow enough time for the background parsing to complete
export const maxDuration = 300;

/**
 * POST /api/receipts/{id}/parse
 * Attaches an image URL to an existing receipt and triggers background AI parsing.
 *
 * Used by the "optimistic navigation" flow: the client creates the receipt first
 * (via POST /api/receipts/parse with no imageUrl), navigates to the participants
 * page, then calls this endpoint once the Vercel Blob upload finishes.
 *
 * Request body: { imageUrl: string }
 * Response: { status: "PRSP" }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const receiptId = parseInt(id, 10);

    if (isNaN(receiptId)) {
      return NextResponse.json({ error: 'Invalid receipt ID' }, { status: 400 });
    }

    const body = await request.json();
    if (!body.imageUrl) {
      return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 });
    }

    const imageUrl: string = body.imageUrl;
    const blobBaseURL = getBlobBaseURL();
    if (!imageUrl.startsWith(blobBaseURL + '/')) {
      return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 });
    }

    logger.log(`[Receipt ${receiptId}] Attaching image and scheduling parse: ${imageUrl}`);

    // Persist the image URI and advance status ULIP → PRSP now that the blob is ready.
    await receiptService.attachImageURI(receiptId, imageUrl);
    await receiptService.updateStatus(receiptId, 'PRSP');

    // Schedule background parsing
    after(async () => {
      try {
        logger.log(`[Receipt ${receiptId}] Starting background parsing`);
        await receiptService.parseInBackground(receiptId, imageUrl);
        logger.log(`[Receipt ${receiptId}] Background parsing completed`);
      } catch (err) {
        logger.error(`[Receipt ${receiptId}] Background parsing failed:`, err);
      }
    });

    return NextResponse.json({ status: 'PRSP' }, { status: 200 });
  } catch (error) {
    logger.error('Error attaching image to receipt:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to trigger parse';
    const status = errorMessage.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: errorMessage }, { status });
  }
}
