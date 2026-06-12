/**
 * Local (device-only) participant claims for anonymous users.
 *
 * Signed-in users claim a participant server-side (stamps participants.user_id),
 * which surfaces the receipt in My Receipts across devices. Anonymous users have
 * no account to attach to, so we record their claim in localStorage instead. This
 * personalizes the current receipt with zero friction; when they later sign in we
 * replay the stored claim against the API so it becomes durable.
 */

const claimKey = (receiptId: number) => `mahal_claim_${receiptId}`;

export function getLocalClaim(receiptId: number): number | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = localStorage.getItem(claimKey(receiptId));
  if (!raw) {
    return null;
  }
  const id = Number(raw);
  return Number.isNaN(id) ? null : id;
}

export function setLocalClaim(receiptId: number, participantId: number) {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem(claimKey(receiptId), String(participantId));
}

export function clearLocalClaim(receiptId: number) {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.removeItem(claimKey(receiptId));
}
