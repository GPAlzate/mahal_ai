import { sql } from '@/lib/db';
import { Receipt } from '@/lib/schemas/receipt/public/Receipt';
import { toReceiptLine, ReceiptLineDTO } from '@/lib/schemas/receipt/dto/ReceiptLineDTO';
import { toParticipant, toParticipantDTO } from '@/lib/schemas/participant/dto/ParticipantDTO';
import { toLineParticipant, toLineParticipantDTO } from '@/lib/schemas/participant/dto/LineParticipantDTO';
import { ReceiptSummary } from '@/lib/schemas/receipt/public/ReceiptSummary';
import { ParticipantSplit, LineItemSplit } from '@/lib/schemas/receipt/public/ParticipantSplit';
import { receiptService } from './ReceiptService';
import { Logger } from '@/lib/utils/Logger';

/**
 * Service for calculating receipt summaries and participant splits
 */
export class ReceiptSummaryService {
  protected _logger: Logger;
  constructor() {
    this._logger = new Logger('ReceiptSummaryService');
  }
  /**
   * Helper method: Calculate summary given a receipt object
   * @param receipt - Receipt object from database
   * @returns Complete receipt summary with all participant breakdowns
   */
  private async calculateSummaryFromReceipt(receipt: Receipt): Promise<ReceiptSummary> {
    const receiptId = receipt.id;
    if (!receipt.lines) {
      throw new Error(`Expected receipt ${receiptId} to have lines, but none were found.`)
    }

    // Fetch all participants
    const participantsResult = await sql`
      SELECT * FROM participants
      WHERE receipt_id = ${receiptId} AND deleted_at IS NULL
      ORDER BY id ASC
    `;

    const participants = participantsResult.map(row => toParticipant(toParticipantDTO(row)));

    // Fetch all line assignments
    const assignmentsResult = await sql`
      SELECT * FROM line_participants
      WHERE receipt_line_id IN (
        SELECT id FROM receipt_lines WHERE receipt_id = ${receiptId} AND deleted_at IS NULL
      )
    `;

    const assignments = assignmentsResult.map(row => toLineParticipant(toLineParticipantDTO(row)));

    // Separate lines by type
    const lines = receipt.lines;
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
    const total = subtotal + tax + tip + serviceCharge + discount;

    this._logger.log(`Subtotal: ${subtotal}`)
    this._logger.log(`Tax: ${tax}`)
    this._logger.log(`Tip: ${tip}`)
    this._logger.log(`Service Charge: ${serviceCharge}`)
    this._logger.log(`Discount: ${discount}`)
    this._logger.log(`Total: ${total}`)

    // Pre-index data structures for O(1) lookups (optimization from O(N²) to O(N))
    // Build lookup maps for O(1) access
    const purchaseLineMap = new Map(purchaseLines.map(line => [line.id, line]));
    const discountLineMap = new Map(discountLines.map(line => [line.id, line]));

    // Group assignments by participant and line for efficient lookup
    const assignmentsByParticipant = new Map<number, typeof assignments>();
    const assignmentsByLine = new Map<number, typeof assignments>();

    for (const assignment of assignments) {
      // Group by participant
      if (!assignmentsByParticipant.has(assignment.participantId)) {
        assignmentsByParticipant.set(assignment.participantId, []);
      }
      assignmentsByParticipant.get(assignment.participantId)!.push(assignment);

      // Group by line
      if (!assignmentsByLine.has(assignment.receiptLineId)) {
        assignmentsByLine.set(assignment.receiptLineId, []);
      }
      assignmentsByLine.get(assignment.receiptLineId)!.push(assignment);
    }

    // Pre-calculate total shares for each line
    const totalSharesByLine = new Map<number, number>();
    for (const [lineId, lineAssignments] of assignmentsByLine) {
      const totalShares = lineAssignments.reduce((sum, a) => sum + a.shareQuantity, 0);
      totalSharesByLine.set(lineId, totalShares);

      // Debug logging
      this._logger.log(`Line ${lineId}: ${lineAssignments.length} assignments, totalShares=${totalShares}`);
      this._logger.log(`Assignments: ${JSON.stringify(lineAssignments.map(a => ({ participantId: a.participantId, shareQuantity: a.shareQuantity })))}`);
    }

    // Determine which discount lines are assigned (have at least one assignment)
    const assignedDiscountTotal = discountLines
      .filter(line => assignmentsByLine.has(line.id))
      .reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
    const unassignedDiscountTotal = discount - assignedDiscountTotal;

    this._logger.log(`Assigned discount total: ${assignedDiscountTotal}`);
    this._logger.log(`Unassigned discount total: ${unassignedDiscountTotal}`);

    // Calculate splits for each participant
    const participantSplits: ParticipantSplit[] = participants.map((participant) => {
      const participantAssignments = assignmentsByParticipant.get(participant.id) || [];

      this._logger.log(`====== Participant: ${participant.displayName} ======`)
      // Calculate purchase line item splits
      const lineItems: LineItemSplit[] = participantAssignments
        .filter(assignment => purchaseLineMap.has(assignment.receiptLineId))
        .map((assignment) => {
          const line = purchaseLineMap.get(assignment.receiptLineId)!;
          const totalShares = totalSharesByLine.get(line.id)!;

          const lineTotal = line.unitPrice * line.quantity;
          const shareAmount = (lineTotal * assignment.shareQuantity) / totalShares;

          return {
            receiptLineId: line.id,
            itemName: line.itemName,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            shareQuantity: assignment.shareQuantity,
            shareAmount,
          };
        });

      // Calculate assigned discount line item splits
      const discountLineItems: LineItemSplit[] = participantAssignments
        .filter(assignment => discountLineMap.has(assignment.receiptLineId))
        .map((assignment) => {
          const line = discountLineMap.get(assignment.receiptLineId)!;
          const totalShares = totalSharesByLine.get(line.id)!;

          const lineTotal = line.unitPrice * line.quantity;
          const shareAmount = (lineTotal * assignment.shareQuantity) / totalShares;

          return {
            receiptLineId: line.id,
            itemName: line.itemName,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            shareQuantity: assignment.shareQuantity,
            shareAmount,
          };
        });

      // Add discount line items to the full line items list
      lineItems.push(...discountLineItems);

      // Calculate participant's subtotal (purchase items only)
      const participantSubtotal = lineItems
        .filter(item => purchaseLineMap.has(item.receiptLineId))
        .reduce((sum, item) => sum + item.shareAmount, 0);
      this._logger.log(`Line assignment for: ${JSON.stringify(lineItems, null, 2)}`)

      // Calculate proportional shares of misc charges
      const proportion = subtotal > 0 ? participantSubtotal / subtotal : 0;
      const taxShare = tax * proportion;
      const tipShare = tip * proportion;
      const serviceChargeShare = serviceCharge * proportion;

      // Discount share = assigned discounts + proportional share of unassigned discounts
      const assignedDiscountShare = discountLineItems.reduce((sum, item) => sum + item.shareAmount, 0);
      const proportionalDiscountShare = unassignedDiscountTotal * proportion;
      const discountShare = assignedDiscountShare + proportionalDiscountShare;

      // Calculate participant's total
      const participantTotal =
        participantSubtotal + taxShare + tipShare + serviceChargeShare + discountShare;

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

    const result: ReceiptSummary = {
      receipt,
      participantSplits,
      subtotal,
      tax,
      tip,
      serviceCharge,
      discount,
      total,
    };
    this._logger.log('Final summary result:', JSON.stringify(result, null, 2));

    return result;
  }

  /**
   * Calculate summary by receipt ID
   * @param receiptId - ID of the receipt
   * @returns Complete receipt summary with all participant breakdowns
   */
  async calculateSummary(receiptId: number): Promise<ReceiptSummary> {
    const receipt = await receiptService.getReceipt(receiptId, true);
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
      SELECT rl.id, rl.item_name
      FROM receipt_lines rl
      LEFT JOIN line_participants lp ON rl.id = lp.receipt_line_id
      WHERE rl.receipt_id = ${receiptId}
        AND rl.line_type = 'PRCH'
        AND rl.deleted_at IS NULL
        AND lp.receipt_line_id IS NULL
    `;

    if (unassignedLines.length > 0) {
      const itemNames = unassignedLines.map((l: any) => l.item_name).join(', ');
      throw new Error(
        `Cannot finalize: The following purchase lines are not assigned to any participant: ${itemNames}`
      );
    }
  }
}

/**
 * Singleton instance of ReceiptSummaryService
 */
export const receiptSummaryService = new ReceiptSummaryService();
