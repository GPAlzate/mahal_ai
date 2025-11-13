import { NextRequest, NextResponse } from 'next/server';
import { lineParticipantService } from '@/lib/services/LineParticipantService';
import { AssignLineParticipantRequestSchema } from '@/lib/schemas/participant/request/AssignLineParticipantRequest';

/**
 * GET /api/receipts/[id]/lines/[lineId]/assignments
 * Get all participants assigned to a receipt line
 *
 * Response:
 * [
 *   {
 *     receiptLineId: number,
 *     participantId: number,
 *     shareQuantity: number
 *   }
 * ]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  try {
    const { lineId } = await params;
    const receiptLineId = +lineId;

    if (isNaN(receiptLineId)) {
      return NextResponse.json({ error: 'Invalid receipt line ID' }, { status: 400 });
    }

    const assignments = await lineParticipantService.getLineAssignments(receiptLineId);

    return NextResponse.json(assignments, { status: 200 });
  } catch (error) {
    console.error('Error fetching line assignments:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch line assignments';

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * POST /api/receipts/[id]/lines/[lineId]/assignments
 * Assign a participant to a receipt line (or update existing assignment)
 *
 * Request body:
 * {
 *   participantId: number,
 *   shareQuantity: number (default: 1)
 * }
 *
 * Response:
 * {
 *   receiptLineId: number,
 *   participantId: number,
 *   shareQuantity: number
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  try {
    const { id, lineId } = await params;
    const receiptId = +id;
    const receiptLineId = +lineId;

    if (isNaN(receiptId) || isNaN(receiptLineId)) {
      return NextResponse.json({ error: 'Invalid receipt ID or line ID' }, { status: 400 });
    }

    const body = await request.json();

    // Validate request body
    const validation = AssignLineParticipantRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const assignment = await lineParticipantService.assignParticipant(
      receiptId,
      receiptLineId,
      validation.data
    );

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    console.error('Error assigning participant:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to assign participant';

    const status = errorMessage.includes('not found')
      ? 404
      : errorMessage.includes('Cannot modify')
        ? 403
        : 500;

    return NextResponse.json({ error: errorMessage }, { status });
  }
}
