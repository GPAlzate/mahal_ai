import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { participantService } from '@/lib/services/ParticipantService';
import { BatchCreateParticipantsRequestSchema } from '@/lib/schemas/participant/request/CreateParticipantRequest';

/**
 * GET /api/receipts/[id]/participants
 * Get all participants for a receipt
 *
 * Response:
 * [
 *   {
 *     id: number,
 *     receiptId: number,
 *     displayName: string,
 *     createdAt: timestamp,
 *     updatedAt: timestamp,
 *     deletedAt: timestamp | null
 *   }
 * ]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const receiptId = +id;

    if (isNaN(receiptId)) {
      return NextResponse.json({ error: 'Invalid receipt ID' }, { status: 400 });
    }

    const participants = await participantService.getParticipants(receiptId);

    return NextResponse.json(participants, { status: 200 });
  } catch (error) {
    console.error('Error fetching participants:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch participants';

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * POST /api/receipts/[id]/participants
 * Add participant(s) to a receipt
 * Always expects an array (single participant is a singleton array)
 *
 * Request body:
 * [
 *   { displayName: string },
 *   { displayName: string }
 * ]
 *
 * Response:
 * [
 *   {
 *     id: number,
 *     receiptId: number,
 *     displayName: string,
 *     createdAt: timestamp,
 *     updatedAt: timestamp,
 *     deletedAt: timestamp | null
 *   }
 * ]
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const receiptId = +id;

    if (isNaN(receiptId)) {
      return NextResponse.json({ error: 'Invalid receipt ID' }, { status: 400 });
    }

    const { userId: authedUserId } = await auth();
    const body = await request.json();

    // Validate request body (expects array of participants)
    const validation = BatchCreateParticipantsRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    // Only allow userId to be saved if it matches the authenticated user
    const sanitized = validation.data.map((p) => ({
      ...p,
      userId: p.userId === authedUserId ? p.userId : undefined,
    }));

    const participants = await participantService.batchCreateParticipants(
      receiptId,
      sanitized
    );

    return NextResponse.json(participants, { status: 201 });
  } catch (error) {
    console.error('Error creating participant(s):', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to create participant(s)';

    const status = errorMessage.includes('not found')
      ? 404
      : errorMessage.includes('Cannot modify')
        ? 403
        : 500;

    return NextResponse.json({ error: errorMessage }, { status });
  }
}
