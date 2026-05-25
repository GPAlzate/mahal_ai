import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { receiptService } from '@/lib/services/ReceiptService';
import ReceiptsClient from './ReceiptsClient';
import type { MyReceipt } from '@/lib/client/api-client';

export default async function ReceiptsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/login');
  }

  let receipts: MyReceipt[] = [];
  try {
    const rows = await receiptService.findByOwnerId(userId);
    receipts = rows.map((r) => ({
      ...r,
      receiptTime: r.receiptTime instanceof Date ? r.receiptTime.toISOString() : String(r.receiptTime),
      userOwedAmount: 0,
    }));
  } catch {
    // Return empty list on error rather than crashing
  }

  return <ReceiptsClient receipts={receipts} />;
}
