import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sql } from '@/lib/db';

/**
 * Receipt authorization.
 *
 * Receipt IDs are sequential, so an ID alone proves nothing. Access to a receipt
 * is granted by one of three things:
 *
 * - the share code, sent in the `x-share-code` header (the capability handed out
 *   by the share link — this is what lets anonymous guests collaborate)
 * - being the receipt owner
 * - being signed in as a participant already linked to the receipt
 *
 * Levels:
 * - `read`   — view the receipt, its lines, participants and summary
 * - `write`  — edit lines, participants and assignments; the app's model is that
 *              anyone holding the link is a co-editor, so this matches `read`
 * - `manage` — money-moving and lifecycle actions (GCash number, settling).
 *              Restricted to the owner or the payer, since those redirect where
 *              people send money. Falls back to `write` only when the receipt has
 *              no owner and no linked payer, where no stronger identity exists.
 */

export const SHARE_CODE_HEADER = 'x-share-code';

export type ReceiptAccessLevel = 'read' | 'write' | 'manage';

export interface ReceiptAccess {
  receiptId: number;
  userId: string | null;
  ownerId: string | null;
  payerUserId: string | null;
  isOwner: boolean;
  isPayer: boolean;
  isParticipant: boolean;
  hasValidShareCode: boolean;
}

/**
 * Compare a caller-supplied share code against the stored one without leaking
 * match position through timing.
 */
function shareCodeMatches(provided: string | null, actual: string | null): boolean {
  if (!provided || !actual) {
    return false;
  }

  const a = Buffer.from(provided.trim().toUpperCase(), 'utf8');
  const b = Buffer.from(actual.trim().toUpperCase(), 'utf8');

  if (a.length !== b.length || a.length === 0) {
    return false;
  }

  return timingSafeEqual(a, b);
}

/**
 * Resolve what the caller is allowed to do with a receipt.
 *
 * @returns null when the receipt does not exist (or is soft-deleted)
 */
export async function resolveReceiptAccess(
  request: NextRequest,
  receiptId: number
): Promise<ReceiptAccess | null> {
  const { userId } = await auth();

  const rows = await sql`
    SELECT
      r.share_code,
      r.owner_id,
      payer.user_id AS payer_user_id,
      EXISTS(
        SELECT 1 FROM participants p
        WHERE p.receipt_id = r.id
          AND p.user_id = ${userId}
          AND p.deleted_at IS NULL
      ) AS is_participant
    FROM receipts r
    LEFT JOIN participants payer
      ON payer.id = r.payer_participant_id AND payer.deleted_at IS NULL
    WHERE r.id = ${receiptId} AND r.deleted_at IS NULL
  `;

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  const ownerId: string | null = row.owner_id ?? null;
  const payerUserId: string | null = row.payer_user_id ?? null;

  return {
    receiptId,
    userId: userId ?? null,
    ownerId,
    payerUserId,
    isOwner: !!userId && userId === ownerId,
    isPayer: !!userId && userId === payerUserId,
    isParticipant: row.is_participant === true,
    hasValidShareCode: shareCodeMatches(
      request.headers.get(SHARE_CODE_HEADER),
      row.share_code
    ),
  };
}

function satisfies(access: ReceiptAccess, level: ReceiptAccessLevel): boolean {
  const canCollaborate =
    access.hasValidShareCode || access.isOwner || access.isParticipant;

  if (level === 'read' || level === 'write') {
    return canCollaborate;
  }

  // 'manage'
  if (access.isOwner || access.isPayer) {
    return true;
  }

  // Nobody has claimed ownership of this receipt, so there is no stronger
  // identity to require than possession of the share code.
  const hasAccountableOwner = !!access.ownerId || !!access.payerUserId;

  return !hasAccountableOwner && canCollaborate;
}

/**
 * Gate a route handler on receipt access.
 *
 * Returns a response to send back when access is denied, or the resolved access
 * when the caller is allowed through.
 *
 * @example
 * ```typescript
 * const gate = await guardReceipt(request, receiptId, 'write');
 * if (!gate.ok) {
 *   return gate.response;
 * }
 * ```
 */
export async function guardReceipt(
  request: NextRequest,
  receiptId: number,
  level: ReceiptAccessLevel
): Promise<
  { ok: true; access: ReceiptAccess } | { ok: false; response: NextResponse }
> {
  const access = await resolveReceiptAccess(request, receiptId);

  if (!access) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Receipt not found' }, { status: 404 }),
    };
  }

  if (!satisfies(access, level)) {
    // Deliberately 404 rather than 403 for read/write: a caller who cannot prove
    // access should not learn that the receipt exists at all.
    if (level === 'manage') {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Only the receipt owner or collector can do that' },
          { status: 403 }
        ),
      };
    }

    return {
      ok: false,
      response: NextResponse.json({ error: 'Receipt not found' }, { status: 404 }),
    };
  }

  return { ok: true, access };
}
