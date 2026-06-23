import { useSSO } from '@clerk/clerk-expo';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
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
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Mahal</Text>
        <Text style={styles.subtitle}>Split receipts with friends</Text>

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={onGooglePress}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#1f2937" />
          ) : (
            <Text style={styles.buttonText}>Continue with Google</Text>
          )}
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, gap: 12 },
  title: { fontSize: 40, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 16, opacity: 0.6, textAlign: 'center', marginBottom: 28 },
  button: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  buttonPressed: { backgroundColor: '#f3f4f6' },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  error: { color: '#dc2626', textAlign: 'center', marginTop: 8 },
});
