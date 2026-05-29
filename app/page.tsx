import { currentUser } from '@clerk/nextjs/server';
import { userService } from '@/lib/services/UserService';
import HomeClient from './HomeClient';

export default async function Home() {
  const user = await currentUser();

  if (user) {
    try {
      await userService.getOrCreate(user.id, {
        firstName: user.firstName,
        email: user.emailAddresses[0]?.emailAddress,
      });
    } catch {
      // Non-fatal: user record will be created on next signed-in action
    }
  }

  return <HomeClient />;
}
