/**
 * Character set for share codes
 * Excludes confusing characters: 0 (zero), O (letter O), 1 (one), I (letter I), L (letter L)
 * This makes codes easier to read and communicate verbally
 */
const SHARE_CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/**
 * Length of generated share codes
 *
 * The share code is the capability that grants access to a receipt, so its
 * length sets the brute-force cost. 31^5 is ~2.9e7, which is small enough that
 * the rate limiting on the share-code lookup endpoint is load-bearing.
 */
const SHARE_CODE_LENGTH = 5;

/**
 * Draw `count` uniformly distributed indices into SHARE_CODE_CHARS.
 *
 * Uses a CSPRNG — Math.random() is a predictable PRNG whose internal state can
 * be recovered from a handful of observed outputs, which would let anyone who
 * has seen a few share codes derive the ones issued after them.
 *
 * Rejection sampling discards the tail of the byte range that would otherwise
 * bias the low-numbered characters.
 */
function randomIndices(count: number): number[] {
  const alphabetSize = SHARE_CODE_CHARS.length;
  const limit = Math.floor(256 / alphabetSize) * alphabetSize;
  const indices: number[] = [];

  while (indices.length < count) {
    const bytes = new Uint8Array(count);
    crypto.getRandomValues(bytes);

    for (const byte of bytes) {
      if (byte < limit) {
        indices.push(byte % alphabetSize);
      }

      if (indices.length === count) {
        break;
      }
    }
  }

  return indices;
}

/**
 * Generate a random share code
 * Excludes confusing characters (0, O, 1, I, L) for better readability
 *
 * @returns A 5-character share code (e.g., "A3X9K")
 *
 * @example
 * ```typescript
 * const code = generateShareCode();
 * console.log(code); // "K4P7N"
 * ```
 */
export function generateShareCode(): string {
  return randomIndices(SHARE_CODE_LENGTH)
    .map((index) => SHARE_CODE_CHARS[index])
    .join('');
}

/**
 * Validate if a string is a valid share code format
 *
 * @param code - The code to validate
 * @returns true if the code is valid, false otherwise
 *
 * @example
 * ```typescript
 * validateShareCode("A3X9K"); // true
 * validateShareCode("ABC");   // false (too short)
 * validateShareCode("A3X9KZ"); // false (too long)
 * validateShareCode("A3O9K"); // false (contains 'O')
 * ```
 */
export function validateShareCode(code: string): boolean {
  if (code.length !== SHARE_CODE_LENGTH) {
    return false;
  }

  // Check if all characters are in the allowed set
  for (const char of code.toUpperCase()) {
    if (!SHARE_CODE_CHARS.includes(char)) {
      return false;
    }
  }

  return true;
}
