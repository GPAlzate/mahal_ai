import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { userService } from '@/lib/services/UserService';

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() || null : undefined;
  const gcashNumber = typeof body.gcashNumber === 'string' ? body.gcashNumber.trim() || null : undefined;

  let username: string | null | undefined = undefined;
  if (typeof body.username === 'string') {
    username = body.username.trim().toLowerCase() || null;
    if (username !== null && !/^[a-z0-9_]{3,20}$/.test(username)) {
      return NextResponse.json({ error: 'Username must be 3–20 characters: lowercase letters, numbers, and underscores only' }, { status: 400 });
    }
  }

  try {
    const profile = await userService.update(userId, { displayName, gcashNumber, username });
    return NextResponse.json(profile);
  } catch (err: any) {
    if (err?.code === '23505' || err?.message?.includes('unique') || err?.message?.includes('users_username_key')) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    }
    throw err;
  }
}
