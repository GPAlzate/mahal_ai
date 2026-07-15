import webpush from 'web-push';
import { sql } from '@/lib/db';
import { getVapidPublicKey, getVapidPrivateKey, getVapidSubject } from '@/lib/env';
import { Logger } from '@/lib/utils/Logger';

/**
 * Payload delivered to the service worker. `url` is a same-origin path the
 * notification opens on tap (e.g. `/6JM3W`). `tag` collapses notifications
 * about the same context instead of stacking them.
 */
export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

interface SubscriptionRow {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface SaveSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  userId?: string | null;
  participantId?: number | null;
}

function peso(amount: number): string {
  const formatted = new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `₱${formatted}`;
}

/**
 * Service for managing web push subscriptions and sending notifications.
 *
 * Subscriptions are keyed to a Clerk user (signed-in devices) and/or a
 * participant (anonymous share-link guests, scoped to that one receipt).
 * Delivery is best-effort: dead endpoints (404/410) are pruned, other
 * failures are logged and swallowed so they never break the calling request.
 */
export class PushNotificationService {
  protected _logger: Logger;
  private _vapidConfigured = false;

  constructor() {
    this._logger = new Logger(PushNotificationService.name);
  }

  private ensureVapid() {
    if (!this._vapidConfigured) {
      webpush.setVapidDetails(getVapidSubject(), getVapidPublicKey(), getVapidPrivateKey());
      this._vapidConfigured = true;
    }
  }

  /**
   * Upsert a subscription by endpoint. Re-subscribing from the same browser
   * merges identities: a guest subscription gains user_id when they sign in.
   */
  async saveSubscription({ endpoint, p256dh, auth, userId, participantId }: SaveSubscriptionInput) {
    await sql`
      INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_id, participant_id)
      VALUES (${endpoint}, ${p256dh}, ${auth}, ${userId ?? null}, ${participantId ?? null})
      ON CONFLICT (endpoint) DO UPDATE SET
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        user_id = COALESCE(EXCLUDED.user_id, push_subscriptions.user_id),
        participant_id = COALESCE(EXCLUDED.participant_id, push_subscriptions.participant_id),
        updated_at = NOW()
    `;
  }

  async deleteSubscription(endpoint: string) {
    await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
  }

  /**
   * Send a payload to every device subscribed for any of the given users.
   */
  async notifyUsers(userIds: string[], payload: PushPayload) {
    const ids = userIds.filter(Boolean);
    if (ids.length === 0) {
      return;
    }

    const rows = await sql`
      SELECT id, endpoint, p256dh, auth
      FROM push_subscriptions
      WHERE user_id = ANY(${ids}::text[])
    `;

    await this.deliver(rows as unknown as SubscriptionRow[], payload);
  }

  /**
   * Send a payload to every device subscribed for any of the given
   * participants — either directly (guest subscriptions) or via the
   * participant's linked user account. Devices belonging to
   * `excludeUserId` (the actor) are skipped.
   */
  async notifyParticipants(
    participantIds: number[],
    payload: PushPayload,
    excludeUserId?: string | null
  ) {
    if (participantIds.length === 0) {
      return;
    }

    const rows = await sql`
      SELECT DISTINCT ON (ps.endpoint) ps.id, ps.endpoint, ps.p256dh, ps.auth
      FROM push_subscriptions ps
      WHERE (
        ps.participant_id = ANY(${participantIds}::bigint[])
        OR ps.user_id IN (
          SELECT user_id FROM participants
          WHERE id = ANY(${participantIds}::bigint[])
            AND user_id IS NOT NULL
            AND deleted_at IS NULL
        )
      )
      AND (${excludeUserId ?? null}::text IS NULL OR ps.user_id IS DISTINCT FROM ${excludeUserId ?? null}::text)
    `;

    await this.deliver(rows as unknown as SubscriptionRow[], payload);
  }

