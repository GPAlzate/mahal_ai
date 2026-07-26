/**
 * Device-local record of which share codes this browser has been given.
 *
 * The server authorizes receipt access on the share code (see
 * `lib/server/receiptAuth.ts`), but the app navigates by receipt ID once the
 * user is past the `/[code]` landing page. This store bridges the two: whenever
 * the client learns a receipt's share code — by following a share link, or by
 * creating the receipt itself — it records it here, and the API client replays
 * it as the `x-share-code` header on subsequent requests for that receipt.
 *
 * Storing it client-side grants no access the user did not already have: they
 * hold the link, and the link is the capability.
 */

const storageKey = (receiptId: number) => `mahal_share_${receiptId}`;

export function rememberShareCode(receiptId: number, shareCode: string): void {
  if (typeof window === 'undefined' || !shareCode) {
    return;
  }

  try {
    localStorage.setItem(storageKey(receiptId), shareCode.toUpperCase());
  } catch {
    // Private-mode / quota failures are not worth breaking the flow over; the
    // request simply falls back to account-based access.
  }
}

export function getShareCode(receiptId: number): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return localStorage.getItem(storageKey(receiptId));
  } catch {
    return null;
  }
}

export function clearShareCode(receiptId: number): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(storageKey(receiptId));
  } catch {
    // Nothing actionable.
  }
}
