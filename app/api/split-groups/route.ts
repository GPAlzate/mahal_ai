import { NextRequest, NextResponse } from 'next/server';
import { guardReceipt } from '@/lib/server/receiptAuth';
import { receiptService } from '@/lib/services/ReceiptService';
import { participantService } from '@/lib/services/ParticipantService';
import { lineParticipantService } from '@/lib/services/LineParticipantService';
import { SplitGroup } from '@/lib/schemas/receipt/public/SplitGroup';

/**
 * GET /api/split-groups?receiptId={id}
 * Get split group (receipt with lines + participants) by receipt ID
 *
 * Query params:
 * - receiptId: number (required)
 *
 * Response: SplitGroup
 * {
 *   receipt: Receipt (with lines),
 *   participants: Participant[]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const receiptIdParam = searchParams.get('receiptId');

    if (!receiptIdParam) {
      return NextResponse.json({ error: 'Missing receiptId query parameter' }, { status: 400 });
    }

    const receiptId = +receiptIdParam;

    if (isNaN(receiptId)) {
      return NextResponse.json({ error: 'Invalid receipt ID' }, { status: 400 });
    }

    const gate = await guardReceipt(request, receiptId, 'read');

    if (!gate.ok) {
      return gate.response;
    }

    // Fetch receipt with lines, participants, and assignments in parallel
    const [receipt, participants, assignments] = await Promise.all([
      receiptService.getReceipt(receiptId, true), // includeLines = true
      participantService.getParticipants(receiptId),
      lineParticipantService.getAssignmentsByReceipt(receiptId),
    ]);

    const splitGroup: SplitGroup = {
      receipt,
      participants,
      assignments,
    };

    return NextResponse.json(splitGroup, { status: 200 });
  } catch (error) {
    console.error('Error fetching split group:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch split group';

    const status = errorMessage.includes('not found') ? 404 : 500;

    return NextResponse.json({ error: errorMessage }, { status });
  }
}
