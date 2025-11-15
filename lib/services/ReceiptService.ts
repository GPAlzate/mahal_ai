import { sql } from '@/lib/db';
import { generateShareCode } from '@/lib/helpers/ShareCodeHelper';
import { ParsedReceipt } from '@/lib/schemas/receipt/public/ParsedReceipt';
import { toReceipt, ReceiptDTO } from '@/lib/schemas/receipt/dto/ReceiptDTO';
import { Receipt } from '@/lib/schemas/receipt/public/Receipt';
import { openAIService } from '@/lib/services/OpenAIService';
import { Logger } from '@/lib/utils/Logger';

const logger = new Logger('ReceiptService');

/**
 * Service for managing receipts
 */
export class ReceiptService {
  /**
   * Create a new receipt with a unique share code
   *
   * @param imageURI - Optional Vercel Blob URL for the receipt image
   * @returns Created receipt with id, share_code, status, created_at
   * @throws Error if unable to generate unique share code
   */
  async createReceipt(imageURI: string) {
    console.time('Receipt creation')
    const maxAttempts = 5;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const shareCode = generateShareCode();

      try {
        const result = await sql`
          INSERT INTO receipts (share_code, status, image_uri)
          VALUES (${shareCode}, 'DRFT', ${imageURI || null})
          RETURNING *
        `;
        console.timeEnd('Receipt creation')
        if (result && result.length > 0) {
          const receiptDTO = result[0] as ReceiptDTO;
          return toReceipt(receiptDTO);
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
   * Get receipt by ID
   * @param receiptId - ID of the receipt
   * @param includeLines - If true, fetches receipt with lines via JOIN
   * @returns Receipt object (with optional lines array)
   * @throws Error if receipt not found
   */
  async getReceipt(receiptId: number, includeLines: boolean = false): Promise<Receipt> {
    logger.log(`Calling getReceipt for receiptId: ${receiptId}. Including lines: ${includeLines}`)
    if (!includeLines) {
      // Simple query without lines
      const result = await sql`
        SELECT * FROM receipts
        WHERE id = ${receiptId} AND deleted_at IS NULL
      `;

      if (result.length === 0) {
        throw new Error(`Receipt ${receiptId} not found`);
      }

      return toReceipt(result[0] as ReceiptDTO);
    }

    // Query with LEFT JOIN to include lines
    const result = await sql`
      SELECT
        r.*,
        rl.id as line_id,
        rl.receipt_id,
        rl.item_name,
        rl.quantity,
        rl.unit_price,
        rl.line_type,
        rl.created_at as line_created_at,
        rl.updated_at as line_updated_at
      FROM receipts r
      LEFT JOIN receipt_lines rl ON r.id = rl.receipt_id AND rl.deleted_at IS NULL
      WHERE r.id = ${receiptId} AND r.deleted_at IS NULL
      ORDER BY rl.created_at ASC
    `;

    if (result.length === 0) {
      throw new Error(`Receipt ${receiptId} not found`);
    }

    // Map joined rows to ReceiptLineDTOs
    const linesDTOs = result
      .filter((row: any) => row.line_id) // Skip rows with no line (LEFT JOIN with no match)
      .map((row: any) => ({
        id: row.line_id,
        receipt_id: row.receipt_id,
        item_name: row.item_name,
        quantity: row.quantity,
        unit_price: row.unit_price,
        line_type: row.line_type,
        created_at: row.line_created_at,
        updated_at: row.line_updated_at,
        deleted_at: null,
      }));

    return toReceipt(result[0] as ReceiptDTO, linesDTOs);
  }

  /**
   * Find receipt by share code
   * Always includes lines (for sharing context)
   * @param shareCode - 5-character share code
   * @returns Receipt object with lines
   * @throws Error if receipt not found
   */
  async findReceiptByShareCode(shareCode: string): Promise<Receipt> {
    // Query with LEFT JOIN to include lines
    const result = await sql`
      SELECT
        r.*,
        rl.id as line_id,
        rl.receipt_id,
        rl.item_name,
        rl.quantity,
        rl.unit_price,
        rl.line_type,
        rl.created_at as line_created_at,
        rl.updated_at as line_updated_at
      FROM receipts r
      LEFT JOIN receipt_lines rl ON r.id = rl.receipt_id AND rl.deleted_at IS NULL
      WHERE r.share_code = ${shareCode.toUpperCase()} AND r.deleted_at IS NULL
      ORDER BY rl.created_at ASC
    `;

    if (result.length === 0) {
      throw new Error('Receipt not found');
    }

    // Map joined rows to ReceiptLineDTOs
    const linesDTOs = result
      .filter((row: any) => row.line_id) // Skip rows with no line (LEFT JOIN with no match)
      .map((row: any) => ({
        id: row.line_id,
        receipt_id: row.receipt_id,
        item_name: row.item_name,
        quantity: row.quantity,
        unit_price: row.unit_price,
        line_type: row.line_type,
        created_at: row.line_created_at,
        updated_at: row.line_updated_at,
        deleted_at: null,
      }));

    return toReceipt(result[0] as ReceiptDTO, linesDTOs);
  }

  /**
   * Update receipt status
   * @param receiptId - ID of the receipt
   * @param status - New status value
   * @throws Error if receipt not found
   */
  async updateStatus(receiptId: number, status: string) {
    const result = await sql`
      UPDATE receipts
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${receiptId} AND deleted_at IS NULL
      RETURNING *
    `;

    if (!result || result.length === 0) {
      throw new Error('Receipt not found');
    }

    return toReceipt(result[0] as ReceiptDTO);
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
          ${line.itemName},
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

  /**
   * Parse receipt image in background
   * Updates receipt status to 'DRFT' on success or 'DLTD' on error
   * @param receiptId - ID of the receipt
   * @param imageBase64 - Base64 encoded image data URI
   */
  async parseInBackground(receiptId: number, imageBase64: string) {
    try {
      logger.log(`Starting background parsing for receipt ${receiptId}`);

      // Parse receipt image with OpenAI
      const parsedReceipt = await openAIService.parseReceiptImage(imageBase64);

      logger.log(`Successfully parsed, adding line items`);

      // Add line items to receipt
      await this.addParsedLineItems(receiptId, parsedReceipt);

      // Update receipt status to DRFT (ready)
      await this.updateStatus(receiptId, 'DRFT');

      logger.log(`[Receipt ${receiptId}] Parsing complete, status updated to DRFT`);
    } catch (error) {
      logger.error(`[Receipt ${receiptId}] Parsing failed:`, error);

      // Update receipt status to DLTD (mark as deleted/failed)
      try {
        await this.updateStatus(receiptId, 'DLTD');
        logger.log(`Receipt ${receiptId} status updated to DLTD (failed)`);
      } catch (updateError) {
        logger.error(`Failed to update status for receipt ${receiptId}:`, updateError);
      }
    }
  }
}

/**
 * Singleton instance of ReceiptService
 */
export const receiptService = new ReceiptService();
