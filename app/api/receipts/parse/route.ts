import { NextRequest, NextResponse, after } from 'next/server';
import { receiptService } from '@/lib/services/ReceiptService';
import { Logger } from '@/lib/utils/Logger';
import { ReceiptStatusSchema } from '@/lib/schemas/receipt/public/Receipt';

const logger = new Logger('POST /api/receipts/parse');

// Set maximum duration for this route (5 minutes)
// Allows background parsing to complete even after response is sent
export const maxDuration = 300;

/**
 * POST /api/receipts/parse
 * Creates a receipt and starts parsing in the background.
 * Returns immediately with receiptId.
 *
 * Request body: JSON { imageUrl: string }
 * The image must already be uploaded to Vercel Blob by the client using /api/blob-upload.
 */
export async function POST(request: NextRequest) {
  try {
    logger.log('Received receipt parse request');

    const body = await request.json();
    if (!body.imageUrl) {
      return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 });
    }

    const imageUrl: string = body.imageUrl;
    logger.log(`Using client-uploaded image: ${imageUrl}`);

    // Create receipt with image URI and status='PRSP'
    logger.log('Creating receipt with status=PRSP');
    console.time('🕐 [parse] create receipt in DB');
    const receipt = await receiptService.createReceipt({
      imageURI: imageUrl,
      status: ReceiptStatusSchema.enum.PRSP,
    });
    console.timeEnd('🕐 [parse] create receipt in DB');

    // Schedule background parsing using after()
    after(async () => {
      try {
        logger.log(`[Receipt ${receipt.id}] Starting background parsing`);
        await receiptService.parseInBackground(receipt.id, imageUrl);
        logger.log(`[Receipt ${receipt.id}] Background parsing completed successfully`);
      } catch (err) {
        logger.error(`[Receipt ${receipt.id}] Background parsing failed:`, err);
      }
    });

    logger.log(`Receipt ${receipt.id} created, parsing scheduled in background`);
    return NextResponse.json({ receiptId: receipt.id, status: 'PRSP' }, { status: 201 });
  } catch (error) {
    logger.error('Error creating receipt:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create receipt';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
