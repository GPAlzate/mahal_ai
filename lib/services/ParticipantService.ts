import { sql } from '@/lib/db';
import { CreateParticipantRequest } from '@/lib/schemas/participant/request/CreateParticipantRequest';
import { UpdateParticipantRequest } from '@/lib/schemas/participant/request/UpdateParticipantRequest';
import { toParticipant, toParticipantDTO } from '@/lib/schemas/participant/dto/ParticipantDTO';
import { validateReceiptIsModifiable } from '@/lib/services/receiptValidation';

/**
 * Service for managing participants
 */
export class ParticipantService {
  /**
   * Get all participants for a receipt
   * @param receiptId - ID of the receipt
   * @returns Array of participants
   */
  async getParticipants(receiptId: number) {
    const result = await sql`
      SELECT *
      FROM participants
      WHERE receipt_id = ${receiptId} AND deleted_at IS NULL
      ORDER BY created_at ASC
    `;

    return result.map(row => toParticipant(toParticipantDTO(row)));
  }

  /**
   * Create a new participant. Defers to batchCreateParticipants method
   * @param receiptId - ID of the receipt
   * @param participantData - Participant data
   * @returns Created participant
   */
  async createParticipant(receiptId: number, participantData: CreateParticipantRequest) {
    return (await this.batchCreateParticipants(receiptId, [participantData]))[0];
  }

  /**
   * Create a new participant
   * @param receiptId - ID of the receipt
   * @param createParticipantsRequest - Participant data
   * @returns Created participants
   */
  async batchCreateParticipants(
    receiptId: number,
    createParticipantsRequest: CreateParticipantRequest[]
  ) {
    await validateReceiptIsModifiable(receiptId);

    if (createParticipantsRequest.length === 0) {
      return [];
    }

    const rows = createParticipantsRequest.map(p => [receiptId, p.displayName]);

    const result = await sql`
    INSERT INTO participants (receipt_id, display_name)
    SELECT * FROM UNNEST(
      ${rows.map(r => r[0])}::int[],
      ${rows.map(r => r[1])}::text[]
    )
    RETURNING *
  `;

    return result.map(r => toParticipant(toParticipantDTO(r)));
  }


  /**
   * Update a participant
   * @param receiptId - ID of the receipt
   * @param participantId - ID of the participant
   * @param participantData - Updated participant data
   * @returns Updated participant
   */
  async updateParticipant(
    receiptId: number,
    participantId: number,
    participantData: UpdateParticipantRequest
  ) {
    // Verify receipt exists and is not finalized
    await validateReceiptIsModifiable(receiptId);

    // Verify participant exists and belongs to receipt
    const participantCheck = await sql`
      SELECT id FROM participants
      WHERE id = ${participantId} AND receipt_id = ${receiptId} AND deleted_at IS NULL
    `;

    if (participantCheck.length === 0) {
      throw new Error('Participant not found');
    }

    const result = await sql`
      UPDATE participants
      SET display_name = ${participantData.displayName}, updated_at = NOW()
      WHERE id = ${participantId}
      RETURNING *
    `;

    return toParticipant(toParticipantDTO(result[0]));
  }

  /**
   * Soft delete a participant
   * @param receiptId - ID of the receipt
   * @param participantId - ID of the participant
   * @returns Deleted participant
   */
  async deleteParticipant(receiptId: number, participantId: number) {
    // Verify receipt exists and is not finalized
    await validateReceiptIsModifiable(receiptId);

    // Verify participant exists and belongs to receipt
    const participantCheck = await sql`
      SELECT id FROM participants
      WHERE id = ${participantId} AND receipt_id = ${receiptId} AND deleted_at IS NULL
    `;

    if (participantCheck.length === 0) {
      throw new Error('Participant not found');
    }

    const result = await sql`
      UPDATE participants
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = ${participantId}
      RETURNING *
    `;

    return toParticipant(toParticipantDTO(result[0]));
  }
}

/**
 * Singleton instance of ParticipantService
 */
export const participantService = new ParticipantService();
