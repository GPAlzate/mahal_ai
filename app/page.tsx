import { currentUser } from '@clerk/nextjs/server';
import { receiptService } from '@/lib/services/ReceiptService';
import { userService } from '@/lib/services/UserService';
import HomeClient from './HomeClient';
import type { MyReceipt } from '@/lib/client/api-client';

export default async function Home() {
  const user = await currentUser();

  if (!user) {
    return <HomeClient initialReceipts={null} />;
  }

  let receipts: MyReceipt[] = [];
  try {
    const [rows] = await Promise.all([
      receiptService.findByOwnerId(user.id),
      userService.getOrCreate(user.id, {
        firstName: user.firstName,
        email: user.emailAddresses[0]?.emailAddress,
      }),
    ]);
    receipts = rows.map((r) => ({
      ...r,
      receiptTime: r.receiptTime instanceof Date ? r.receiptTime.toISOString() : String(r.receiptTime),
    }));
  } catch {
    // Return empty list on error rather than crashing the page
  }

  return <HomeClient initialReceipts={receipts} />;
}
