import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { userService } from '@/lib/services/UserService';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const profile = await userService.getOrCreate(userId);
  return NextResponse.json(profile);
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() || null : undefined;
  const gcashNumber = typeof body.gcashNumber === 'string' ? body.gcashNumber.trim() || null : undefined;

  const profile = await userService.update(userId, { displayName, gcashNumber });
  return NextResponse.json(profile);
}
