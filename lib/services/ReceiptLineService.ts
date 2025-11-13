import { sql } from '@/lib/db';
import { CreateReceiptLineRequest } from '@/lib/schemas/receipt/request/CreateReceiptLineRequest';
import { UpdateReceiptLineRequest } from '@/lib/schemas/receipt/request/UpdateReceiptLineRequest';

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
      SELECT
        id,
        receipt_id as "receiptId",
        description,
        quantity,
        unit_price as "unitPrice",
        total_price as "totalPrice",
        receipt_line_type as "receiptLineType",
        created_at as "createdAt",
        updated_at as "updatedAt",
        deleted_at as "deletedAt"
      FROM receipt_lines
      WHERE receipt_id = ${receiptId} AND deleted_at IS NULL
      ORDER BY created_at ASC
    `;

    return result;
  }

  /**
   * Create a new receipt line
   * @param receiptId - ID of the receipt
   * @param lineData - Receipt line data
   * @returns Created receipt line
   */
  async createReceiptLine(receiptId: number, lineData: CreateReceiptLineRequest) {
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

    const result = await sql`
      INSERT INTO receipt_lines (
        receipt_id,
        description,
        quantity,
        unit_price,
        total_price,
        receipt_line_type
      )
      VALUES (
        ${receiptId},
        ${lineData.description},
        ${lineData.quantity},
        ${lineData.unitPrice},
        ${lineData.totalPrice},
        ${lineData.receiptLineType}
      )
      RETURNING
        id,
        receipt_id as "receiptId",
        description,
        quantity,
        unit_price as "unitPrice",
        total_price as "totalPrice",
        receipt_line_type as "receiptLineType",
        created_at as "createdAt",
        updated_at as "updatedAt",
        deleted_at as "deletedAt"
    `;

    return result[0];
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

    // Verify line exists and belongs to receipt
    const lineCheck = await sql`
      SELECT id FROM receipt_lines
      WHERE id = ${lineId} AND receipt_id = ${receiptId} AND deleted_at IS NULL
    `;

    if (!lineCheck || lineCheck.length === 0) {
      throw new Error('Receipt line not found');
    }

    // Build dynamic UPDATE query based on provided fields
    const updates: string[] = [];
    const values: any[] = [];

    if (lineData.description !== undefined) {
      updates.push(`description = $${values.length + 1}`);
      values.push(lineData.description);
    }
    if (lineData.quantity !== undefined) {
      updates.push(`quantity = $${values.length + 1}`);
      values.push(lineData.quantity);
    }
    if (lineData.unitPrice !== undefined) {
      updates.push(`unit_price = $${values.length + 1}`);
      values.push(lineData.unitPrice);
    }
    if (lineData.totalPrice !== undefined) {
      updates.push(`total_price = $${values.length + 1}`);
      values.push(lineData.totalPrice);
    }
    if (lineData.receiptLineType !== undefined) {
      updates.push(`receipt_line_type = $${values.length + 1}`);
      values.push(lineData.receiptLineType);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    updates.push(`updated_at = NOW()`);

    const result = await sql`
      UPDATE receipt_lines
      SET ${sql.unsafe(updates.join(', '))}
      WHERE id = ${lineId}
      RETURNING
        id,
        receipt_id as "receiptId",
        description,
        quantity,
        unit_price as "unitPrice",
        total_price as "totalPrice",
        receipt_line_type as "receiptLineType",
        created_at as "createdAt",
        updated_at as "updatedAt",
        deleted_at as "deletedAt"
    `;

    return result[0];
  }

  /**
   * Soft delete a receipt line
   * @param receiptId - ID of the receipt
   * @param lineId - ID of the receipt line
   * @returns Deleted receipt line
   */
  async deleteReceiptLine(receiptId: number, lineId: number) {
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
      RETURNING
        id,
        receipt_id as "receiptId",
        description,
        quantity,
        unit_price as "unitPrice",
        total_price as "totalPrice",
        receipt_line_type as "receiptLineType",
        created_at as "createdAt",
        updated_at as "updatedAt",
        deleted_at as "deletedAt"
    `;

    return result[0];
  }
}

/**
 * Singleton instance of ReceiptLineService
 */
export const receiptLineService = new ReceiptLineService();
