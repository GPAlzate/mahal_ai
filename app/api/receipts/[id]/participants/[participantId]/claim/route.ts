import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { participantService } from '@/lib/services/ParticipantService';

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
    return NextResponse.json(participant, { status: 200 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to claim participant';
    const status = msg.includes('not found') ? 404
      : msg.includes('already claimed') || msg.includes('Already a participant') ? 409
      : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
