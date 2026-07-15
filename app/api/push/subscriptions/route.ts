import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sql } from '@/lib/db';
import { pushNotificationService } from '@/lib/services/PushNotificationService';

/**
 * POST /api/push/subscriptions
 * Register this device's push subscription.
 *
 * Request body:
 * {
 *   subscription: { endpoint: string, keys: { p256dh: string, auth: string } },
 *   participantId?: number | null   // ties a guest device to their spot on one receipt
 * }
 *
 * Signed-in users are keyed by their Clerk ID; guests must supply a
 * participantId so there is something to route notifications to.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    const body = await request.json();

    const endpoint = body?.subscription?.endpoint;
    const p256dh = body?.subscription?.keys?.p256dh;
    const authKey = body?.subscription?.keys?.auth;

    if (typeof endpoint !== 'string' || typeof p256dh !== 'string' || typeof authKey !== 'string') {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    let participantId: number | null = null;
    if (body.participantId !== undefined && body.participantId !== null) {
      participantId = Number(body.participantId);
      if (!Number.isInteger(participantId)) {
        return NextResponse.json({ error: 'Invalid participantId' }, { status: 400 });
      }

      const participantCheck = await sql`
        SELECT id FROM participants WHERE id = ${participantId} AND deleted_at IS NULL
      `;
      if (participantCheck.length === 0) {
        return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
      }
    }

    if (!userId && participantId === null) {
      return NextResponse.json(
        { error: 'Sign in or provide a participantId to subscribe' },
        { status: 400 }
      );
    }

    await pushNotificationService.saveSubscription({
      endpoint,
      p256dh,
      auth: authKey,
      userId,
      participantId,
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error('Error saving push subscription:', error);
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
  }
}

/**
 * DELETE /api/push/subscriptions
 * Remove this device's push subscription.
 *
 * Request body: { endpoint: string }
 * No auth: knowing the (unguessable) endpoint is proof of ownership.
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();

    if (typeof body?.endpoint !== 'string') {
      return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
    }

    await pushNotificationService.deleteSubscription(body.endpoint);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error('Error deleting push subscription:', error);
    return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 });
  }
}
