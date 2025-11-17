/**
 * Receipt parser prompt components for OpenAI GPT-4 Vision
 * Instructs the model to extract structured data from receipt photos
 */

// ============================================================================
// Schema Field Definitions - Maps directly to ParsedReceiptSchema
// ============================================================================

const RECEIPT_LINE_FIELDS = `
**Receipt Line Fields (ParsedReceiptLineSchema):**

Each item in the receiptLines array must have:

1. **itemName** (string, required):
   - Look for: Item description, menu item, product name, charge description
   - Examples: "Burger", "Tax", "Service Charge", "10% Discount"
   - Keep original text from receipt, don't abbreviate or translate

2. **quantity** (number, positive, required):
   - Look for: "Qty", "x", number before item name, multiplication indicator
   - Examples: "2x Burger" → quantity: 2, "Tax" → quantity: 1
   - Default to 1 for single items, taxes, tips, service charges, discounts
   - If not clearly visible or identifiable: SET TO 1

3. **unitPrice** (number, required):
   - The price per SINGLE unit (totalPrice ÷ quantity)
   - Look for: Price per item, unit cost
   - For items with quantity > 1: divide totalPrice by quantity
   - For discounts: MUST be negative (e.g., -20.00)
   - Can be negative for discounts, otherwise typically positive

4. **totalPrice** (number, required):
   - The total cost for this line (unitPrice × quantity)
   - Look for: Line total, extended price, amount column (usually right side)
   - Must equal unitPrice × quantity
   - For discounts: MUST be negative (e.g., -50.00 not 50.00)

5. **receiptLineType** (enum: "PRCH" | "TAX" | "TIP" | "SRVC" | "DSCT", required):
   - "PRCH" (Purchase): Food, drinks, products, merchandise, any item being bought
   - "TAX" (Tax): Sales tax, VAT, GST, any government tax
   - "TIP" (Tip/Gratuity): Tip, gratuity, service tip
   - "SRVC" (Service Charge): Service charge, service fee, delivery fee, convenience fee
   - "DSCT" (Discount): ANY reduction in price - identified by:
     * Negative sign before amount: -100.00
     * Amount in parentheses: (100.00)
     * Keywords: "discount", "dsct", "promo", "promotion", "coupon", "off", "reduction", "rebate", "PWD", "exemption"
     * Any line that reduces the total amount
`;

const RECEIPT_LEVEL_FIELDS = `
**Receipt-Level Fields (ParsedReceiptSchema):**

1. **merchantName** (string, optional):
   - Look for: Store name, restaurant name, business name at the top of receipt
   - Usually found: Header section, largest text, company logo area
   - If not clearly visible or identifiable: DO NOT SET

2. **receiptDate** (format: YYYY-MM-DD, string, optional):
   - Look for: Date stamp, transaction date, "Date:", timestamp
   - Usually found: Top or bottom of receipt near merchant name or total
   - Must convert to YYYY-MM-DD format (e.g., "Jan 15, 2025" → "2025-01-15")
   - If not clearly visible or identifiable: DO NOT SET

3. **currency** (string, required):
   - Look for: Currency symbol (₱, $, €, etc.), currency code (PHP, USD, EUR)
   - Usually found: Next to amounts, in totals section
   - Must be 3-letter currency code (e.g., "PHP" not "₱", "USD" not "$")
   - Common conversions: ₱ → PHP, $ → USD, € → EUR, £ → GBP

4. **subtotal** (number, required):
   - The sum of ONLY the PRCH (purchase) items BEFORE any taxes, tips, service charges, or discounts
   - Look for: "Subtotal", "Sub Total", "Total" sum of items before additional charges
   - Calculate by adding all PRCH line totalPrice values
   - Must be non-negative number

5. **amountDue** (number, required):
   - The FINAL total amount to be paid AFTER all taxes, tips, service charges, and discounts
   - Look for: "Total", "Amount Due", "Total Due", "Grand Total", largest number at bottom
   - This is what the customer actually pays
   - Must be non-negative number
`;

// ============================================================================
// Parsing Instructions
// ============================================================================

