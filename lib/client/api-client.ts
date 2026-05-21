/**
 * Type-safe API client for frontend
 */

import type { Receipt, ReceiptStatus } from '@/lib/schemas/receipt/public/Receipt';
import type { ReceiptLine } from '@/lib/schemas/receipt/public/ReceiptLine';
import type { Participant } from '@/lib/schemas/participant/public/Participant';
import type { LineParticipant } from '@/lib/schemas/participant/public/LineParticipant';
import type { ReceiptSummary } from '@/lib/schemas/receipt/public/ReceiptSummary';
import type { SplitGroup } from '@/lib/schemas/receipt/public/SplitGroup';
import type { PaymentStatus } from '@/lib/schemas/participant/public/PaymentStatus';

export interface MyReceipt {
  id: number;
  title: string | null;
  shareCode: string;
  receiptTime: string;
  status: string;
  participantNames: string[];
}

class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

async function fetchAPI<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new APIError(
      data.error || 'An error occurred',
      response.status,
      data.details
    );
  }

  return data;
}

export const api = {
  receipts: {
    // Attaches a blob URL to an existing receipt, transitions ULIP → PRSP,
    // and schedules background AI parsing.
    triggerParse: (id: number, imageUrl: string) =>
      fetchAPI<{ status: string }>(`/api/receipts/${id}/parse`, {
        method: 'POST',
        body: JSON.stringify({ imageUrl }),
      }),

    create: (data: { status: ReceiptStatus; title?: string; receiptTime?: string }) =>
      fetchAPI<{ receiptId: number; collectorSecret: string }>('/api/receipts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateStatus: (id: number, status: ReceiptStatus) =>
      fetchAPI<Receipt>(`/api/receipts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),

    updateTitle: (id: number, title: string | null) =>
      fetchAPI<Receipt>(`/api/receipts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title }),
      }),

    updatePayer: (id: number, payerParticipantId: number) =>
      fetchAPI<Receipt>(`/api/receipts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ payerParticipantId }),
      }),

    verifyCollector: (id: number, secret: string) =>
      fetchAPI<{ valid: boolean }>(`/api/receipts/${id}/collector?secret=${encodeURIComponent(secret)}`),

    get: (id: number, includeLines?: boolean) =>
      fetchAPI<Receipt>(`/api/receipts/${id}${includeLines ? '?includeLines=true' : ''}`),

    getByShareCode: (shareCode: string) =>
      fetchAPI<ReceiptSummary>(`/api/receipts?shareCode=${shareCode}`),

    getSummary: (id: number) => fetchAPI<ReceiptSummary>(`/api/receipts/${id}/summary`),

    getMyReceipts: () => fetchAPI<{ receipts: MyReceipt[] }>('/api/receipts/my'),

    finalize: (id: number) =>
      fetchAPI<ReceiptSummary>(`/api/receipts/${id}/finalize`, { method: 'PUT' }),
  },

  lines: {
    list: (receiptId: number) => fetchAPI<ReceiptLine[]>(`/api/receipts/${receiptId}/lines`),

    create: (receiptId: number, data: any) =>
      fetchAPI<ReceiptLine>(`/api/receipts/${receiptId}/lines`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (receiptId: number, lineId: number, data: any) =>
      fetchAPI<ReceiptLine>(`/api/receipts/${receiptId}/lines/${lineId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (receiptId: number, lineId: number) =>
      fetchAPI<void>(`/api/receipts/${receiptId}/lines/${lineId}`, {
        method: 'DELETE',
      }),
  },

  participants: {
    list: (receiptId: number) =>
      fetchAPI<Participant[]>(`/api/receipts/${receiptId}/participants`),

    create: (receiptId: number, participants: Array<{ displayName: string; userId?: string }>) =>
      fetchAPI<Participant[]>(`/api/receipts/${receiptId}/participants`, {
        method: 'POST',
        body: JSON.stringify(participants),
      }),

    update: (receiptId: number, participantId: number, displayName: string) =>
      fetchAPI<Participant>(`/api/receipts/${receiptId}/participants/${participantId}`, {
        method: 'PUT',
        body: JSON.stringify({ displayName }),
      }),

    delete: (receiptId: number, participantId: number) =>
      fetchAPI<void>(`/api/receipts/${receiptId}/participants/${participantId}`, {
        method: 'DELETE',
      }),

    updatePaymentStatus: (receiptId: number, participantId: number, status: PaymentStatus) =>
      fetchAPI<Participant>(
        `/api/receipts/${receiptId}/participants/${participantId}/payment-status`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        }
      ),
  },

  assignments: {
    list: (receiptId: number, lineId: number) =>
      fetchAPI<LineParticipant[]>(`/api/receipts/${receiptId}/lines/${lineId}/assignments`),

    assign: (receiptId: number, lineId: number, participantId: number, shareQuantity: number) =>
      fetchAPI<LineParticipant>(`/api/receipts/${receiptId}/lines/${lineId}/assignments`, {
        method: 'POST',
        body: JSON.stringify({ participantId, shareQuantity }),
      }),

    batchAssign: (
      receiptId: number,
      assignments: Array<{ receiptLineId: number; participantId: number; shareQuantity: number }>
    ) =>
      fetchAPI<LineParticipant[]>('/api/line-participants/batch', {
        method: 'POST',
        body: JSON.stringify({ receiptId, assignments }),
      }),

    unassign: (receiptId: number, lineId: number, participantId: number) =>
      fetchAPI<void>(
        `/api/receipts/${receiptId}/lines/${lineId}/assignments/${participantId}`,
        { method: 'DELETE' }
      ),
  },

  splitGroups: {
    get: (receiptId: number) =>
      fetchAPI<SplitGroup>(`/api/split-groups?receiptId=${receiptId}`),
  },

  user: {
    get: () => fetchAPI<{ displayName: string | null; gcashNumber: string | null }>('/api/user'),
  },
};

export { APIError };
