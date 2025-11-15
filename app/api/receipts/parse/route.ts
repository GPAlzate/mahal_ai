import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { receiptService } from '@/lib/services/ReceiptService';
import { Logger } from '@/lib/utils/Logger';

const logger = new Logger('POST /api/receipts/parse');

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
    const receipt = await receiptService.createReceipt(blob.url);

    // Update status to PRSP
    await receiptService.updateStatus(receipt.id, 'PRSP');

    // Fire off background parsing (don't await!)
    // Pass blob URL to parsing service
    receiptService.parseInBackground(receipt.id, blob.url).catch((err) => {
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
