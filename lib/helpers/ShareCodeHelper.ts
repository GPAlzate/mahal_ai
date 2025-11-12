/**
 * Character set for share codes
 * Excludes confusing characters: 0 (zero), O (letter O), 1 (one), I (letter I), L (letter L)
 * This makes codes easier to read and communicate verbally
 */
const SHARE_CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/**
 * Length of generated share codes
 */
const SHARE_CODE_LENGTH = 5;

/**
 * Generate a random 5-character alphanumeric share code
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
  let code = '';
  for (let i = 0; i < SHARE_CODE_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * SHARE_CODE_CHARS.length);
    code += SHARE_CODE_CHARS[randomIndex];
  }
  return code;
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