const DISCOUNT_DETECTION_RULES = `
**CRITICAL: Discount Detection and Handling:**

Discounts can appear in multiple formats on receipts. You MUST identify ALL of these:

1. **Format Indicators:**
   - Negative sign: "-100.00", "-₱50"
   - Parentheses: "(100.00)", "(₱50)"
   - Keywords in itemName: "discount", "dsct", "promo", "coupon", "off", "%off", "reduction", "rebate", "savings", "PWD", "exempt"

2. **Required Actions for Discounts:**
   - Set receiptLineType to "DSCT"
   - Make totalPrice NEGATIVE (e.g., -100.00)
   - Make unitPrice NEGATIVE (e.g., -100.00)
   - Even if receipt shows as positive or in parentheses, convert to negative in output

3. **Examples:**
   - Receipt shows "(50.00) Discount" → totalPrice: -50.00, unitPrice: -50.00, receiptLineType: "DSCT"
   - Receipt shows "10% OFF" with "₱25" → totalPrice: -25.00, unitPrice: -25.00, receiptLineType: "DSCT"
   - Receipt shows "-15.00 PROMO" → totalPrice: -15.00, unitPrice: -15.00, receiptLineType: "DSCT"
   - Receipt shows "20 PWD Discount" → totalPrice: -20.00, unitPrice: -20.00, receiptLineType: "DSCT"
`;

const PARSING_RULES = `
**General Parsing Rules:**

1. **Completeness:**
   - Extract ALL visible line items including purchases, taxes, tips, service charges, and discounts
   - Do NOT skip or omit any charges shown on the receipt
   - Include every line that has a non-zero price

2. **Accuracy:**
   - All monetary values must be numbers (not strings)
   - Preserve exact amounts shown on receipt
   - Double-check that totalPrice = unitPrice × quantity for each line
   - Verify that subtotal matches sum of all PRCH items
   - Verify that amountDue matches the final total on receipt

3. **Edge Cases:**
   - Line items with price of 0 or 0.00 should be OMITTED entirely
   - If quantity is not shown, default to 1
   - If merchant name is unclear or generic (e.g., "Store"), set to null
   - If date is ambiguous or not found, set to null

4. **Output Format:**
   - Return ONLY valid JSON matching the schema
   - No additional text, explanation, or markdown formatting
   - No comments in JSON output
`;

// ============================================================================
// Example Output
// ============================================================================

const EXAMPLE_OUTPUT = `
**Example JSON Output:**

{
  "merchantName": "The Coffee Shop",
  "receiptDate": "2025-01-15",
  "receiptLines": [
    {
      "itemName": "Cappuccino",
      "quantity": 2,
      "unitPrice": 120.00,
      "totalPrice": 240.00,
      "receiptLineType": "PRCH"
    },
    {
      "itemName": "Croissant",
      "quantity": 1,
      "unitPrice": 85.00,
      "totalPrice": 85.00,
      "receiptLineType": "PRCH"
    },
    {
      "itemName": "PWD",
      "quantity": 1,
      "unitPrice": -32.50,
      "totalPrice": -32.50,
      "receiptLineType": "DSCT"
    },
    {
      "itemName": "VAT (12%)",
      "quantity": 1,
      "unitPrice": 35.10,
      "totalPrice": 35.10,
      "receiptLineType": "TAX"
    },
    {
      "itemName": "Service Charge",
      "quantity": 1,
      "unitPrice": 20.00,
      "totalPrice": 20.00,
      "receiptLineType": "SRVC"
    }
  ],
  "currency": "PHP",
  "subtotal": 325.00,
  "amountDue": 347.60
}
`;

// ============================================================================
// Complete Prompt
// ============================================================================

export const RECEIPT_PARSER_PROMPT = `You are a receipt parser assistant. Analyze the provided receipt image and extract all relevant information in a structured JSON format that matches the ParsedReceiptSchema and ParsedReceiptLineSchema.

${RECEIPT_LINE_FIELDS}

${RECEIPT_LEVEL_FIELDS}

${DISCOUNT_DETECTION_RULES}

${PARSING_RULES}

${EXAMPLE_OUTPUT}

Return ONLY the JSON output with no additional text.`;
