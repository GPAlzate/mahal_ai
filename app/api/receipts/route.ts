import { NextRequest, NextResponse } from 'next/server';
import { receiptService } from '@/lib/services/ReceiptService';
import { CreateReceiptRequestSchema } from '@/lib/schemas/ApiSchemas';

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
      typeof requestData.subtotal === 'number' &&
      typeof requestData.amountDue === 'number'
    ) {
      // All required fields present, create ParsedReceipt object
      parsedData = {
        merchantName: requestData.merchantName,
        receiptDate: requestData.receiptDate,
        receiptLines: requestData.receiptLines,
        currency: requestData.currency,
        subtotal: requestData.subtotal,
        amountDue: requestData.amountDue,
      };
    }

    const receipt = await receiptService.createReceipt(parsedData);

    return NextResponse.json(receipt, { status: 201 });
  } catch (error) {
    console.error('Error creating receipt:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to create receipt';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
