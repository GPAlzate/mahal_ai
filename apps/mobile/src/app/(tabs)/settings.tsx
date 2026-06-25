import { useAuth } from '@clerk/clerk-expo';
import { api } from '@mahal/shared/client/api-client';
import { LogOut } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Button, Field, Screen, ScreenTitle } from '@/components/ui';

export default function SettingsScreen() {
  const { signOut } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [gcash, setGcash] = useState('');
  const [username, setUsername] = useState('');

  useEffect(() => {
    api.user
      .get()
      .then((p) => {
        setDisplayName(p.displayName ?? '');
        setGcash(p.gcashNumber ?? '');
        setUsername(p.username ?? '');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const onSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api.settings.update({
        displayName: displayName.trim() || null,
        gcashNumber: gcash.replace(/\D/g, '') || null,
        username: username.trim().toLowerCase(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <ScreenTitle>Settings</ScreenTitle>
        <ActivityIndicator className="mt-6" />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenTitle>Settings</ScreenTitle>

      <View className="gap-4">
        <Field
          label="Display name"
          placeholder="e.g. Gabe"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
        />
        <Field
          label="Username"
          placeholder="your_handle"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Field
          label="GCash number"
          placeholder="917 123 4567"
          value={gcash}
          onChangeText={setGcash}
          keyboardType="phone-pad"
        />

        {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
        {saved ? <Text className="text-sm text-green-600">Saved ✓</Text> : null}

        <Button label="Save" onPress={onSave} loading={saving} />
      </View>

      <Pressable
        onPress={() => signOut()}
        className="mt-auto mb-4 flex-row items-center justify-center gap-2 rounded-2xl border border-gray-200 py-4 active:bg-gray-50"
      >
        <LogOut color="#dc2626" size={18} />
        <Text className="text-base font-semibold text-red-600">Sign out</Text>
      </Pressable>
    </Screen>
  );
}
