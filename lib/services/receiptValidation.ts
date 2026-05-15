import { sql } from '@/lib/db';

export interface ReceiptRow {
  id: number;
  status: string;
}

export async function validateReceiptIsModifiable(receiptId: number): Promise<ReceiptRow> {
  const receipt = await sql`
    SELECT id, status FROM receipts
    WHERE id = ${receiptId} AND deleted_at IS NULL
  `;

  if (!receipt || receipt.length === 0) {
    throw new Error('Receipt not found');
  }

  if (receipt[0].status === 'FLZD') {
    throw new Error('Cannot modify finalized receipt');
  }

  return receipt[0] as ReceiptRow;
}
