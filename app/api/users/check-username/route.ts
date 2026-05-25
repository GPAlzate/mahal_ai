import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { userService } from '@/lib/services/UserService';

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const username = request.nextUrl.searchParams.get('u') ?? '';

  if (!username || !/^[a-z0-9_]{3,20}$/.test(username)) {
    return NextResponse.json({ available: false });
  }

  const taken = await userService.isUsernameTaken(username, userId);
  return NextResponse.json({ available: !taken });
}
