import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { ApiClientProvider } from '@/components/api-client-provider';

import '../global.css';

/**
 * Auth-gated navigator. `Stack.Protected` only mounts the screens whose `guard`
 * is true, and expo-router redirects to the first available route when the
 * guard flips — so signing in/out automatically moves between the two groups.
 */
function RootNavigator() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ClerkProvider
      tokenCache={tokenCache}
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY}
    >
      <ApiClientProvider>
        <RootNavigator />
      </ApiClientProvider>
    </ClerkProvider>
  );
}
