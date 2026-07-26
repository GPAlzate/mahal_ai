import { NextRequest, NextResponse } from 'next/server';
import { guardReceipt } from '@/lib/server/receiptAuth';
import { participantService } from '@/lib/services/ParticipantService';
import { UpdateParticipantRequestSchema } from '@/lib/schemas/participant/request/UpdateParticipantRequest';

/**
 * PUT /api/receipts/[id]/participants/[participantId]
 * Update a participant's name
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
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; participantId: string }> }
) {
  try {
    const { id, participantId } = await params;
    const receiptId = +id;
    const participantIdNum = +participantId;

    if (isNaN(receiptId) || isNaN(participantIdNum)) {
      return NextResponse.json({ error: 'Invalid receipt ID or participant ID' }, { status: 400 });
    }

    const gate = await guardReceipt(request, receiptId, 'write');

    if (!gate.ok) {
      return gate.response;
    }

    const body = await request.json();

    // Validate request body
    const validation = UpdateParticipantRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const participant = await participantService.updateParticipant(
      receiptId,
      participantIdNum,
      validation.data
    );

    return NextResponse.json(participant, { status: 200 });
  } catch (error) {
    console.error('Error updating participant:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to update participant';

    const status = errorMessage.includes('not found')
      ? 404
      : errorMessage.includes('Cannot modify')
        ? 403
        : 500;

    return NextResponse.json({ error: errorMessage }, { status });
  }
}

/**
 * DELETE /api/receipts/[id]/participants/[participantId]
 * Soft delete a participant
 *
 * Response:
 * {
 *   id: number,
 *   receiptId: number,
 *   displayName: string,
 *   createdAt: timestamp,
 *   updatedAt: timestamp,
 *   deletedAt: timestamp
 * }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; participantId: string }> }
) {
  try {
    const { id, participantId } = await params;
    const receiptId = +id;
    const participantIdNum = +participantId;

    if (isNaN(receiptId) || isNaN(participantIdNum)) {
      return NextResponse.json({ error: 'Invalid receipt ID or participant ID' }, { status: 400 });
    }

    const gate = await guardReceipt(request, receiptId, 'write');

    if (!gate.ok) {
      return gate.response;
    }

    const participant = await participantService.deleteParticipant(receiptId, participantIdNum);

    return NextResponse.json(participant, { status: 200 });
  } catch (error) {
    console.error('Error deleting participant:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to delete participant';

    const status = errorMessage.includes('not found')
      ? 404
      : errorMessage.includes('Cannot modify')
        ? 403
        : 500;

    return NextResponse.json({ error: errorMessage }, { status });
  }
}
