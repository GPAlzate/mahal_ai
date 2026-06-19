/**
 * Type-safe API client for frontend
 */

import type { Receipt, ReceiptStatus } from '../schemas/receipt/public/Receipt';
import type { ReceiptLine } from '../schemas/receipt/public/ReceiptLine';
import type { Participant } from '../schemas/participant/public/Participant';
import type { LineParticipant } from '../schemas/participant/public/LineParticipant';
import type { ReceiptSummary } from '../schemas/receipt/public/ReceiptSummary';
import type { SplitGroup } from '../schemas/receipt/public/SplitGroup';
import type { PaymentStatus } from '../schemas/participant/public/PaymentStatus';

export interface MyReceipt {
  id: number;
  title: string | null;
  shareCode: string;
  receiptTime: string;
  status: string;
  participantNames: string[];
  userOwedAmount: number;
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

/**
 * Runtime configuration for the API client.
 *
 * Web: leave defaults — `baseUrl` stays '' so requests are relative and Clerk
 * auth rides along on cookies.
 * Mobile: call `configureApiClient` once at startup with the deployed origin
 * and a `getAuthHeaders` that returns the Clerk session token, since native
 * has no cookies and same-origin.
 */
interface ApiClientConfig {
  baseUrl: string;
  getAuthHeaders?: () => Promise<Record<string, string>> | Record<string, string>;
}

const config: ApiClientConfig = {
  baseUrl: '',
};

export function configureApiClient(next: Partial<ApiClientConfig>): void {
  Object.assign(config, next);
}

async function fetchAPI<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const authHeaders = config.getAuthHeaders ? await config.getAuthHeaders() : {};
  const response = await fetch(`${config.baseUrl}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
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
      fetchAPI<{ receiptId: number }>('/api/receipts', {
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

    updateGcashNumber: (id: number, gcashNumber: string | null) =>
      fetchAPI<Receipt>(`/api/receipts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ gcashNumber }),
      }),

    get: (id: number, includeLines?: boolean) =>
      fetchAPI<Receipt>(`/api/receipts/${id}${includeLines ? '?includeLines=true' : ''}`),

    getByShareCode: (shareCode: string) =>
      fetchAPI<Receipt>(`/api/receipts?shareCode=${shareCode}`),

    getSummary: (id: number) => fetchAPI<ReceiptSummary>(`/api/receipts/${id}/summary`),

    getMyReceipts: () => fetchAPI<{ receipts: MyReceipt[] }>('/api/receipts/my'),

    finalize: (id: number) =>
      fetchAPI<ReceiptSummary>(`/api/receipts/${id}/finalize`, { method: 'PUT' }),

    delete: (id: number) =>
      fetchAPI<{ ok: true }>(`/api/receipts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'DLTD' }),
      }),

    settle: (id: number) =>
      fetchAPI<Receipt>(`/api/receipts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'STLD' }),
      }),
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

    claim: (receiptId: number, participantId: number) =>
      fetchAPI<Participant>(
        `/api/receipts/${receiptId}/participants/${participantId}/claim`,
        { method: 'PATCH' }
      ),

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
    get: () => fetchAPI<{ username: string | null; displayName: string | null; gcashNumber: string | null }>('/api/user'),
  },

  users: {
    search: (q: string) =>
      fetchAPI<Array<{ userId: string; username: string; displayName: string | null }>>(
        `/api/users/search?q=${encodeURIComponent(q)}`
      ),
    checkUsername: (u: string) =>
      fetchAPI<{ available: boolean }>(`/api/users/check-username?u=${encodeURIComponent(u)}`),
  },
};

export { APIError };
