import { NextRequest, NextResponse } from 'next/server';
import { lineParticipantService } from '@/lib/services/LineParticipantService';
import { BatchAssignLineParticipantsRequestSchema } from '@/lib/schemas/participant/request/BatchAssignLineParticipantsRequest';
import { Logger } from '@/lib/utils/Logger';

const logger = new Logger('POST /api/line-participants');

/**
 * POST /api/line-participants/batch
 * Batch assign participants to receipt lines
 *
 * Request body:
 * {
 *   receiptId: number,
 *   assignments: [
 *     { receiptLineId: number, participantId: number, shareQuantity: number }
 *   ]
 * }
 *
 * Response: Array of created/updated assignments
 * [
 *   {
 *     receiptLineId: number,
 *     participantId: number,
 *     shareQuantity: number
 *   }
 * ]
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validation = BatchAssignLineParticipantsRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { receiptId, assignments } = validation.data;

    const result = await lineParticipantService.batchAssignParticipants(receiptId, assignments);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error batch assigning participants:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Failed to batch assign participants';

    const status = errorMessage.includes('not found')
      ? 404
      : errorMessage.includes('Cannot modify')
        ? 403
        : 500;

    return NextResponse.json({ error: errorMessage }, { status });
  }
}
