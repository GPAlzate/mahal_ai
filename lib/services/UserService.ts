import { sql } from '@/lib/db';

export interface UserProfile {
  clerkUserId: string;
  username: string | null;
  displayName: string | null;
  gcashNumber: string | null;
}

export interface UserSearchResult {
  userId: string;
  username: string;
  displayName: string | null;
}

function toUserProfile(row: any): UserProfile {
  return {
    clerkUserId: row.clerk_user_id,
    username: row.username ?? null,
    displayName: row.display_name ?? null,
    gcashNumber: row.gcash_number ?? null,
  };
}

function buildSlug(firstName?: string | null, email?: string | null): string {
  const fromName = firstName
    ? firstName
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 16)
    : null;

  const fromEmail = email
    ? email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16)
    : null;

  const base = fromName || fromEmail || 'user';
  return base.length >= 1 ? base : 'user';
}

export class UserService {
  async getOrCreate(
    clerkUserId: string,
    hint?: { firstName?: string | null; email?: string | null }
  ): Promise<UserProfile> {
    const existing = await sql`
      SELECT * FROM users WHERE clerk_user_id = ${clerkUserId} AND deleted_at IS NULL LIMIT 1
    `;

    if (existing.length > 0) {
      if (existing[0].username) {
        return toUserProfile(existing[0]);
      }
      return this.assignAutoUsername(clerkUserId, hint);
    }

    const result = await sql`
      INSERT INTO users (clerk_user_id)
      VALUES (${clerkUserId})
      ON CONFLICT (clerk_user_id) DO NOTHING
      RETURNING *
    `;

    if (result.length > 0) {
      return this.assignAutoUsername(clerkUserId, hint);
    }

    const fallback = await sql`
      SELECT * FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `;

    if (fallback[0].username) {
      return toUserProfile(fallback[0]);
    }

    return this.assignAutoUsername(clerkUserId, hint);
  }

  private async assignAutoUsername(
    clerkUserId: string,
    hint?: { firstName?: string | null; email?: string | null }
  ): Promise<UserProfile> {
    const slug = buildSlug(hint?.firstName, hint?.email);

    for (let attempt = 0; attempt < 10; attempt++) {
      const suffix = String(Math.floor(Math.random() * 900) + 100);
      const candidate = `${slug}${suffix}`;

      try {
        const result = await sql`
          UPDATE users
          SET username = ${candidate}, updated_at = NOW()
          WHERE clerk_user_id = ${clerkUserId} AND username IS NULL
          RETURNING *
        `;

        if (result.length > 0) {
          return toUserProfile(result[0]);
        }

        const refetch = await sql`
          SELECT * FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
        `;
        return toUserProfile(refetch[0]);
      } catch (err: any) {
        if (err?.code === '23505' || err?.message?.includes('users_username_key')) {
          continue;
        }
        throw err;
      }
    }

    // All 10 attempts collided — derive unique handle from clerk ID
    const idSlug = `u${clerkUserId.replace(/[^a-z0-9]/g, '').slice(-17)}`;
    const result = await sql`
      UPDATE users
      SET username = ${idSlug}, updated_at = NOW()
      WHERE clerk_user_id = ${clerkUserId} AND username IS NULL
      RETURNING *
    `;

    if (result.length > 0) {
      return toUserProfile(result[0]);
    }

    const refetch = await sql`
      SELECT * FROM users WHERE clerk_user_id = ${clerkUserId} LIMIT 1
    `;
    return toUserProfile(refetch[0]);
  }

  async update(
    clerkUserId: string,
    data: { displayName?: string | null; gcashNumber?: string | null; username?: string | null }
  ): Promise<UserProfile> {
    const result = await sql`
      UPDATE users
      SET
        display_name  = COALESCE(${data.displayName ?? null}, display_name),
        gcash_number  = COALESCE(${data.gcashNumber ?? null}, gcash_number),
        username      = COALESCE(${data.username ?? null}, username),
        updated_at    = NOW()
      WHERE clerk_user_id = ${clerkUserId} AND deleted_at IS NULL
      RETURNING *
    `;

    if (result.length === 0) {
      throw new Error('User not found');
    }

    return toUserProfile(result[0]);
  }

  async search(query: string): Promise<UserSearchResult[]> {
    const q = query.toLowerCase().trim();

    if (!q) {
      return [];
    }

    const result = await sql`
      SELECT clerk_user_id, username, display_name
      FROM users
      WHERE deleted_at IS NULL
        AND username IS NOT NULL
        AND (
          username ILIKE ${q + '%'}
          OR display_name ILIKE ${'%' + q + '%'}
        )
      ORDER BY
        CASE WHEN username = ${q} THEN 0
             WHEN username ILIKE ${q + '%'} THEN 1
             ELSE 2
        END,
        username
      LIMIT 10
    `;

    return result.map((r) => ({
      userId: r.clerk_user_id,
      username: r.username,
      displayName: r.display_name ?? null,
    }));
  }

  async isUsernameTaken(username: string, excludeClerkUserId?: string): Promise<boolean> {
    if (excludeClerkUserId) {
      const result = await sql`
        SELECT 1 FROM users
        WHERE username = ${username}
          AND deleted_at IS NULL
          AND clerk_user_id != ${excludeClerkUserId}
        LIMIT 1
      `;
      return result.length > 0;
    }

    const result = await sql`
      SELECT 1 FROM users
      WHERE username = ${username}
        AND deleted_at IS NULL
      LIMIT 1
    `;
    return result.length > 0;
  }
}

export const userService = new UserService();
