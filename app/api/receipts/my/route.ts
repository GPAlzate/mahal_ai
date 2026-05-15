import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { receiptService } from '@/lib/services/ReceiptService';

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const receipts = await receiptService.findByOwnerId(userId);

  return NextResponse.json({ receipts });
}
