import { NextRequest, NextResponse } from 'next/server';
import { lineParticipantService } from '@/lib/services/LineParticipantService';

/**
 * DELETE /api/receipts/[id]/lines/[lineId]/assignments/[participantId]
 * Unassign a participant from a receipt line
 *
 * Response:
 * {
 *   receiptLineId: number,
 *   participantId: number,
 *   shareQuantity: number
 * }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string; participantId: string }> }
) {
  try {
    const { id, lineId, participantId } = await params;
    const receiptId = +id;
    const receiptLineId = +lineId;
    const participantIdNum = +participantId;

    if (isNaN(receiptId) || isNaN(receiptLineId) || isNaN(participantIdNum)) {
      return NextResponse.json(
        { error: 'Invalid receipt ID, line ID, or participant ID' },
        { status: 400 }
      );
    }

    const assignment = await lineParticipantService.unassignParticipant(
      receiptId,
      receiptLineId,
      participantIdNum
    );

    return NextResponse.json(assignment, { status: 200 });
  } catch (error) {
    console.error('Error unassigning participant:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to unassign participant';

    const status = errorMessage.includes('not found')
      ? 404
      : errorMessage.includes('Cannot modify')
        ? 403
        : 500;

    return NextResponse.json({ error: errorMessage }, { status });
  }
}
