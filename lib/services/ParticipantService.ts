import { sql } from '@/lib/db';
import { CreateParticipantRequest } from '@/lib/schemas/participant/request/CreateParticipantRequest';
import { UpdateParticipantRequest } from '@/lib/schemas/participant/request/UpdateParticipantRequest';
import { toParticipant, toParticipantDTO } from '@/lib/schemas/participant/dto/ParticipantDTO';
import { validateReceiptExists } from '@/lib/services/receiptValidation';
import { PaymentStatus } from '@/lib/schemas/participant/public/PaymentStatus';

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
    await validateReceiptExists(receiptId);

    if (createParticipantsRequest.length === 0) {
      return [];
    }

    const rows = createParticipantsRequest.map(p => ({
      receiptId,
      displayName: p.displayName,
      userId: p.userId ?? null,
    }));

    const result = await sql`
      INSERT INTO participants (receipt_id, display_name, user_id, payment_status)
      SELECT * FROM UNNEST(
        ${rows.map(r => r.receiptId)}::bigint[],
        ${rows.map(r => r.displayName)}::text[],
        ${rows.map(r => r.userId)}::text[],
        ${rows.map(() => 'PNYP')}::payment_status[]
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
    // Verify receipt exists
    await validateReceiptExists(receiptId);

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
    // Verify receipt exists
    await validateReceiptExists(receiptId);

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

    await sql`
      DELETE FROM line_participants
      WHERE participant_id = ${participantId}
    `;

    return toParticipant(toParticipantDTO(result[0]));
  }

  async claimParticipant(participantId: number, userId: string) {
    const check = await sql`
      SELECT
        p.id,
        p.user_id,
        EXISTS(
          SELECT 1 FROM participants p2
          WHERE p2.receipt_id = p.receipt_id
            AND p2.user_id = ${userId}
            AND p2.deleted_at IS NULL
        ) AS already_on_receipt
      FROM participants p
      WHERE p.id = ${participantId} AND p.deleted_at IS NULL
    `;

    if (check.length === 0) {
      throw new Error('Participant not found');
    }

    if (check[0].user_id !== null) {
      throw new Error('Participant already claimed');
    }

    if (check[0].already_on_receipt) {
      throw new Error('Already a participant on this receipt');
    }

    const result = await sql`
      UPDATE participants
      SET user_id = ${userId}, updated_at = NOW()
      WHERE id = ${participantId} AND user_id IS NULL
      RETURNING *
    `;

    if (result.length === 0) {
      throw new Error('Participant already claimed');
    }

    return toParticipant(toParticipantDTO(result[0]));
  }

  async updatePaymentStatus(
    receiptId: number,
    participantId: number,
    paymentStatus: PaymentStatus
  ) {
    const participantCheck = await sql`
      SELECT id FROM participants
      WHERE id = ${participantId} AND receipt_id = ${receiptId} AND deleted_at IS NULL
    `;

    if (participantCheck.length === 0) {
      throw new Error('Participant not found');
    }

    const result = await sql`
      UPDATE participants
      SET payment_status = ${paymentStatus}, updated_at = NOW()
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
