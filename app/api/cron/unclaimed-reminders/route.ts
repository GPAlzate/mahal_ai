import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCronSecret } from '@/lib/env';
import { pushNotificationService } from '@/lib/services/PushNotificationService';

/**
 * GET /api/cron/unclaimed-reminders
 * Daily cron (see vercel.json). One-shot reminder per receipt: drafts older
 * than 24h that still have purchase lines nobody claimed get a single push to
 * the owner and all subscribed participants, then are marked reminded.
 *
 * Protected by CRON_SECRET (Vercel sends it as `Authorization: Bearer ...`).
 */
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${getCronSecret()}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const receipts = await sql`
      SELECT
        r.id,
        r.title,
        r.share_code,
        r.owner_id,
        (
          SELECT COUNT(*) FROM receipt_lines rl
          WHERE rl.receipt_id = r.id
            AND rl.deleted_at IS NULL
            AND rl.line_type = 'PRCH'
            AND NOT EXISTS (
              SELECT 1 FROM line_participants lp WHERE lp.receipt_line_id = rl.id
            )
        ) AS unclaimed_count,
        ARRAY(
          SELECT p.id FROM participants p
          WHERE p.receipt_id = r.id AND p.deleted_at IS NULL
        ) AS participant_ids
      FROM receipts r
      WHERE r.deleted_at IS NULL
        AND r.status = 'DRFT'
        AND r.created_at <= NOW() - INTERVAL '24 hours'
        AND r.unclaimed_reminder_sent_at IS NULL
      ORDER BY r.created_at ASC
      LIMIT 50
    `;

    let reminded = 0;

    for (const receipt of receipts) {
      const unclaimedCount = Number(receipt.unclaimed_count);

      // Mark even fully-claimed drafts so we never rescan them.
      // updated_at is left alone: it drives receipt list ordering.
      await sql`
        UPDATE receipts SET unclaimed_reminder_sent_at = NOW()
        WHERE id = ${receipt.id}
      `;

      if (unclaimedCount === 0) {
        continue;
      }

      await pushNotificationService.notifyUnclaimedItems({
        participantIds: (receipt.participant_ids as number[]) ?? [],
        ownerId: receipt.owner_id,
        unclaimedCount,
        receiptTitle: receipt.title,
        shareCode: receipt.share_code,
      });
      reminded++;
    }

    return NextResponse.json({ scanned: receipts.length, reminded }, { status: 200 });
  } catch (error) {
    console.error('Error running unclaimed-items reminders:', error);
    return NextResponse.json({ error: 'Cron run failed' }, { status: 500 });
  }
}
