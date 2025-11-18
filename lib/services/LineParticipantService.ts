import { sql } from '@/lib/db';
import { AssignLineParticipantRequest } from '@/lib/schemas/participant/request/AssignLineParticipantRequest';
import { toLineParticipant, toLineParticipantDTO } from '@/lib/schemas/participant/dto/LineParticipantDTO';
import { Logger } from '@/lib/utils/Logger';

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
   * Batch assign participants to receipt lines
   * @param receiptId - ID of the receipt (for validation)
   * @param assignments - Array of assignments to create
   * @returns Array of created line participant assignments
   */
  async batchAssignParticipants(
    receiptId: number,
    assignments: Array<{ receiptLineId: number; participantId: number; shareQuantity: number }>
  ) {
    if (!assignments || assignments.length === 0) {
      return [];
    }

    // Verify receipt exists and is not finalized (once, not per assignment)
    this._logger.log(`Fetching receipt for receiptId ${receiptId}.`)
    const receipt = await sql`
      SELECT id, status FROM receipts
      WHERE id = ${receiptId} AND deleted_at IS NULL
    `;

    if (!receipt || receipt.length === 0) {
      throw new Error('Receipt not found');
    }

    if (receipt[0].status === 'FLZD') {
      throw new Error('Cannot modify finalized receipt');
    }

    // Build array of SQL upsert promises (using ON CONFLICT to update existing assignments)
    this._logger.log(`Creating assignments ${JSON.stringify(assignments, null, 2)} for receipt ${receiptId}.`)
    const upsertPromises = assignments.map((assignment) =>
      sql`
        INSERT INTO line_participants (receipt_line_id, participant_id, share_quantity)
        VALUES (
          ${assignment.receiptLineId},
          ${assignment.participantId},
          ${assignment.shareQuantity}
        )
        ON CONFLICT (receipt_line_id, participant_id)
        DO UPDATE SET share_quantity = ${assignment.shareQuantity}
        RETURNING *
      `
    );

    // Execute all upserts concurrently
    const results = await Promise.all(upsertPromises);

    // Flatten results and convert to public format
    return results.map((result) => toLineParticipant(toLineParticipantDTO(result[0])));
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
    const receipt = await sql`
      SELECT id, status FROM receipts
      WHERE id = ${receiptId} AND deleted_at IS NULL
    `;

    if (!receipt || receipt.length === 0) {
      throw new Error('Receipt not found');
    }

    if (receipt[0].status === 'FLZD') {
      throw new Error('Cannot modify finalized receipt');
    }

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
    const receipt = await sql`
      SELECT id, status FROM receipts
      WHERE id = ${receiptId} AND deleted_at IS NULL
    `;

    if (!receipt || receipt.length === 0) {
      throw new Error('Receipt not found');
    }

    if (receipt[0].status === 'FLZD') {
      throw new Error('Cannot modify finalized receipt');
    }

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
