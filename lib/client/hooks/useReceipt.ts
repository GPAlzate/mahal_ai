'use client';

import { api } from '@/lib/client/api-client';
import { useState, useEffect } from 'react';

export function useReceipt(receiptId: number) {
  const [receipt, setReceipt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReceipt() {
      try {
        setLoading(true);
        const data = await api.receipts.get(receiptId);
        setReceipt(data);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchReceipt();
  }, [receiptId]);

  return { receipt, loading, error, refetch: () => setReceipt(null) };
}
