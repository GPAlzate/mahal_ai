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
  /**
   * Look up the share code this client holds for a receipt, sent as
   * `x-share-code` so the server can authorize guests who have the link but no
   * account. Web wires this to its localStorage store; native leaves it unset
   * because native users are always signed in and authorize by account.
   */
  getShareCode?: (receiptId: number) => string | null | undefined;
  /** Record a share code the client just learned, for later requests. */
  rememberShareCode?: (receiptId: number, shareCode: string) => void;
}

const config: ApiClientConfig = {
  baseUrl: '',
};

export function configureApiClient(next: Partial<ApiClientConfig>): void {
  Object.assign(config, next);
  // Strip trailing slashes so `${baseUrl}/api/...` never becomes a `//api/...`
  // double slash, which the server answers with a 308 redirect — and React
  // Native's fetch drops the body of a POST when following that redirect.
  if (config.baseUrl) {
    config.baseUrl = config.baseUrl.replace(/\/+$/, '');
  }
}

/**
 * Pull the receipt ID out of a request URL so the matching share code can be
 * attached. Covers `/api/receipts/{id}/...` and `?receiptId={id}`; endpoints
 * that carry the ID only in the body pass it explicitly instead.
 */
function receiptIdFromUrl(url: string): number | null {
  const match = url.match(/\/api\/receipts\/(\d+)/) ?? url.match(/[?&]receiptId=(\d+)/);

  return match ? Number(match[1]) : null;
}

function shareCodeHeaders(url: string, receiptIdHint?: number): Record<string, string> {
  if (!config.getShareCode) {
    return {};
  }

  const receiptId = receiptIdHint ?? receiptIdFromUrl(url);

  if (receiptId === null || receiptId === undefined) {
    return {};
  }

  const shareCode = config.getShareCode(receiptId);

  return shareCode ? { 'x-share-code': shareCode } : {};
}

async function fetchAPI<T>(
  url: string,
  options?: RequestInit,
  receiptIdHint?: number
): Promise<T> {
  const authHeaders = config.getAuthHeaders ? await config.getAuthHeaders() : {};
  const response = await fetch(`${config.baseUrl}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...shareCodeHeaders(url, receiptIdHint),
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
    // Native-only: uploads a captured image (RN file: { uri, name, type }) to
    // the server, which stores it in Vercel Blob and returns the URL. Bypasses
    // `fetchAPI` because it sends multipart/form-data, not JSON.
    uploadImage: async (file: { uri: string; name: string; type: string }): Promise<{ url: string }> => {
      const authHeaders = config.getAuthHeaders ? await config.getAuthHeaders() : {};
      const form = new FormData();
      // React Native's FormData accepts this { uri, name, type } file shape.
      form.append('file', file as unknown as Blob);
      const response = await fetch(`${config.baseUrl}/api/blob-upload/mobile`, {
        method: 'POST',
        headers: { ...authHeaders },
        body: form,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new APIError(data.error || 'Upload failed', response.status, data.details);
      }
      return data;
    },

    // Attaches a blob URL to an existing receipt, transitions ULIP → PRSP,
    // and schedules background AI parsing.
    triggerParse: (id: number, imageUrl: string) =>
      fetchAPI<{ status: string }>(`/api/receipts/${id}/parse`, {
        method: 'POST',
        body: JSON.stringify({ imageUrl }),
      }),

    // Records the new receipt's share code so the follow-up calls in the
    // creation flow (attach image, add participants, edit lines) can prove
    // access even when the creator is not signed in.
    create: async (data: { status: ReceiptStatus; title?: string; receiptTime?: string }) => {
      const result = await fetchAPI<{ receiptId: number; shareCode: string }>('/api/receipts', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (result.shareCode) {
        config.rememberShareCode?.(result.receiptId, result.shareCode);
      }

      return result;
    },

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

    // Following a share link is how a guest acquires access; remember the code
    // against the resolved receipt ID for every later ID-addressed request.
    getByShareCode: async (shareCode: string) => {
      const receipt = await fetchAPI<Receipt>(
        `/api/receipts?shareCode=${encodeURIComponent(shareCode)}`
      );

      config.rememberShareCode?.(receipt.id, shareCode);

      return receipt;
    },

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
      fetchAPI<LineParticipant[]>(
        '/api/line-participants/batch',
        {
          method: 'POST',
          body: JSON.stringify({ receiptId, assignments }),
        },
        // The receipt ID is in the body, not the URL, so name it explicitly.
        receiptId
      ),

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

  settings: {
    // Partial profile update. Omitted fields are left unchanged server-side.
    update: (body: {
      username?: string;
      displayName?: string | null;
      gcashNumber?: string | null;
    }) =>
      fetchAPI<{ username: string | null; displayName: string | null; gcashNumber: string | null }>(
        '/api/settings',
        { method: 'PATCH', body: JSON.stringify(body) }
      ),
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
