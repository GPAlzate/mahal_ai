import { ClerkProvider } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { Stack } from 'expo-router';

import { ApiClientProvider } from '@/components/api-client-provider';

export default function RootLayout() {
  return (
    <ClerkProvider
      tokenCache={tokenCache}
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY}
    >
      <ApiClientProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </ApiClientProvider>
    </ClerkProvider>
  );
}
