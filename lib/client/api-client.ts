/**
 * Type-safe API client for frontend
 */

import type { Receipt } from '@/lib/schemas/receipt/public/Receipt';
import type { ReceiptLine } from '@/lib/schemas/receipt/public/ReceiptLine';
import type { Participant } from '@/lib/schemas/participant/public/Participant';
import type { LineParticipant } from '@/lib/schemas/participant/public/LineParticipant';
import type { ReceiptSummary } from '@/lib/schemas/receipt/public/ReceiptSummary';

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
    parse: (imageBase64: string) =>
      fetchAPI<{ receiptId: number; status: string }>('/api/receipts/parse', {
        method: 'POST',
        body: JSON.stringify({ imageBase64 }),
      }),

    create: (data: any) =>
      fetchAPI<Receipt>('/api/receipts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    get: (id: number) => fetchAPI<Receipt>(`/api/receipts/${id}`),

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

    unassign: (receiptId: number, lineId: number, participantId: number) =>
      fetchAPI<void>(
        `/api/receipts/${receiptId}/lines/${lineId}/assignments/${participantId}`,
        { method: 'DELETE' }
      ),
  },
};

export { APIError };
