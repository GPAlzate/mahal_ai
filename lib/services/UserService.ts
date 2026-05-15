import { sql } from '@/lib/db';

export interface UserProfile {
  clerkUserId: string;
  displayName: string | null;
  gcashNumber: string | null;
}

function toUserProfile(row: any): UserProfile {
  return {
    clerkUserId: row.clerk_user_id,
    displayName: row.display_name ?? null,
    gcashNumber: row.gcash_number ?? null,
  };
}

export class UserService {
  async getOrCreate(clerkUserId: string): Promise<UserProfile> {
    const result = await sql`
      INSERT INTO users (clerk_user_id)
      VALUES (${clerkUserId})
      ON CONFLICT (clerk_user_id) DO UPDATE
        SET clerk_user_id = EXCLUDED.clerk_user_id
      RETURNING *
    `;
    return toUserProfile(result[0]);
  }

  async update(
    clerkUserId: string,
    data: { displayName?: string | null; gcashNumber?: string | null }
  ): Promise<UserProfile> {
    const result = await sql`
      UPDATE users
      SET
        display_name  = COALESCE(${data.displayName ?? null}, display_name),
        gcash_number  = COALESCE(${data.gcashNumber ?? null}, gcash_number),
        updated_at    = NOW()
      WHERE clerk_user_id = ${clerkUserId} AND deleted_at IS NULL
      RETURNING *
    `;

    if (result.length === 0) {
      throw new Error('User not found');
    }

    return toUserProfile(result[0]);
  }
}

export const userService = new UserService();
