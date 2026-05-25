import { currentUser } from '@clerk/nextjs/server';
import { receiptService } from '@/lib/services/ReceiptService';
import { userService } from '@/lib/services/UserService';
import HomeClient from './HomeClient';
import type { MyReceipt } from '@/lib/client/api-client';

function toMyReceipt(r: { id: number; title: string | null; shareCode: string; receiptTime: Date; status: string; participantNames: string[]; userOwedAmount: number }): MyReceipt {
  return {
    ...r,
    receiptTime: r.receiptTime instanceof Date ? r.receiptTime.toISOString() : String(r.receiptTime),
  };
}

export default async function Home() {
  const user = await currentUser();

  if (!user) {
    return <HomeClient initialOwedReceipts={null} initialOwingReceipts={null} />;
  }

  let owedReceipts: MyReceipt[] = [];
  let owingReceipts: MyReceipt[] = [];
  try {
    const [owedRows, owingRows] = await Promise.all([
      receiptService.findWhereUserIsOwed(user.id),
      receiptService.findWhereUserOwes(user.id),
      userService.getOrCreate(user.id, {
        firstName: user.firstName,
        email: user.emailAddresses[0]?.emailAddress,
      }),
    ]);
    owedReceipts = owedRows.map(toMyReceipt);
    owingReceipts = owingRows.map(toMyReceipt);
  } catch {
    // Return empty lists on error rather than crashing the page
  }

  return <HomeClient initialOwedReceipts={owedReceipts} initialOwingReceipts={owingReceipts} />;
}
