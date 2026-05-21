import { NextRequest, NextResponse } from 'next/server';
import { receiptService } from '@/lib/services/ReceiptService';

/**
 * GET /api/receipts/[id]/collector?secret=<uuid>
 * Validates a collector secret against a receipt.
 * Returns { valid: true } if the secret matches, { valid: false } otherwise.
 * The secret itself is never returned — knowing it is the credential.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const receiptId = +id;

    if (isNaN(receiptId)) {
      return NextResponse.json({ error: 'Invalid receipt ID' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');

    if (!secret) {
      return NextResponse.json({ valid: false }, { status: 200 });
    }

    const valid = await receiptService.verifyCollectorSecret(receiptId, secret);

    return NextResponse.json({ valid }, { status: 200 });
  } catch (error) {
    console.error('Error verifying collector secret:', error);
    return NextResponse.json({ valid: false }, { status: 200 });
  }
}
