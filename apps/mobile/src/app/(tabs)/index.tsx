import { useUser } from '@clerk/clerk-expo';
import { Camera } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { Muted, Screen, ScreenTitle } from '@/components/ui';

export default function HomeScreen() {
  const { user } = useUser();
  const name = user?.firstName ?? user?.primaryEmailAddress?.emailAddress ?? 'there';

  return (
    <Screen>
      <ScreenTitle>Mahal</ScreenTitle>
      <Muted>Hi {name} 👋</Muted>

      <View className="mt-8 items-center">
        {/* Receipt capture lands here in Phase 4. */}
        <Pressable className="h-40 w-full items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 active:bg-gray-50">
          <Camera color="#9ca3af" size={32} />
          <Text className="mt-3 text-base font-medium text-gray-500">Snap a receipt</Text>
          <Text className="mt-1 text-sm text-gray-400">Coming soon</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
