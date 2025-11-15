/**
 * Type-safe API client for frontend
 */

import type { Receipt } from '@/lib/schemas/receipt/public/Receipt';
import type { ReceiptLine } from '@/lib/schemas/receipt/public/ReceiptLine';
import type { Participant } from '@/lib/schemas/participant/public/Participant';
import type { LineParticipant } from '@/lib/schemas/participant/public/LineParticipant';
import type { ReceiptSummary } from '@/lib/schemas/receipt/public/ReceiptSummary';
import type { SplitGroup } from '@/lib/schemas/receipt/public/SplitGroup';

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
    parse: async (imageFile: File) => {
      const formData = new FormData();
      formData.append('image', imageFile);

      const response = await fetch('/api/receipts/parse', {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header - browser will set it with boundary
      });

      const data = await response.json();

      if (!response.ok) {
        throw new APIError(
          data.error || 'An error occurred',
          response.status,
          data.details
        );
      }

      return data as { receiptId: number; status: string };
    },

    // TODO: Implement manual receipt entry flow
    // create: (data: any) =>
    //   fetchAPI<Receipt>('/api/receipts', {
    //     method: 'POST',
    //     body: JSON.stringify(data),
    //   }),

    get: (id: number, includeLines?: boolean) =>
      fetchAPI<Receipt>(`/api/receipts/${id}${includeLines ? '?includeLines=true' : ''}`),

    getByShareCode: (shareCode: string) =>
      fetchAPI<ReceiptSummary>(`/api/receipts?shareCode=${shareCode}`),

    getSummary: (id: number) => fetchAPI<ReceiptSummary>(`/api/receipts/${id}/summary`),

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

    create: (receiptId: number, participants: Array<{ displayName: string }>) =>
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
};

export { APIError };
