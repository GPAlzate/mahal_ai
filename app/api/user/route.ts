import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { userService } from '@/lib/services/UserService';

export async function GET() {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await userService.getOrCreate(user.id, {
    firstName: user.firstName,
    email: user.emailAddresses[0]?.emailAddress,
  });

  return NextResponse.json(profile);
}
