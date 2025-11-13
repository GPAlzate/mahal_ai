import { NextRequest, NextResponse } from 'next/server';
import { openAIService } from '@/lib/services/OpenAIService';
import { ParseReceiptRequestSchema } from '@/lib/schemas/receipt/request/ParseReceiptRequest';
import { Logger } from '@/lib/utils/Logger';

const logger = new Logger('POST /api/receipts/parse');

/**
 * POST /api/receipts/parse
 * Parse a receipt image using OpenAI and return structured data
 * Does NOT create a receipt - only parses the image
 *
 * Request body:
 * {
 *   imageBase64: string // Base64 data URI (e.g., "data:image/jpeg;base64,...")
 * }
 *
 * Response:
 * {
 *   items: [{name, unitPrice, quantity}],
 *   tax?: number,
 *   tip?: number,
 *   serviceCharge?: number,
 *   discount?: number
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

    // Parse receipt image with OpenAI
    const parsedData = await openAIService.parseReceiptImage(imageBase64);

    logger.log('Successfully parsed receipt');
    return NextResponse.json(parsedData, { status: 200 });
  } catch (error) {
    logger.error('Error parsing receipt:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to parse receipt';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