  /**
   * Deliver a payload to a set of subscriptions, pruning dead endpoints.
   * @returns Number of successful deliveries.
   */
  private async deliver(subscriptions: SubscriptionRow[], payload: PushPayload): Promise<number> {
    if (subscriptions.length === 0) {
      return 0;
    }

    this.ensureVapid();
    const body = JSON.stringify(payload);

    const results = await Promise.all(
      subscriptions.map(async (row) => {
        try {
          await webpush.sendNotification(
            { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
            body,
            { TTL: 24 * 60 * 60 }
          );
          return true;
        } catch (error: any) {
          if (error?.statusCode === 404 || error?.statusCode === 410) {
            await sql`DELETE FROM push_subscriptions WHERE id = ${row.id}`;
          } else {
            this._logger.error(`Push delivery failed (endpoint ${row.id}):`, error?.message ?? error);
          }
          return false;
        }
      })
    );

    return results.filter(Boolean).length;
  }

  /**
   * Best display name for a user acting on a receipt: their participant name
   * on that receipt, else their profile name, else username.
   */
  async resolveActorName(receiptId: number, userId: string): Promise<string | null> {
    const result = await sql`
      SELECT COALESCE(
        (SELECT display_name FROM participants
         WHERE receipt_id = ${receiptId} AND user_id = ${userId} AND deleted_at IS NULL
         LIMIT 1),
        (SELECT COALESCE(display_name, username) FROM users
         WHERE clerk_user_id = ${userId} AND deleted_at IS NULL)
      ) AS name
    `;

    return (result[0]?.name as string | null) ?? null;
  }

  // --- Event helpers -------------------------------------------------------
  // Copy register: casual, direct, peso amount first where there is one.
  // Receipt titles render as-is; the UI uppercases visually, notifications
  // shouldn't shout.

  /**
   * A registered user was added to a receipt by name.
   */
  async notifyAddedToReceipt(args: {
    userIds: string[];
    actorName: string | null;
    receiptTitle: string | null;
    shareCode: string;
  }) {
    const title = args.receiptTitle ?? 'a new receipt';
    await this.notifyUsers(args.userIds, {
      title: `You've been added to ${title} 🧾`,
      body: `${args.actorName ?? 'Someone'} added you to the split. Tap to see your share.`,
      url: `/${args.shareCode}`,
      tag: `receipt-${args.shareCode}-added`,
    });
  }

  /**
   * Receipt finalized — each participant gets their own amount.
   */
  async notifyTotalsReady(args: {
    splits: Array<{ participantId: number; total: number }>;
    receiptTitle: string | null;
    shareCode: string;
    payerParticipantId: number | null;
    excludeUserId?: string | null;
  }) {
    const title = args.receiptTitle ?? 'Your receipt';
    await Promise.all(
      args.splits
        .filter((s) => s.participantId !== args.payerParticipantId)
        .map((s) =>
          this.notifyParticipants(
            [s.participantId],
            {
              title: `${title}: you owe ${peso(s.total)}`,
              body: 'Totals are in. Tap to see your share and pay.',
              url: `/${args.shareCode}`,
              tag: `receipt-${args.shareCode}-total`,
            },
            args.excludeUserId
          )
        )
    );
  }

  /**
   * Owner/payer nudged an unpaid participant.
   * @returns Number of devices reached.
   */
  async notifyNudge(args: {
    targetParticipantId: number;
    senderName: string | null;
    amount: number | null;
    receiptTitle: string | null;
    shareCode: string;
  }): Promise<number> {
    const rows = await sql`
      SELECT DISTINCT ON (ps.endpoint) ps.id, ps.endpoint, ps.p256dh, ps.auth
      FROM push_subscriptions ps
      WHERE ps.participant_id = ${args.targetParticipantId}
        OR ps.user_id = (
          SELECT user_id FROM participants
          WHERE id = ${args.targetParticipantId} AND deleted_at IS NULL
        )
    `;

    const title = args.receiptTitle ?? 'your receipt';
    const amountPart = args.amount !== null ? `${peso(args.amount)} for ${title}` : `Your share of ${title}`;

    return this.deliver(rows as unknown as SubscriptionRow[], {
      title: `👉 ${args.senderName ?? 'Someone'} is nudging you`,
      body: `You owe ${amountPart}. Tap to pay via GCash.`,
      url: `/${args.shareCode}`,
      tag: `receipt-${args.shareCode}-nudge`,
    });
  }

  /**
   * A participant self-reported paying (PCIP) — tell whoever can confirm.
   */
  async notifyPaymentClaimed(args: {
    userIds: string[];
    participantName: string;
    amount: number | null;
    receiptTitle: string | null;
    shareCode: string;
  }) {
    const title = args.receiptTitle ?? 'your receipt';
    const amountPart = args.amount !== null ? ` ${peso(args.amount)}` : '';
    await this.notifyUsers(args.userIds, {
      title: `${args.participantName} marked${amountPart} as paid`,
      body: `${title} — tap to confirm you received it.`,
      url: `/${args.shareCode}`,
      tag: `receipt-${args.shareCode}-payment`,
    });
  }

  /**
   * Owner/payer confirmed a participant's payment.
   */
  async notifyPaymentConfirmed(args: {
    participantId: number;
    amount: number | null;
    receiptTitle: string | null;
    shareCode: string;
    excludeUserId?: string | null;
  }) {
    const title = args.receiptTitle ?? 'your receipt';
    const amountPart = args.amount !== null ? `Your ${peso(args.amount)} for ${title}` : `Your share of ${title}`;
    await this.notifyParticipants(
      [args.participantId],
      {
        title: 'Payment confirmed ✓',
        body: `${amountPart} is settled.`,
        url: `/${args.shareCode}`,
        tag: `receipt-${args.shareCode}-payment`,
      },
      args.excludeUserId
    );
  }

  /**
   * Every participant has paid — closing moment, sent to the whole group.
   */
  async notifySettled(args: {
    participantIds: number[];
    ownerId: string | null;
    receiptTitle: string | null;
    shareCode: string;
    excludeUserId?: string | null;
  }) {
    const title = args.receiptTitle ?? 'Your receipt';
    const payload: PushPayload = {
      title: `${title} is settled 🎉`,
      body: "Everyone's paid up!",
      url: `/${args.shareCode}`,
      tag: `receipt-${args.shareCode}-settled`,
    };

    await this.notifyParticipants(args.participantIds, payload, args.excludeUserId);

    // Owner may not be a participant (e.g. split they don't eat from)
    if (args.ownerId && args.ownerId !== args.excludeUserId) {
      const onReceipt = await sql`
        SELECT 1 FROM participants
        WHERE id = ANY(${args.participantIds}::bigint[]) AND user_id = ${args.ownerId} AND deleted_at IS NULL
      `;
      if (onReceipt.length === 0) {
        await this.notifyUsers([args.ownerId], payload);
      }
    }
  }

  /**
   * Someone claimed a participant via the share link — tell the owner.
   */
  async notifyJoined(args: {
    ownerId: string;
    joinerName: string;
    receiptTitle: string | null;
    shareCode: string;
  }) {
    const title = args.receiptTitle ?? 'your receipt';
    await this.notifyUsers([args.ownerId], {
      title: `${args.joinerName} joined ${title}`,
      body: 'Tap to see the split.',
      url: `/${args.shareCode}`,
      tag: `receipt-${args.shareCode}-joined`,
    });
  }
}

/**
 * Singleton instance of PushNotificationService
 */
export const pushNotificationService = new PushNotificationService();
