import { sql } from '@/lib/db';
import { AssignLineParticipantRequest } from '@/lib/schemas/participant/request/AssignLineParticipantRequest';
import { toLineParticipant, toLineParticipantDTO } from '@/lib/schemas/participant/dto/LineParticipantDTO';
import { Logger } from '@/lib/utils/Logger';
import { validateReceiptIsModifiable } from '@/lib/services/receiptValidation';

/**
 * Service for managing line participant assignments
 *
 * TODO: Migrate from share_quantity to share_percentage model
 *
 * Current model stores share_quantity (e.g., 0.25 burgers per person)
 * which breaks when line quantity is edited (3 burgers → 6 burgers).
 *
 * Future model should store share_percentage (e.g., 0.0833 = 1/12 of line)
 * which is immune to quantity/price changes:
 *   - shareAmount = share_percentage × line.totalPrice
 *   - share_percentage = 1 / total_participants_assigned
 *   - No need to sum totalShares or maintain quantity constraints
 *
 * Migration plan:
 *   1. Add share_percentage column to line_participants table (nullable)
 *   2. Backfill existing data: share_percentage = share_quantity / line.quantity
 *   3. Update calculation in ReceiptSummaryService
 *   4. Update frontend to use percentage-based assignment
 *   5. Drop share_quantity column
 */
export class LineParticipantService {
  protected _logger: Logger;
  constructor() {
    this._logger = new Logger(LineParticipantService.name);
  }
  /**
   * Get all participants assigned to a receipt line
   * @param receiptLineId - ID of the receipt line
   * @returns Array of line participant assignments
   */
  async getLineAssignments(receiptLineId: number) {
    const result = await sql`
      SELECT *
      FROM line_participants
      WHERE receipt_line_id = ${receiptLineId}
      ORDER BY participant_id ASC
    `;

    return result.map(row => toLineParticipant(toLineParticipantDTO(row)));
  }

  /**
   * Get all assignments for a receipt (across all lines)
   * @param receiptId - ID of the receipt
   * @returns Array of all line participant assignments for the receipt
   */
  async getAssignmentsByReceipt(receiptId: number) {
    const result = await sql`
      SELECT lp.*
      FROM line_participants lp
      INNER JOIN receipt_lines rl ON lp.receipt_line_id = rl.id
      WHERE rl.receipt_id = ${receiptId} AND rl.deleted_at IS NULL
      ORDER BY rl.id ASC, lp.participant_id ASC
    `;

    return result.map(row => toLineParticipant(toLineParticipantDTO(row)));
  }

  /**
   * Batch assign participants to receipt lines.
   * Uses a replace-per-line strategy: for each receiptLineId in the batch, all existing
   * assignments are deleted before inserting the new ones. Lines not present in the batch
   * are left untouched.
   *
   * @param receiptId - ID of the receipt (for validation)
   * @param assignments - Array of assignments to create
   * @returns Array of created line participant assignments
   */
  async batchAssignParticipants(
    receiptId: number,
    assignments: Array<{ receiptLineId: number; participantId: number; shareQuantity: number }>
  ) {
    // Verify receipt exists and is not finalized (once, not per assignment)
    this._logger.log(`Fetching receipt for receiptId ${receiptId}.`)
    await validateReceiptIsModifiable(receiptId);

    // Group by receiptLineId so we can replace all assignments per line
    const byLine = new Map<number, typeof assignments>();
    for (const a of assignments) {
      if (!byLine.has(a.receiptLineId)) {
        byLine.set(a.receiptLineId, []);
      }
      byLine.get(a.receiptLineId)!.push(a);
    }

    this._logger.log(`Replacing assignments for ${byLine.size} lines on receipt ${receiptId}.`);

    const lineResults = await Promise.all(
      Array.from(byLine.entries()).map(async ([lineId, lineAssignments]) => {
        await sql`DELETE FROM line_participants WHERE receipt_line_id = ${lineId}`;

        if (lineAssignments.length === 0) {
          return [];
        }

        const insertResults = await Promise.all(
          lineAssignments.map((a) => sql`
            INSERT INTO line_participants (receipt_line_id, participant_id, share_quantity)
            VALUES (${a.receiptLineId}, ${a.participantId}, ${a.shareQuantity})
            RETURNING *
          `)
        );

        return insertResults.map((r) => toLineParticipant(toLineParticipantDTO(r[0])));
      })
    );

    return lineResults.flat();
  }

  /**
   * Assign a participant to a receipt line
   * @param receiptId - ID of the receipt (for validation)
   * @param receiptLineId - ID of the receipt line
   * @param assignmentData - Assignment data with participantId and shareQuantity
   * @returns Created line participant assignment
   */
  async assignParticipant(
    receiptId: number,
    receiptLineId: number,
    assignmentData: AssignLineParticipantRequest
  ) {
    // Verify receipt exists and is not finalized
    await validateReceiptIsModifiable(receiptId);

    // Verify receipt line exists and belongs to receipt
    const lineCheck = await sql`
      SELECT id FROM receipt_lines
      WHERE id = ${receiptLineId} AND receipt_id = ${receiptId} AND deleted_at IS NULL
    `;

    if (lineCheck.length === 0) {
      throw new Error('Receipt line not found');
    }

    // Verify participant exists and belongs to receipt
    const participantCheck = await sql`
      SELECT id FROM participants
      WHERE id = ${assignmentData.participantId} AND receipt_id = ${receiptId} AND deleted_at IS NULL
    `;

    if (participantCheck.length === 0) {
      throw new Error('Participant not found or does not belong to this receipt');
    }

    // Check if assignment already exists
    const existingAssignment = await sql`
      SELECT * FROM line_participants
      WHERE receipt_line_id = ${receiptLineId} AND participant_id = ${assignmentData.participantId}
    `;

    if (existingAssignment.length > 0) {
      // Update existing assignment
      const result = await sql`
        UPDATE line_participants
        SET share_quantity = ${assignmentData.shareQuantity}
        WHERE receipt_line_id = ${receiptLineId} AND participant_id = ${assignmentData.participantId}
        RETURNING *
      `;

      return toLineParticipant(toLineParticipantDTO(result[0]));
    }

    // Create new assignment
    const result = await sql`
      INSERT INTO line_participants (receipt_line_id, participant_id, share_quantity)
      VALUES (${receiptLineId}, ${assignmentData.participantId}, ${assignmentData.shareQuantity})
      RETURNING *
    `;

    return toLineParticipant(toLineParticipantDTO(result[0]));
  }

  /**
   * Unassign a participant from a receipt line
   * @param receiptId - ID of the receipt (for validation)
   * @param receiptLineId - ID of the receipt line
   * @param participantId - ID of the participant to unassign
   * @returns Deleted line participant assignment
   */
  async unassignParticipant(receiptId: number, receiptLineId: number, participantId: number) {
    // Verify receipt exists and is not finalized
    await validateReceiptIsModifiable(receiptId);

    // Verify assignment exists
    const assignmentCheck = await sql`
      SELECT * FROM line_participants
      WHERE receipt_line_id = ${receiptLineId} AND participant_id = ${participantId}
    `;

    if (assignmentCheck.length === 0) {
      throw new Error('Assignment not found');
    }

    const result = await sql`
      DELETE FROM line_participants
      WHERE receipt_line_id = ${receiptLineId} AND participant_id = ${participantId}
      RETURNING *
    `;

    return toLineParticipant(toLineParticipantDTO(result[0]));
  }
}

/**
 * Singleton instance of LineParticipantService
 */
export const lineParticipantService = new LineParticipantService();
