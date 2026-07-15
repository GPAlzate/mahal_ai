import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sql } from '@/lib/db';
import { participantService } from '@/lib/services/ParticipantService';
import { pushNotificationService } from '@/lib/services/PushNotificationService';

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; participantId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, participantId } = await params;
    const receiptId = +id;
    const participantIdNum = +participantId;

    if (isNaN(receiptId) || isNaN(participantIdNum)) {
      return NextResponse.json({ error: 'Invalid IDs' }, { status: 400 });
    }

    const participant = await participantService.claimParticipant(participantIdNum, userId);

    // "X joined your receipt" — owner only, and not for owners claiming their own spot
    after(async () => {
      try {
        const receiptRows = await sql`
          SELECT title, share_code, owner_id FROM receipts
          WHERE id = ${receiptId} AND deleted_at IS NULL
        `;
        const receipt = receiptRows[0];
        if (!receipt?.owner_id || receipt.owner_id === userId) {
          return;
        }
        await pushNotificationService.notifyJoined({
          ownerId: receipt.owner_id,
          joinerName: participant.displayName,
          receiptTitle: receipt.title,
          shareCode: receipt.share_code,
        });
      } catch (error) {
        console.error('Failed to send joined notification:', error);
      }
    });

    return NextResponse.json(participant, { status: 200 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to claim participant';
    const status = msg.includes('not found') ? 404
      : msg.includes('already claimed') || msg.includes('Already a participant') ? 409
      : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
