import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { getOpenAIAPIKey } from '@/lib/env';
import { RECEIPT_PARSER_PROMPT } from '@/lib/prompts/receiptParser';
import { ParsedReceipt, ParsedReceiptSchema } from '@/lib/schemas/receipt/public/ParsedReceipt';
import { Logger } from '../utils/Logger';

/**
 * Service for interacting with OpenAI API
 */
export class OpenAIService {
  private client: OpenAI;
  protected logger: any;

  constructor() {
    this.logger = new Logger(OpenAIService.name);
    this.client = new OpenAI({
      apiKey: getOpenAIAPIKey(),
    });
  }

  /**
   * Parse a receipt image using GPT-4o-mini via Responses API with Structured Outputs
   *
   * Model choice: gpt-4o-mini provides excellent OCR accuracy at a fraction of the cost
   * of larger models, making it ideal for receipt parsing tasks.
   *
   * Uses OpenAI Structured Outputs to ensure type-safe, schema-validated responses.
   * No need for manual JSON parsing or validation - OpenAI guarantees schema adherence.
   *
   * @param imageBase64 - Base64 data URI of the receipt image (e.g., "data:image/jpeg;base64,...")
   * @returns Structured receipt data with line items and misc charges
   * @throws Error if the API call fails or model refuses
   */
  async parseReceiptImage(imageBase64: string): Promise<ParsedReceipt> {
    try {
      this.logger.log('Starting receipt image parsing with GPT-4o-mini');

      console.time('Receipt Parsing')
      const response = await this.client.responses.parse({
        model: 'gpt-4o-mini',
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
                image_url: imageBase64,
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
        this.logger.error('No parsed output received from OpenAI');
        throw new Error('No parsed output from OpenAI');
      }

      this.logger.log(`Successfully parsed receipt image: ${JSON.stringify(response, null, 2)}`);
      return response.output_parsed;
    } catch (error) {
      this.logger.error('Failed to parse receipt image:', error);
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
