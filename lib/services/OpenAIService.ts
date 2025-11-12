import OpenAI from 'openai';
import { getOpenAIAPIKey } from '@/lib/env';
import { RECEIPT_PARSER_PROMPT } from '@/lib/prompts/receiptParser';
import { ParsedReceipt } from '@/lib/schemas/ParsedReceipt';

/**
 * Service for interacting with OpenAI API
 */
export class OpenAIService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: getOpenAIAPIKey(),
    });
  }

  /**
   * Parse a receipt image using GPT-4o-mini via Responses API
   *
   * Model choice: gpt-4o-mini provides excellent OCR accuracy at a fraction of the cost
   * of larger models, making it ideal for receipt parsing tasks.
   *
   * @param imageUrl - Public URL of the receipt image (e.g., from Vercel Blob)
   * @returns Structured receipt data with line items and misc charges
   * @throws Error if the API call fails or response is invalid
   */
  async parseReceiptImage(imageUrl: string): Promise<ParsedReceipt> {
    try {
      const response = await this.client.responses.create({
        model: 'gpt-4o-mini', // TODO: play around with this
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
                image_url: imageUrl,
                detail: 'high', // High detail for accurate text extraction
              },
            ],
          },
        ],
      });

      const content = response.output_text;

      if (!content) {
        throw new Error('No response from OpenAI');
      }

      // Parse the JSON response
      const parsed = JSON.parse(content) as ParsedReceipt;

      // Validate the response has the expected structure
      if (parsed.error) {
        throw new Error(parsed.error);
      }

      if (!parsed.items || !Array.isArray(parsed.items)) {
        throw new Error('Invalid response format: missing items array');
      }

      return parsed;
    } catch (error) {
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
