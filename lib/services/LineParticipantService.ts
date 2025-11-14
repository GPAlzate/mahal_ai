import { sql } from '@/lib/db';
import { AssignLineParticipantRequest } from '@/lib/schemas/participant/request/AssignLineParticipantRequest';
import { toLineParticipant, LineParticipantDTO } from '@/lib/schemas/participant/dto/LineParticipantDTO';

/**
 * Service for managing line participant assignments
 */
export class LineParticipantService {
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

    return (result as LineParticipantDTO[]).map(toLineParticipant);
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
    return results.map((result) => toLineParticipant(result[0] as LineParticipantDTO));
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

      return toLineParticipant(result[0] as LineParticipantDTO);
    }

    // Create new assignment
    const result = await sql`
      INSERT INTO line_participants (receipt_line_id, participant_id, share_quantity)
      VALUES (${receiptLineId}, ${assignmentData.participantId}, ${assignmentData.shareQuantity})
      RETURNING *
    `;

    return toLineParticipant(result[0] as LineParticipantDTO);
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

    return toLineParticipant(result[0] as LineParticipantDTO);
  }
}

/**
 * Singleton instance of LineParticipantService
 */
export const lineParticipantService = new LineParticipantService();
