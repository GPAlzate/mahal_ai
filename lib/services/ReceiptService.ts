import { sql } from '@/lib/db';
import { generateShareCode } from '@/lib/helpers/ShareCodeHelper';
import { ParsedReceipt } from '@/lib/schemas/ParsedReceipt';

/**
 * Service for managing receipts
 */
export class ReceiptService {
  /**
   * Create a new receipt with a unique share code
   * Optionally includes parsed line items if parsedData is provided
   *
   * @param parsedData - Optional parsed receipt data from OpenAI
   * @returns Created receipt with id, share_code, status, created_at
   * @throws Error if unable to generate unique share code
   */
  async createReceipt(parsedData?: ParsedReceipt) {
    const maxAttempts = 5;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const shareCode = generateShareCode();

      try {
        const result = await sql`
          INSERT INTO receipts (share_code, status)
          VALUES (${shareCode}, 'DRFT')
          RETURNING id, share_code, status, created_at
        `;

        if (result && result.length > 0) {
          const receipt = result[0];

          // If we have parsed data, add line items to the newly created receipt
          if (parsedData) {
            await this.addParsedLineItems(receipt.id, parsedData);
          }

          return receipt;
        }
      } catch (error: any) {
        // Check if error is due to unique constraint violation (duplicate share_code)
        if (error.code === '23505') {
          attempts++;
          continue;
        }
        // Different error, rethrow
        throw error;
      }
    }

    throw new Error('Failed to generate unique share code after multiple attempts');
  }

  /**
   * Add parsed line items to an existing receipt
   * Executes all inserts concurrently for better performance
   *
   * @param receiptId - ID of the receipt to add items to
   * @param parsedData - Parsed receipt data from OpenAI
   * @returns Array of inserted line items
   * @throws Error if receipt doesn't exist or insert fails
   */
  async addParsedLineItems(receiptId: number, parsedData: ParsedReceipt) {
    // Verify receipt exists
    const receiptCheck = await sql`
      SELECT id FROM receipts WHERE id = ${receiptId} AND deleted_at IS NULL
    `;

    if (!receiptCheck || receiptCheck.length === 0) {
      throw new Error('Receipt not found');
    }

    if (!parsedData.receiptLines || parsedData.receiptLines.length === 0) {
      return [];
    }

    // Build array of SQL insert promises
    const insertPromises = parsedData.receiptLines.map((line) =>
      sql`
        INSERT INTO receipt_lines (receipt_id, line_type, item_name, unit_price, quantity)
        VALUES (
          ${receiptId},
          ${line.receiptLineType},
          ${line.description},
          ${line.unitPrice},
          ${line.quantity}
        )
        RETURNING id, receipt_id, line_type, item_name, unit_price, quantity, created_at
      `
    );

    // Execute all inserts concurrently
    const results = await Promise.all(insertPromises);

    // Flatten results (each query returns an array with one item)
    return results.map((result) => result[0]).filter(Boolean);
  }
}

/**
 * Singleton instance of ReceiptService
 */
export const receiptService = new ReceiptService();
