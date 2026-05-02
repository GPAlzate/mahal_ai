import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { getOpenAIAPIKey } from '@/lib/env';
import { RECEIPT_PARSER_PROMPT } from '@/lib/prompts/receiptParser';
import { ParsedReceipt, ParsedReceiptSchema } from '@/lib/schemas/receipt/public/ParsedReceipt';
import { Logger } from '@/lib/utils/Logger';

/**
 * Service for interacting with OpenAI API
 */
export class OpenAIService {
  private client: OpenAI;
  protected _logger: Logger;

  constructor() {
    this._logger = new Logger(OpenAIService.name);
    this.client = new OpenAI({
      apiKey: getOpenAIAPIKey(),
    });
  }

  /**
   * Parse a receipt image using GPT-5.1 via Responses API with Structured Outputs
   *
   * Uses OpenAI Structured Outputs to ensure type-safe, schema-validated responses.
   * No need for manual JSON parsing or validation - OpenAI guarantees schema adherence.
   *
   * @param imageURL - Public image URL (Vercel Blob) or Base64 data URI
   * @returns Structured receipt data with line items and misc charges
   * @throws Error if the API call fails or model refuses
   */
  async parseReceiptImage(imageURL: string): Promise<ParsedReceipt> {
    try {
      this._logger.log('Starting receipt image parsing with GPT-5.1');

      console.time('Receipt Parsing')
      const response = await this.client.responses.parse({
        model: 'gpt-5.1',
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: RECEIPT_PARSER_PROMPT,
              },
              {
                type: 'input_image',
                image_url: imageURL,
                detail: 'high', // High detail for accurate text extraction
              },
            ],
          },
        ],
        text: {
          format: zodTextFormat(ParsedReceiptSchema, 'receipt'),
        },
      });
      console.timeEnd('Receipt Parsing')

      // Structured Outputs automatically validates and parses the response
      if (!response.output_parsed) {
        throw new Error('No parsed output from OpenAI');
      }

      if (!response.output_parsed.isReceipt) {
        throw new Error('Image is not a receipt');
      }

      this._logger.log(
        `Successfully parsed receipt image: ${response.output_parsed.receiptLines.length} lines, ` +
          `currency=${response.output_parsed.currency}, amountDue=${response.output_parsed.amountDue}`
      );
      return response.output_parsed;
    } catch (error) {
      this._logger.error('Failed to parse receipt image:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to parse receipt: ${error.message}`);
      }
      throw new Error('Failed to parse receipt: Unknown error');
    }
  }
}

/**
 * Singleton instance of OpenAIService
 */
export const openAIService = new OpenAIService();
