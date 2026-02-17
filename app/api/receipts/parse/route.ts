import { NextRequest, NextResponse, after } from 'next/server';
import { put } from '@vercel/blob';
import { receiptService } from '@/lib/services/ReceiptService';
import { Logger } from '@/lib/utils/Logger';
import { ReceiptStatusSchema } from '@/lib/schemas/receipt/public/Receipt';

const logger = new Logger('POST /api/receipts/parse');

// Set maximum duration for this route (5 minutes)
// Allows background parsing to complete even after response is sent
export const maxDuration = 300;

/**
 * POST /api/receipts/parse
 * Creates a receipt and starts parsing in the background
 * Returns immediately with receiptId, allowing user to add participants while parsing
 *
 * Request body: FormData with 'image' file field
 *
 * Response:
 * {
 *   receiptId: number,
 *   status: 'PRSP' // Pre-processing/parsing in progress
 * }
 *
 * Images are stored in Vercel Blob with 7-day auto-expiry
 */
export async function POST(request: NextRequest) {
  try {
    logger.log('Received receipt parse request');

    // Parse FormData
    const formData = await request.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      );
    }

    // Upload to Vercel Blob
    // TODO: parellelize receipt upload and receipt creation
    console.time('Vercel Receipt Upload')
    logger.log(`Uploading image: ${file.name} (${file.size} bytes)`);
    const blob = await put(`receipts/${Date.now()}-${file.name}`, file, {
      access: 'public',
      addRandomSuffix: true,
    });
    console.timeEnd('Vercel Receipt Upload')
    logger.log(`Image uploaded to Blob: ${blob.url}`);

    // Create receipt with image URI and status='PRSP'
    logger.log('Creating receipt with status=PRSP');
    const receipt = await receiptService.createReceipt({
      imageURI: blob.url,
      status: ReceiptStatusSchema.enum.PRSP,
    });

    // Schedule background parsing using after()
    // This extends the serverless function lifetime until parsing completes
    after(async () => {
      try {
        logger.log(`[Receipt ${receipt.id}] Starting background parsing`);
        await receiptService.parseInBackground(receipt.id, blob.url);
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

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
