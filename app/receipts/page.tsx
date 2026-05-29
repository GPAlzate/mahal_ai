import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { receiptService } from '@/lib/services/ReceiptService';
import ReceiptsClient from './ReceiptsClient';
import type { MyReceipt } from '@/lib/client/api-client';

function toMyReceipt(
  r: { id: number; title: string | null; shareCode: string; receiptTime: Date; status: string; participantNames: string[]; userOwedAmount?: number }
): MyReceipt {
  return {
    ...r,
    userOwedAmount: r.userOwedAmount ?? 0,
    receiptTime: r.receiptTime instanceof Date ? r.receiptTime.toISOString() : String(r.receiptTime),
  };
}

export default async function ReceiptsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/login');
  }

  let owedReceipts: MyReceipt[] = [];
  let owingReceipts: MyReceipt[] = [];
  let allReceipts: MyReceipt[] = [];

  try {
    const [owedRows, owingRows, ownedRows] = await Promise.all([
      receiptService.findWhereUserIsOwed(userId),
      receiptService.findWhereUserOwes(userId),
      receiptService.findByOwnerId(userId),
    ]);

    owedReceipts = owedRows.map(toMyReceipt);
    owingReceipts = owingRows.map(toMyReceipt);

    const allMap = new Map<number, MyReceipt>();
    for (const r of ownedRows) {
      allMap.set(r.id, toMyReceipt(r));
    }
    for (const r of owedRows) {
      allMap.set(r.id, toMyReceipt(r));
    }
    for (const r of owingRows) {
      allMap.set(r.id, toMyReceipt(r));
    }
    allReceipts = [...allMap.values()].sort(
      (a, b) => new Date(b.receiptTime).getTime() - new Date(a.receiptTime).getTime()
    );
  } catch {
    // Return empty lists on error rather than crashing
  }

  return (
    <ReceiptsClient
      owedReceipts={owedReceipts}
      owingReceipts={owingReceipts}
      allReceipts={allReceipts}
    />
  );
}
