import { sql } from '@/lib/db';
import { CreateReceiptLineRequest } from '@/lib/schemas/receipt/request/CreateReceiptLineRequest';
import { UpdateReceiptLineRequest } from '@/lib/schemas/receipt/request/UpdateReceiptLineRequest';
import { toReceiptLine, toReceiptLineDTO } from '@/lib/schemas/receipt/dto/ReceiptLineDTO';
import { validateReceiptExists } from '@/lib/services/receiptValidation';

/**
 * Service for managing receipt lines
 */
export class ReceiptLineService {
  /**
   * Get all receipt lines for a receipt
   * @param receiptId - ID of the receipt
   * @returns Array of receipt lines
   */
  async getReceiptLines(receiptId: number) {
    const result = await sql`
      SELECT *
      FROM receipt_lines
      WHERE receipt_id = ${receiptId} AND deleted_at IS NULL
      ORDER BY line_position ASC, created_at ASC
    `;

    return result.map(row => toReceiptLine(toReceiptLineDTO(row)));
  }

  /**
   * Create a new receipt line
   * @param receiptId - ID of the receipt
   * @param lineData - Receipt line data
   * @returns Created receipt line
   */
  async createReceiptLine(receiptId: number, lineData: CreateReceiptLineRequest) {
    // Verify receipt exists
    await validateReceiptExists(receiptId);

    const position = lineData.linePosition ?? null;
    const result = await sql`
      INSERT INTO receipt_lines (
        receipt_id,
        item_name,
        quantity,
        unit_price,
        line_type,
        line_position
      )
      VALUES (
        ${receiptId},
        ${lineData.itemName},
        ${lineData.quantity},
        ${lineData.unitPrice},
        ${lineData.receiptLineType},
        COALESCE(
          ${position},
          (SELECT MAX(line_position) + 1 FROM receipt_lines WHERE receipt_id = ${receiptId} AND deleted_at IS NULL),
          0
        )
      )
      RETURNING *
    `;

    return toReceiptLine(toReceiptLineDTO(result[0]));
  }

  /**
   * Update a receipt line
   * @param receiptId - ID of the receipt
   * @param lineId - ID of the receipt line
   * @param lineData - Updated receipt line data
   * @returns Updated receipt line
   */
  async updateReceiptLine(
    receiptId: number,
    lineId: number,
    lineData: UpdateReceiptLineRequest
  ) {
    // Verify receipt exists
    await validateReceiptExists(receiptId);

    // Verify line exists and belongs to receipt
    const lineCheck = await sql`
      SELECT id FROM receipt_lines
      WHERE id = ${lineId} AND receipt_id = ${receiptId} AND deleted_at IS NULL
    `;

    if (lineCheck.length === 0) {
      throw new Error('Receipt line not found');
    }

    // Build dynamic update safely using positional parameters
    const fields: string[] = [];
    const values: any[] = [];

    if (lineData.itemName !== undefined) {
      fields.push('item_name');
      values.push(lineData.itemName);
    }
    if (lineData.quantity !== undefined) {
      fields.push('quantity');
      values.push(lineData.quantity);
    }
    if (lineData.unitPrice !== undefined) {
      fields.push('unit_price');
      values.push(lineData.unitPrice);
    }
    if (lineData.receiptLineType !== undefined) {
      fields.push('line_type');
      values.push(lineData.receiptLineType);
    }

    if (fields.length === 0) {
      const result = await sql`
        SELECT * FROM receipt_lines WHERE id = ${lineId}
      `;
      return toReceiptLine(toReceiptLineDTO(result[0]));
    }

    // Always update timestamp
    fields.push('updated_at');
    values.push(new Date());

    // Build SET clause with positional parameters ($1, $2, ...)
    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const query = `
      UPDATE receipt_lines
      SET ${setClause}
      WHERE id = $${fields.length + 1}
      RETURNING *
    `;

    const result = await sql.query(query, [...values, lineId]);

    return toReceiptLine(toReceiptLineDTO(result[0]));
  }

  /**
   * Soft delete a receipt line
   * @param receiptId - ID of the receipt
   * @param lineId - ID of the receipt line
   * @returns Deleted receipt line
   */
  async deleteReceiptLine(receiptId: number, lineId: number) {
    // Verify receipt exists
    await validateReceiptExists(receiptId);

    // Verify line exists and belongs to receipt
    const lineCheck = await sql`
      SELECT id FROM receipt_lines
      WHERE id = ${lineId} AND receipt_id = ${receiptId} AND deleted_at IS NULL
    `;

    if (!lineCheck || lineCheck.length === 0) {
      throw new Error('Receipt line not found');
    }

    const result = await sql`
      UPDATE receipt_lines
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = ${lineId}
      RETURNING *
    `;

    return toReceiptLine(toReceiptLineDTO(result[0]));
  }
}

/**
 * Singleton instance of ReceiptLineService
 */
export const receiptLineService = new ReceiptLineService();
