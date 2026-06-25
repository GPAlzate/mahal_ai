import { useSSO } from '@clerk/clerk-expo';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Required for the OAuth web browser to dismiss and return control to the app.
WebBrowser.maybeCompleteAuthSession();

/** Warms up the Android browser for a faster OAuth handoff (no-op on iOS). */
function useWarmUpBrowser() {
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

export default function SignInScreen() {
  useWarmUpBrowser();
  const { startSSOFlow } = useSSO();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onGooglePress = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        // Returns to the app via the "mahal" scheme registered in app.json.
        redirectUrl: AuthSession.makeRedirectUri(),
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        // The auth gate in _layout.tsx redirects to the home screen.
      } else {
        // No session created — flow was cancelled or needs more steps (MFA, etc.).
        setError('Sign-in was not completed.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [startSSOFlow]);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 justify-center px-7">
        <Text className="text-center text-4xl font-extrabold">Mahal</Text>
        <Text className="mb-7 text-center text-base text-black/60">
          Split receipts with friends
        </Text>

        <Pressable
          className="h-14 flex-row items-center justify-center rounded-xl border border-gray-300 bg-white active:bg-gray-100"
          onPress={onGooglePress}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#1f2937" />
          ) : (
            <Text className="text-base font-semibold text-gray-800">Continue with Google</Text>
          )}
        </Pressable>

        {error ? <Text className="mt-2 text-center text-red-600">{error}</Text> : null}
      </View>
    </SafeAreaView>
  );
}
