import { useAuth, useUser } from '@clerk/clerk-expo';
import { LogOut } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { Card, Muted, Screen, ScreenTitle } from '@/components/ui';

export default function SettingsScreen() {
  const { user } = useUser();
  const { signOut } = useAuth();

  return (
    <Screen>
      <ScreenTitle>Settings</ScreenTitle>

      <Card>
        <Muted>Signed in as</Muted>
        <Text className="mt-1 text-base font-medium text-foreground">
          {user?.primaryEmailAddress?.emailAddress ?? user?.firstName ?? 'Account'}
        </Text>
      </Card>

      <Pressable
        onPress={() => signOut()}
        className="mt-4 flex-row items-center justify-center gap-2 rounded-2xl border border-gray-200 py-4 active:bg-gray-50"
      >
        <LogOut color="#dc2626" size={18} />
        <Text className="text-base font-semibold text-red-600">Sign out</Text>
      </Pressable>
    </Screen>
  );
}
