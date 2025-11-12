import { neon } from '@neondatabase/serverless';
import { getDatabaseURL } from '@/lib/env';

/**
 * Database connection using Neon serverless driver
 * Provides a simple SQL tagged template interface for queries
 *
 * @example
 * ```typescript
 * import { sql } from '@/lib/db';
 *
 * const receipts = await sql`SELECT * FROM receipts WHERE id = ${id}`;
 * ```
 */
export const sql = neon(getDatabaseURL());
