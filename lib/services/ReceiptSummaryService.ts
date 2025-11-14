import { sql } from '@/lib/db';
import { Receipt } from '@/lib/schemas/receipt/public/Receipt';
import { toReceiptLine, ReceiptLineDTO } from '@/lib/schemas/receipt/dto/ReceiptLineDTO';
import { toParticipant, ParticipantDTO } from '@/lib/schemas/participant/dto/ParticipantDTO';
import { toLineParticipant, LineParticipantDTO } from '@/lib/schemas/participant/dto/LineParticipantDTO';
import { ReceiptSummary } from '@/lib/schemas/receipt/public/ReceiptSummary';
import { ParticipantSplit, LineItemSplit } from '@/lib/schemas/receipt/public/ParticipantSplit';
import { receiptService } from './ReceiptService';

/**
 * Service for calculating receipt summaries and participant splits
 */
export class ReceiptSummaryService {
  /**
   * Helper method: Calculate summary given a receipt object
   * @param receipt - Receipt object from database
   * @returns Complete receipt summary with all participant breakdowns
   */
  private async calculateSummaryFromReceipt(receipt: Receipt): Promise<ReceiptSummary> {
    const receiptId = receipt.id;

    // Fetch all receipt lines
    const linesResult = await sql`
      SELECT * FROM receipt_lines
      WHERE receipt_id = ${receiptId} AND deleted_at IS NULL
      ORDER BY id ASC
    `;

    const lines = (linesResult as ReceiptLineDTO[]).map(toReceiptLine);

    // Fetch all participants
    const participantsResult = await sql`
      SELECT * FROM participants
      WHERE receipt_id = ${receiptId} AND deleted_at IS NULL
      ORDER BY id ASC
    `;

    const participants = (participantsResult as ParticipantDTO[]).map(toParticipant);

    // Fetch all line assignments
    const assignmentsResult = await sql`
      SELECT * FROM line_participants
      WHERE receipt_line_id IN (
        SELECT id FROM receipt_lines WHERE receipt_id = ${receiptId} AND deleted_at IS NULL
      )
    `;

    const assignments = (assignmentsResult as LineParticipantDTO[]).map(toLineParticipant);

    // Separate lines by type
    const purchaseLines = lines.filter((l) => l.receiptLineType === 'PRCH');
    const taxLines = lines.filter((l) => l.receiptLineType === 'TAX');
    const tipLines = lines.filter((l) => l.receiptLineType === 'TIP');
    const serviceLines = lines.filter((l) => l.receiptLineType === 'SRVC');
    const discountLines = lines.filter((l) => l.receiptLineType === 'DSCT');

    // Calculate receipt-level totals
    const subtotal = purchaseLines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
    const tax = taxLines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
    const tip = tipLines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
    const serviceCharge = serviceLines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
    const discount = discountLines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
    const total = subtotal + tax + tip + serviceCharge - discount;

    // Calculate splits for each participant
    const participantSplits: ParticipantSplit[] = participants.map((participant) => {
      // Get all purchase line assignments for this participant
      const participantAssignments = assignments.filter(
        (a) => a.participantId === participant.id
      );

      // Calculate line item splits
      const lineItems: LineItemSplit[] = participantAssignments
        .map((assignment) => {
          const line = purchaseLines.find((l) => l.id === assignment.receiptLineId);
          if (!line) {
            return null;
          }

          // Calculate total shares for this line
          const lineAssignments = assignments.filter(
            (a) => a.receiptLineId === line.id
          );
          const totalShares = lineAssignments.reduce((sum, a) => sum + a.shareQuantity, 0);

          // Calculate this participant's share amount
          const lineTotal = line.unitPrice * line.quantity;
          const shareAmount = (lineTotal * assignment.shareQuantity) / totalShares;

          return {
            receiptLineId: line.id,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            shareQuantity: assignment.shareQuantity,
            shareAmount,
          };
        })
        .filter((item): item is LineItemSplit => item !== null);

      // Calculate participant's subtotal
      const participantSubtotal = lineItems.reduce((sum, item) => sum + item.shareAmount, 0);

      // Calculate proportional shares of misc charges
      const proportion = subtotal > 0 ? participantSubtotal / subtotal : 0;
      const taxShare = tax * proportion;
      const tipShare = tip * proportion;
      const serviceChargeShare = serviceCharge * proportion;
      const discountShare = discount * proportion;

      // Calculate participant's total
      const participantTotal =
        participantSubtotal + taxShare + tipShare + serviceChargeShare - discountShare;

      return {
        participantId: participant.id,
        displayName: participant.displayName,
        lineItems,
        subtotal: participantSubtotal,
        taxShare,
        tipShare,
        serviceChargeShare,
        discountShare,
        total: participantTotal,
      };
    });

    return {
      receipt,
      participantSplits,
      subtotal,
      tax,
      tip,
      serviceCharge,
      discount,
      total,
    };
  }

  /**
   * Calculate summary by receipt ID
   * @param receiptId - ID of the receipt
   * @returns Complete receipt summary with all participant breakdowns
   */
  async calculateSummary(receiptId: number): Promise<ReceiptSummary> {
    const receipt = await receiptService.getReceipt(receiptId);
    return this.calculateSummaryFromReceipt(receipt);
  }

  /**
   * Calculate summary by share code
   * @param shareCode - 5-character share code
   * @returns Complete receipt summary with all participant breakdowns
   */
  async calculateSummaryByShareCode(shareCode: string): Promise<ReceiptSummary> {
    const receipt = await receiptService.findReceiptByShareCode(shareCode);
    return this.calculateSummaryFromReceipt(receipt);
  }

  /**
   * Validate that all purchase lines have at least one participant assigned
   * @param receiptId - ID of the receipt
   * @throws Error if any purchase lines are unassigned
   */
  async validateAllLinesAssigned(receiptId: number): Promise<void> {
    const unassignedLines = await sql`
      SELECT rl.id, rl.description
      FROM receipt_lines rl
      LEFT JOIN line_participants lp ON rl.id = lp.receipt_line_id
      WHERE rl.receipt_id = ${receiptId}
        AND rl.receipt_line_type = 'PRCH'
        AND rl.deleted_at IS NULL
        AND lp.receipt_line_id IS NULL
    `;

    if (unassignedLines.length > 0) {
      const descriptions = unassignedLines.map((l: any) => l.description).join(', ');
      throw new Error(
        `Cannot finalize: The following purchase lines are not assigned to any participant: ${descriptions}`
      );
    }
  }
}

/**
 * Singleton instance of ReceiptSummaryService
 */
export const receiptSummaryService = new ReceiptSummaryService();
