import { NextRequest, NextResponse } from 'next/server';
import { participantService } from '@/lib/services/ParticipantService';
import { CreateParticipantRequestSchema } from '@/lib/schemas/participant/request/CreateParticipantRequest';

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
 * Add a new participant to a receipt
 *
 * Request body:
 * {
 *   displayName: string
 * }
 *
 * Response:
 * {
 *   id: number,
 *   receiptId: number,
 *   displayName: string,
 *   createdAt: timestamp,
 *   updatedAt: timestamp,
 *   deletedAt: timestamp | null
 * }
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

    const body = await request.json();

    // Validate request body
    const validation = CreateParticipantRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const participant = await participantService.createParticipant(receiptId, validation.data);

    return NextResponse.json(participant, { status: 201 });
  } catch (error) {
    console.error('Error creating participant:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to create participant';

    const status = errorMessage.includes('not found')
      ? 404
      : errorMessage.includes('Cannot modify')
        ? 403
        : 500;

    return NextResponse.json({ error: errorMessage }, { status });
  }
}
