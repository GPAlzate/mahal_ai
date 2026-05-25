import { sql } from '@/lib/db';
import { generateShareCode } from '@/lib/helpers/ShareCodeHelper';
import { ParsedReceipt } from '@/lib/schemas/receipt/public/ParsedReceipt';
import { toReceipt, toReceiptDTO } from '@/lib/schemas/receipt/dto/ReceiptDTO';
import { ReceiptLineDTOSchema } from '@/lib/schemas/receipt/dto/ReceiptLineDTO';
import { Receipt, ReceiptStatusSchema } from '@/lib/schemas/receipt/public/Receipt';
import { CreateReceiptRequest } from '@/lib/schemas/receipt/request/CreateReceiptRequest';
import { openAIService } from '@/lib/services/OpenAIService';
import { Logger } from '@/lib/utils/Logger';

/**
 * Service for managing receipts
 */
export class ReceiptService {
  protected _logger: Logger;
  constructor() {
    this._logger = new Logger(ReceiptService.name);
  }

  /**
   * Create a new receipt with a unique share code
   *
   * @param request - CreateReceiptRequest
   * @returns Created receipt with id, share_code, status, created_at
   * @throws Error if unable to generate unique share code
   */
  async createReceipt(request: CreateReceiptRequest) {
    console.time('Receipt creation')
    const maxAttempts = 5;
    let attempts = 0;

    // Convert receiptTime string to Date object if provided
    const receiptTimeValue = request.receiptTime ? new Date(request.receiptTime) : new Date();

    // TODO: revisit logic; should we create share code on creation? or only finalization
    while (attempts < maxAttempts) {
      const shareCode = generateShareCode();

      try {
        const result = await sql`
          INSERT INTO receipts (share_code, status, image_uri, title, receipt_time, owner_id)
          VALUES (
            ${shareCode},
            ${request.status},
            ${request.imageURI || null},
            ${request.title || null},
            ${receiptTimeValue},
            ${request.ownerId || null}
          )
          RETURNING *
        `;
        console.timeEnd('Receipt creation')
        if (result && result.length > 0) {
          const receiptDTO = toReceiptDTO(result[0]);
          return { receipt: toReceipt(receiptDTO) };
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

  private parseReceiptWithLinesResult(result: any[]): Receipt {
    if (result.length === 0) {
      throw new Error('Receipt not found');
    }

    const linesDTOs = result
      .filter((row: any) => row.line_id)
      .map((row: any) => ReceiptLineDTOSchema.parse({
        id: row.line_id,
        receipt_id: row.receipt_id,
        item_name: row.item_name,
        quantity: row.quantity,
        unit_price: row.unit_price,
        line_type: row.line_type,
        line_position: row.line_position,
        created_at: row.line_created_at,
        updated_at: row.line_updated_at,
        deleted_at: null,
      }));

    return toReceipt(toReceiptDTO(result[0]), linesDTOs);
  }

  /**
   * Get receipt by ID
   * @param receiptId - ID of the receipt
   * @param includeLines - If true, fetches receipt with lines via JOIN
   * @returns Receipt object (with optional lines array)
   * @throws Error if receipt not found
   */
  async getReceipt(receiptId: number, includeLines: boolean = false): Promise<Receipt> {
    this._logger.log(`Calling getReceipt for receiptId: ${receiptId}. Including lines: ${includeLines}`)
    if (!includeLines) {
      // Simple query without lines
      const result = await sql`
        SELECT * FROM receipts
        WHERE id = ${receiptId} AND deleted_at IS NULL
      `;

      if (result.length === 0) {
        throw new Error(`Receipt ${receiptId} not found`);
      }

      return toReceipt(toReceiptDTO(result[0]));
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
        rl.line_position,
        rl.created_at as line_created_at,
        rl.updated_at as line_updated_at
      FROM receipts r
      LEFT JOIN receipt_lines rl ON r.id = rl.receipt_id AND rl.deleted_at IS NULL
      WHERE r.id = ${receiptId} AND r.deleted_at IS NULL
      ORDER BY rl.line_position ASC, rl.created_at ASC
    `;

    return this.parseReceiptWithLinesResult(result);
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
        rl.line_position,
        rl.created_at as line_created_at,
        rl.updated_at as line_updated_at
      FROM receipts r
      LEFT JOIN receipt_lines rl ON r.id = rl.receipt_id AND rl.deleted_at IS NULL
      WHERE r.share_code = ${shareCode.toUpperCase()} AND r.deleted_at IS NULL
      ORDER BY rl.line_position ASC, rl.created_at ASC
    `;

    return this.parseReceiptWithLinesResult(result);
  }

  /**
   * Get all non-deleted receipts owned by a user, with participant count.
   * @param ownerId - Clerk user ID
   */
  async findByOwnerId(ownerId: string) {
    const rows = await sql`
      SELECT
        r.id,
        r.title,
        r.share_code,
        r.receipt_time,
        r.status,
        array_agg(p.display_name ORDER BY p.created_at) FILTER (WHERE p.id IS NOT NULL AND p.user_id IS DISTINCT FROM ${ownerId}) AS participant_names
      FROM receipts r
      LEFT JOIN participants p ON p.receipt_id = r.id AND p.deleted_at IS NULL
      WHERE r.deleted_at IS NULL
        AND r.status != 'DLTD'
        AND r.owner_id = ${ownerId}
      GROUP BY r.id
      ORDER BY r.updated_at DESC
    `;

    return rows.map((row: any) => ({
      id: row.id as number,
      title: row.title as string | null,
      shareCode: row.share_code as string,
      receiptTime: row.receipt_time as Date,
      status: row.status as string,
      participantNames: (row.participant_names ?? []) as string[],
    }));
  }

  async findWhereUserIsOwed(userId: string) {
    const rows = await sql`
      SELECT
        r.id,
        r.title,
        r.share_code,
        r.receipt_time,
        r.status,
        array_agg(p.display_name ORDER BY p.created_at) FILTER (WHERE p.id IS NOT NULL AND p.user_id IS DISTINCT FROM ${userId}) AS participant_names
      FROM receipts r
      JOIN participants my_p ON my_p.id = r.payer_participant_id
        AND my_p.user_id = ${userId}
        AND my_p.deleted_at IS NULL
      LEFT JOIN participants p ON p.receipt_id = r.id AND p.deleted_at IS NULL
      WHERE r.deleted_at IS NULL
        AND r.status != 'DLTD'
      GROUP BY r.id
      ORDER BY r.updated_at DESC
    `;

    return rows.map((row: any) => ({
      id: row.id as number,
      title: row.title as string | null,
      shareCode: row.share_code as string,
      receiptTime: row.receipt_time as Date,
      status: row.status as string,
      participantNames: (row.participant_names ?? []) as string[],
    }));
  }

  async findWhereUserOwes(userId: string) {
    const rows = await sql`
      SELECT
        r.id,
        r.title,
        r.share_code,
        r.receipt_time,
        r.status,
        array_agg(p.display_name ORDER BY p.created_at) FILTER (WHERE p.id IS NOT NULL AND p.user_id IS DISTINCT FROM ${userId}) AS participant_names
      FROM receipts r
      JOIN participants my_p ON my_p.receipt_id = r.id
        AND my_p.user_id = ${userId}
        AND my_p.deleted_at IS NULL
      LEFT JOIN participants p ON p.receipt_id = r.id AND p.deleted_at IS NULL
      WHERE r.deleted_at IS NULL
        AND r.status != 'DLTD'
        AND my_p.id != r.payer_participant_id
      GROUP BY r.id
      ORDER BY r.updated_at DESC
    `;

    return rows.map((row: any) => ({
      id: row.id as number,
      title: row.title as string | null,
      shareCode: row.share_code as string,
      receiptTime: row.receipt_time as Date,
      status: row.status as string,
      participantNames: (row.participant_names ?? []) as string[],
    }));
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

    return toReceipt(toReceiptDTO(result[0]));
  }

  /**
   * Update receipt title
   * @param receiptId - ID of the receipt
   * @param title - New title value (null to clear)
   */
  async updateTitle(receiptId: number, title: string | null) {
    const result = await sql`
      UPDATE receipts
      SET title = ${title}, updated_at = NOW()
      WHERE id = ${receiptId} AND deleted_at IS NULL
      RETURNING *
    `;

    if (!result || result.length === 0) {
      throw new Error('Receipt not found');
    }

    return toReceipt(toReceiptDTO(result[0]));
  }

  /**
   * Set the participant who footed the bill
   * @param receiptId - ID of the receipt
   * @param payerParticipantId - ID of the participant who paid
   */
  async updatePayerParticipant(receiptId: number, payerParticipantId: number) {
    const [result] = await Promise.all([
      sql`
        WITH r AS (
          SELECT id, owner_id, gcash_number FROM receipts WHERE id = ${receiptId} AND deleted_at IS NULL
        )
        UPDATE receipts
        SET
          payer_participant_id = ${payerParticipantId},
          gcash_number = CASE
            WHEN r.gcash_number IS NULL
              AND p.user_id IS NOT NULL
              AND p.user_id = r.owner_id
              AND u.gcash_number IS NOT NULL
            THEN u.gcash_number
            ELSE r.gcash_number
          END,
          updated_at = NOW()
        FROM r
        JOIN participants p ON p.id = ${payerParticipantId} AND p.deleted_at IS NULL
        LEFT JOIN users u ON u.clerk_user_id = r.owner_id AND u.deleted_at IS NULL
        WHERE receipts.id = r.id
        RETURNING receipts.*
      `,
      sql`
        UPDATE participants
        SET payment_status = 'PNYP', updated_at = NOW()
        WHERE receipt_id = ${receiptId} AND payment_status = 'PAID' AND deleted_at IS NULL
      `,
    ]);

    if (!result || result.length === 0) {
      throw new Error('Receipt not found');
    }

    await sql`
      UPDATE participants
      SET payment_status = 'PAID', updated_at = NOW()
      WHERE id = ${payerParticipantId} AND deleted_at IS NULL
    `;

    return toReceipt(toReceiptDTO(result[0]));
  }

  async updateGcashNumber(receiptId: number, gcashNumber: string | null): Promise<Receipt> {
    const result = await sql`
      UPDATE receipts
      SET gcash_number = ${gcashNumber}, updated_at = NOW()
      WHERE id = ${receiptId} AND deleted_at IS NULL
      RETURNING *
    `;

    if (result.length === 0) {
      throw new Error('Receipt not found');
    }

    return toReceipt(toReceiptDTO(result[0]));
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

    const lines = parsedData.receiptLines;

    const result = await sql`
      INSERT INTO receipt_lines (receipt_id, line_type, item_name, unit_price, quantity, line_position)
      SELECT * FROM UNNEST(
        ${lines.map(() => receiptId)}::bigint[],
        ${lines.map(l => l.receiptLineType)}::receipt_line_type[],
        ${lines.map(l => l.itemName)}::text[],
        ${lines.map(l => l.unitPrice)}::numeric[],
        ${lines.map(l => l.quantity)}::numeric[],
        ${lines.map((_, i) => i)}::int[]
      )
      RETURNING id, receipt_id, line_type, item_name, unit_price, quantity, line_position, created_at
    `;

    return result.map(row => row).filter(Boolean);
  }

  /**
   * Attach an image URI to an existing receipt.
   * Called when the client-side blob upload completes after the receipt was
   * already created (the "optimistic navigation" flow).
   *
   * @param receiptId - ID of the receipt to update
   * @param imageURI - Public Vercel Blob URL for the receipt image
   */
  async attachImageURI(receiptId: number, imageURI: string) {
    const result = await sql`
      UPDATE receipts
      SET image_uri = ${imageURI}, updated_at = NOW()
      WHERE id = ${receiptId} AND deleted_at IS NULL
      RETURNING id
    `;

    if (!result || result.length === 0) {
      throw new Error(`Receipt ${receiptId} not found`);
    }
  }

  /**
   * Parse receipt image in background
   * Updates receipt status to 'DRFT' on success or 'DLTD' on error
   * Also updates title and receipt_time from parsed data
   * @param receiptId - ID of the receipt
   * @param imageBase64 - Base64 encoded image data URI
   */
  async parseInBackground(receiptId: number, imageBase64: string) {
    try {
      this._logger.log(`Starting background parsing for receipt ${receiptId}`);
      console.time(`🕐 [background ${receiptId}] total`);

      // Parse receipt image with OpenAI
      console.time(`🕐 [background ${receiptId}] openai parse`);
      const parsedReceipt = await openAIService.parseReceiptImage(imageBase64);
      console.timeEnd(`🕐 [background ${receiptId}] openai parse`);

      this._logger.log(`Successfully parsed, adding line items and metadata`);

      // Add line items to receipt
      console.time(`🕐 [background ${receiptId}] add line items`);
      await this.addParsedLineItems(receiptId, parsedReceipt);
      console.timeEnd(`🕐 [background ${receiptId}] add line items`);

      // Update receipt with parsed title and receipt_time
      const receiptTimeValue = parsedReceipt.receiptDate ? new Date(parsedReceipt.receiptDate) : null;
      const suggestedTitle = parsedReceipt.suggestedTitle || parsedReceipt.merchantName || null;

      console.time(`🕐 [background ${receiptId}] update receipt status`);
      await sql`
        UPDATE receipts
        SET
          title = ${suggestedTitle},
          receipt_time = COALESCE(${receiptTimeValue}, receipt_time),
          scanned_subtotal = ${parsedReceipt.subtotal ?? null},
          scanned_total = ${parsedReceipt.amountDue ?? null},
          status = ${ReceiptStatusSchema.enum.DRFT},
          updated_at = NOW()
        WHERE id = ${receiptId} AND deleted_at IS NULL
      `;
      console.timeEnd(`🕐 [background ${receiptId}] update receipt status`);

      console.timeEnd(`🕐 [background ${receiptId}] total`);
      this._logger.log(`[Receipt ${receiptId}] Parsing complete, status updated to DRFT`);
    } catch (error) {
      this._logger.error(`[Receipt ${receiptId}] Parsing failed:`, error);

      // Update receipt status to DLTD (mark as deleted/failed)
      try {
        await this.updateStatus(receiptId, 'DLTD');
        this._logger.log(`Receipt ${receiptId} status updated to DLTD (failed)`);
      } catch (updateError) {
        this._logger.error(`Failed to update status for receipt ${receiptId}:`, updateError);
      }
    }
  }
}

/**
 * Singleton instance of ReceiptService
 */
export const receiptService = new ReceiptService();
